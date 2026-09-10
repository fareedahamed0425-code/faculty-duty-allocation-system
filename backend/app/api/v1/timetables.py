from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, and_, or_
from app.db.session import get_db
from app.models.entities import (
    TimetableVersion, TimetableEntry, Faculty, ClassSection, Subject, Department,
    TimetablePeriod, AuditLog
)
from app.schemas.schemas import (
    TimetableVersionOut, TimetableEntryOut, TimetableEntryCreate, TimetableEntryUpdate,
    TimetableImportPreview, TimetableImportConfirm, TimetablePeriodOut, TimetablePeriodUpdate,
    TimetablePeriodCreate, YearHierarchyItem, CourseHierarchyItem, SectionHierarchyItem,
    ClassSectionCreate, SubjectOut
)
from app.api.deps import get_current_user, require_admin
from app.services.timetable_service import (
    parse_and_validate_timetable_file, commit_timetable_version,
    normalize_time_str
)
from app.allocation.constraints import time_overlaps

router = APIRouter()

CANONICAL_COURSES = [
    {"code": "CSE", "name": "Computer Science"},
    {"code": "AIDS", "name": "Artificial Intelligence & Data Science"},
    {"code": "AIML", "name": "Artificial Intelligence & Machine Learning"},
    {"code": "CS", "name": "Cyber Security"},
    {"code": "CC", "name": "Cloud Computing"},
    {"code": "AIHC", "name": "Artificial Intelligence in Health Care"},
]

DEFAULT_PERIODS = [
    {"period_number": 1, "name": "Period 1", "start_time": "09:00", "end_time": "10:00", "is_break": False},
    {"period_number": 2, "name": "Period 2", "start_time": "10:00", "end_time": "11:00", "is_break": False},
    {"period_number": 3, "name": "Period 3", "start_time": "11:15", "end_time": "12:15", "is_break": False},
    {"period_number": 4, "name": "Period 4", "start_time": "12:15", "end_time": "13:15", "is_break": False},
    {"period_number": 5, "name": "Period 5", "start_time": "14:00", "end_time": "15:00", "is_break": False},
    {"period_number": 6, "name": "Period 6", "start_time": "15:00", "end_time": "16:00", "is_break": False},
]

def enrich_entry_out(e: TimetableEntry) -> TimetableEntryOut:
    """Build TimetableEntryOut from a fully-loaded TimetableEntry (no lazy queries)."""
    return TimetableEntryOut(
        id=e.id,
        timetable_version_id=e.timetable_version_id,
        faculty_id=e.faculty_id,
        faculty_name=e.faculty.name if e.faculty else None,
        class_section_id=e.class_section_id,
        class_name=e.class_section.name if e.class_section else None,
        subject_id=e.subject_id,
        subject_code=e.subject.code if e.subject else None,
        subject_name=e.subject.name if e.subject else None,
        day_of_week=e.day_of_week,
        start_time=e.start_time,
        end_time=e.end_time,
        room_number=e.room_number
    )

# =========================================================================
# 1. CENTRALIZED TIMETABLE PERIODS (UNIVERSAL TIMINGS)
# =========================================================================

@router.get("/periods", response_model=List[TimetablePeriodOut])
def list_periods(db: Session = Depends(get_db)):
    """Fetch all centralized timetable periods; auto-seeds standard defaults if empty."""
    periods = db.query(TimetablePeriod).order_by(TimetablePeriod.period_number).all()
    if not periods:
        for dp in DEFAULT_PERIODS:
            p = TimetablePeriod(
                period_number=dp["period_number"],
                name=dp["name"],
                start_time=dp["start_time"],
                end_time=dp["end_time"],
                is_break=dp["is_break"]
            )
            db.add(p)
        db.commit()
        periods = db.query(TimetablePeriod).order_by(TimetablePeriod.period_number).all()
    return periods

@router.get("/subjects", response_model=List[SubjectOut])
def list_subjects(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Fetch all institutional subjects or subjects filtered by department."""
    query = db.query(Subject).filter(Subject.is_active == True)
    if department_id:
        query = query.filter(Subject.department_id == department_id)
    return query.order_by(Subject.code.asc()).all()

@router.put("/periods/{period_id}", response_model=TimetablePeriodOut)
def update_period(
    period_id: int,
    payload: TimetablePeriodUpdate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """
    Update centralized period start/end time.
    Validates formatting (HH:MM), start < end, and cascades updated times to existing
    timetable entries that matched the previous period timing.
    """
    period = db.query(TimetablePeriod).filter(TimetablePeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail=f"Timetable Period #{period_id} not found.")

    st = normalize_time_str(payload.start_time)
    et = normalize_time_str(payload.end_time)
    if not st or not et:
        raise HTTPException(status_code=400, detail="Invalid time format. Please use 'HH:MM' (24-hour format).")
    if st >= et:
        raise HTTPException(status_code=400, detail=f"Start time ({st}) must be earlier than End time ({et}).")

    old_st = period.start_time
    old_et = period.end_time

    period.start_time = st
    period.end_time = et
    if payload.name:
        period.name = payload.name.strip()
    if payload.is_break is not None:
        period.is_break = payload.is_break

    # Cascade timing update to active timetable entries if time changed
    if old_st != st or old_et != et:
        active_version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
        if active_version:
            matching_entries = db.query(TimetableEntry).filter(
                TimetableEntry.timetable_version_id == active_version.id,
                TimetableEntry.start_time == old_st,
                TimetableEntry.end_time == old_et
            ).all()
            for entry in matching_entries:
                entry.start_time = st
                entry.end_time = et

    # Record in audit log
    audit = AuditLog(
        event_type="PERIOD_TIMING_UPDATED",
        actor_id=admin_user.id if hasattr(admin_user, "id") else None,
        actor_name=admin_user.full_name if hasattr(admin_user, "full_name") else "Admin",
        target_type="TIMETABLE_PERIOD",
        target_id=period.id,
        details={
            "period_number": period.period_number,
            "old_timing": f"{old_st} - {old_et}",
            "new_timing": f"{st} - {et}",
            "name": period.name
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(period)
    return period

# =========================================================================
# 2. HIERARCHY EXPLORER (YEAR -> COURSE -> REAL SECTIONS)
# =========================================================================

ROMAN_LABELS = {
    1: "1st Year (I)",
    2: "2nd Year (II)",
    3: "3rd Year (III)",
    4: "4th Year (IV)"
}

@router.get("/hierarchy", response_model=List[YearHierarchyItem])
def get_timetable_hierarchy(db: Session = Depends(get_db)):
    """
    Returns the real database hierarchy: Academic Year (1..4) -> 6 Canonical Courses -> Real DB Sections.
    Zero fake data: only real sections in the database are returned.
    """
    # Ping connection
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db.rollback()

    departments = db.query(Department).all()
    dept_by_code = {d.code.upper(): d for d in departments}

    active_version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
    active_version_id = active_version.id if active_version else None

    # Count entries per section in active version
    entry_counts = {}
    if active_version_id:
        entries = db.query(TimetableEntry.class_section_id).filter(
            TimetableEntry.timetable_version_id == active_version_id
        ).all()
        for (sec_id,) in entries:
            entry_counts[sec_id] = entry_counts.get(sec_id, 0) + 1

    all_sections = db.query(ClassSection).all()

    years_out = []
    for y_level in [1, 2, 3, 4]:
        course_items = []
        for course_def in CANONICAL_COURSES:
            c_code = course_def["code"]
            dept = dept_by_code.get(c_code)
            dept_id = dept.id if dept else 0

            # Match real sections belonging to this department and year level
            matching_sections = []
            if dept:
                for sec in all_sections:
                    if sec.department_id == dept.id:
                        sec_year = sec.effective_year
                        if sec_year == y_level:
                            matching_sections.append(SectionHierarchyItem(
                                id=sec.id,
                                name=sec.name,
                                department_id=sec.department_id,
                                department_code=c_code,
                                academic_year=sec.academic_year or "2026",
                                semester=sec.semester or (y_level * 2 - 1),
                                year_level=sec_year,
                                capacity=sec.capacity or 60,
                                total_entries=entry_counts.get(sec.id, 0)
                            ))

            course_items.append(CourseHierarchyItem(
                code=c_code,
                name=course_def["name"],
                department_id=dept_id,
                sections=matching_sections
            ))

        years_out.append(YearHierarchyItem(
            year_level=y_level,
            roman_label=ROMAN_LABELS[y_level],
            courses=course_items
        ))

    return years_out

@router.post("/sections", response_model=SectionHierarchyItem)
def create_class_section(
    payload: ClassSectionCreate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """
    Creates a real class/section in the database under the designated Year and Course.
    """
    clean_name = payload.name.strip() if payload.name else ""
    if not clean_name:
        raise HTTPException(status_code=400, detail="Section name is required and cannot be empty.")

    # Resolve Department
    dept = None
    if payload.department_id:
        dept = db.query(Department).filter(Department.id == payload.department_id).first()
    elif payload.course_code:
        dept = db.query(Department).filter(Department.code.ilike(payload.course_code.strip())).first()

    if not dept:
        # Fallback to first available department
        dept = db.query(Department).first()
        if not dept:
            raise HTTPException(status_code=400, detail="No departments configured in the system.")

    # Validate Year Level
    year_level = payload.year_level if 1 <= payload.year_level <= 4 else 1
    semester = payload.semester if payload.semester else (year_level * 2 - 1)

    # Check for duplicate section name in the same department
    existing = db.query(ClassSection).filter(
        ClassSection.department_id == dept.id,
        ClassSection.name.ilike(clean_name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Section '{clean_name}' already exists in course {dept.code}."
        )

    section = ClassSection(
        name=clean_name.upper(),
        department_id=dept.id,
        academic_year=payload.academic_year.strip() if payload.academic_year else "2026",
        year_level=year_level,
        semester=semester,
        capacity=payload.capacity if payload.capacity > 0 else 60
    )
    db.add(section)
    db.flush()

    # Log to AuditLog
    audit = AuditLog(
        event_type="CLASS_SECTION_CREATED",
        actor_id=admin_user.id if hasattr(admin_user, "id") else None,
        actor_name=admin_user.full_name if hasattr(admin_user, "full_name") else "Admin",
        target_type="CLASS_SECTION",
        target_id=section.id,
        details={
            "section_name": section.name,
            "department_code": dept.code,
            "year_level": year_level,
            "semester": semester
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(section)

    return SectionHierarchyItem(
        id=section.id,
        name=section.name,
        department_id=section.department_id,
        department_code=dept.code,
        academic_year=section.academic_year or "2026",
        semester=section.semester or semester,
        year_level=section.effective_year,
        capacity=section.capacity or 60,
        total_entries=0
    )

# =========================================================================
# 3. TIMETABLE VERSIONS & ENTRIES
# =========================================================================

@router.get("/versions", response_model=List[TimetableVersionOut])
def list_versions(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db.rollback()

    versions = (
        db.query(TimetableVersion)
        .options(joinedload(TimetableVersion.entries))
        .order_by(TimetableVersion.id.desc())
        .all()
    )
    out = []
    for v in versions:
        out.append(TimetableVersionOut(
            id=v.id,
            name=v.name,
            academic_year=v.academic_year,
            semester=v.semester,
            is_active=v.is_active,
            created_by=v.created_by,
            created_at=v.created_at,
            total_entries=len(v.entries)
        ))
    return out

@router.get("/active/entries", response_model=List[TimetableEntryOut])
def get_active_timetable_entries(
    faculty_id: Optional[str] = Query(None),
    class_section_id: Optional[str] = Query(None),
    day_of_week: Optional[int] = Query(None),
    version_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db.rollback()

    target_version_id = version_id
    if not target_version_id:
        active_version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
        if not active_version:
            return []
        target_version_id = active_version.id

    query = (
        db.query(TimetableEntry)
        .options(
            joinedload(TimetableEntry.faculty),
            joinedload(TimetableEntry.class_section),
            joinedload(TimetableEntry.subject),
        )
        .filter(TimetableEntry.timetable_version_id == target_version_id)
    )

    if faculty_id and str(faculty_id).strip().isdigit():
        query = query.filter(TimetableEntry.faculty_id == int(faculty_id))
    if class_section_id and str(class_section_id).strip().isdigit():
        query = query.filter(TimetableEntry.class_section_id == int(class_section_id))
    if day_of_week is not None:
        query = query.filter(TimetableEntry.day_of_week == day_of_week)

    entries = query.order_by(TimetableEntry.day_of_week, TimetableEntry.start_time).all()
    return [enrich_entry_out(e) for e in entries]

# =========================================================================
# 4. CELL-LEVEL ENTRY CRUD WITH CONFLICT DETECTION
# =========================================================================

def check_entry_conflicts(
    db: Session,
    version_id: int,
    faculty_id: int,
    day_of_week: int,
    start_time: str,
    end_time: str,
    room_number: Optional[str] = None,
    exclude_entry_id: Optional[int] = None
) -> Optional[str]:
    """Check for faculty schedule conflicts and room double-booking."""
    # 1. Faculty conflict
    fac_entries = db.query(TimetableEntry).filter(
        TimetableEntry.timetable_version_id == version_id,
        TimetableEntry.faculty_id == faculty_id,
        TimetableEntry.day_of_week == day_of_week
    )
    if exclude_entry_id:
        fac_entries = fac_entries.filter(TimetableEntry.id != exclude_entry_id)

    for fe in fac_entries.all():
        if time_overlaps(fe.start_time, fe.end_time, start_time, end_time):
            c_name = fe.class_section.name if fe.class_section else "another class"
            return f"Faculty Conflict: Selected faculty already teaches '{c_name}' on Day {day_of_week} at {fe.start_time}-{fe.end_time}."

    # 2. Room conflict
    if room_number and room_number.strip():
        rm_entries = db.query(TimetableEntry).filter(
            TimetableEntry.timetable_version_id == version_id,
            TimetableEntry.room_number == room_number.strip(),
            TimetableEntry.day_of_week == day_of_week
        )
        if exclude_entry_id:
            rm_entries = rm_entries.filter(TimetableEntry.id != exclude_entry_id)

        for re in rm_entries.all():
            if time_overlaps(re.start_time, re.end_time, start_time, end_time):
                c_name = re.class_section.name if re.class_section else "another class"
                return f"Room Conflict: Room '{room_number}' is already occupied by '{c_name}' on Day {day_of_week} at {re.start_time}-{re.end_time}."

    return None

@router.post("/entries", response_model=TimetableEntryOut)
def create_timetable_entry(
    payload: TimetableEntryCreate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Creates a new timetable entry with conflict validation."""
    version_id = payload.timetable_version_id
    if not version_id:
        active_version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
        if not active_version:
            raise HTTPException(status_code=400, detail="No active timetable version found. Please activate or create a version first.")
        version_id = active_version.id

    st = normalize_time_str(payload.start_time)
    et = normalize_time_str(payload.end_time)
    if not st or not et or st >= et:
        raise HTTPException(status_code=400, detail="Invalid start/end time.")

    # Validate conflicts
    conflict_err = check_entry_conflicts(
        db=db,
        version_id=version_id,
        faculty_id=payload.faculty_id,
        day_of_week=payload.day_of_week,
        start_time=st,
        end_time=et,
        room_number=payload.room_number
    )
    if conflict_err:
        raise HTTPException(status_code=400, detail=conflict_err)

    entry = TimetableEntry(
        timetable_version_id=version_id,
        faculty_id=payload.faculty_id,
        class_section_id=payload.class_section_id,
        subject_id=payload.subject_id,
        day_of_week=payload.day_of_week,
        start_time=st,
        end_time=et,
        room_number=payload.room_number.strip() if payload.room_number else "Room-101"
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Log audit
    audit = AuditLog(
        event_type="TIMETABLE_ENTRY_CREATED",
        actor_id=admin_user.id if hasattr(admin_user, "id") else None,
        actor_name=admin_user.full_name if hasattr(admin_user, "full_name") else "Admin",
        target_type="TIMETABLE_ENTRY",
        target_id=entry.id,
        details={
            "faculty_id": entry.faculty_id,
            "class_section_id": entry.class_section_id,
            "subject_id": entry.subject_id,
            "day_of_week": entry.day_of_week,
            "slot": f"{entry.start_time}-{entry.end_time}"
        }
    )
    db.add(audit)
    db.commit()

    return enrich_entry_out(entry)

@router.put("/entries/{entry_id}", response_model=TimetableEntryOut)
def update_timetable_entry(
    entry_id: int,
    payload: TimetableEntryUpdate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Updates an existing timetable entry cell with conflict validation and automatic faculty schedule sync."""
    entry = (
        db.query(TimetableEntry)
        .options(
            joinedload(TimetableEntry.faculty),
            joinedload(TimetableEntry.class_section),
            joinedload(TimetableEntry.subject)
        )
        .filter(TimetableEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail=f"Timetable entry #{entry_id} not found.")

    target_fac_id = payload.faculty_id if payload.faculty_id is not None else entry.faculty_id
    target_sub_id = payload.subject_id if payload.subject_id is not None else entry.subject_id
    target_day = payload.day_of_week if payload.day_of_week is not None else entry.day_of_week
    target_st = normalize_time_str(payload.start_time) if payload.start_time else entry.start_time
    target_et = normalize_time_str(payload.end_time) if payload.end_time else entry.end_time
    target_room = payload.room_number.strip() if payload.room_number else entry.room_number

    if target_st >= target_et:
        raise HTTPException(status_code=400, detail="Start time must be earlier than End time.")

    # Validate conflict
    conflict_err = check_entry_conflicts(
        db=db,
        version_id=entry.timetable_version_id,
        faculty_id=target_fac_id,
        day_of_week=target_day,
        start_time=target_st,
        end_time=target_et,
        room_number=target_room,
        exclude_entry_id=entry.id
    )
    if conflict_err:
        raise HTTPException(status_code=400, detail=conflict_err)

    old_fac = entry.faculty_id
    entry.faculty_id = target_fac_id
    entry.subject_id = target_sub_id
    entry.day_of_week = target_day
    entry.start_time = target_st
    entry.end_time = target_et
    entry.room_number = target_room

    audit = AuditLog(
        event_type="TIMETABLE_ENTRY_UPDATED",
        actor_id=admin_user.id if hasattr(admin_user, "id") else None,
        actor_name=admin_user.full_name if hasattr(admin_user, "full_name") else "Admin",
        target_type="TIMETABLE_ENTRY",
        target_id=entry.id,
        details={
            "old_faculty_id": old_fac,
            "new_faculty_id": target_fac_id,
            "subject_id": target_sub_id,
            "day_of_week": target_day,
            "slot": f"{target_st}-{target_et}",
            "room_number": target_room
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(entry)

    return enrich_entry_out(entry)

@router.delete("/entries/{entry_id}")
def delete_timetable_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """Deletes a timetable entry and frees the associated faculty schedule."""
    entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Timetable entry #{entry_id} not found.")

    db.delete(entry)
    audit = AuditLog(
        event_type="TIMETABLE_ENTRY_DELETED",
        actor_id=admin_user.id if hasattr(admin_user, "id") else None,
        actor_name=admin_user.full_name if hasattr(admin_user, "full_name") else "Admin",
        target_type="TIMETABLE_ENTRY",
        target_id=entry_id,
        details={"deleted_entry_id": entry_id}
    )
    db.add(audit)
    db.commit()
    return {"success": True, "message": f"Timetable entry #{entry_id} deleted."}

# =========================================================================
# 5. IMPORT WIZARD & TEMPLATES
# =========================================================================

@router.post("/import/preview", response_model=TimetableImportPreview)
async def preview_timetable_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    content = await file.read()
    result = parse_and_validate_timetable_file(db, content, file.filename)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@router.post("/import/confirm")
def confirm_timetable_import(
    payload: TimetableImportConfirm,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    if not payload.entries:
        raise HTTPException(status_code=400, detail="No entries provided to import.")

    result = commit_timetable_version(
        db=db,
        version_name=payload.version_name,
        entries_data=payload.entries,
        academic_year=payload.academic_year,
        semester=payload.semester,
        activate_immediately=payload.activate_immediately,
        created_by=admin_user.full_name
    )
    return result

@router.post("/versions/{version_id}/activate")
def activate_version(
    version_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    version = db.query(TimetableVersion).filter(TimetableVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail=f"Timetable version #{version_id} not found.")

    db.query(TimetableVersion).filter(TimetableVersion.is_active == True).update({"is_active": False})
    version.is_active = True
    db.commit()
    return {"success": True, "message": f"Timetable version '{version.name}' is now active."}

@router.get("/template/csv")
def download_timetable_template_csv():
    import io
    from fastapi.responses import Response
    import pandas as pd

    sample_data = [
        {"Faculty": "Faculty Member", "Faculty Code": "FAC-001", "Class": "I CSE-A", "Subject": "Data Structures & Algorithms", "Subject Code": "CS101", "Day": "Monday", "Start Time": "09:00", "End Time": "10:00", "Room": "Hall 101"},
        {"Faculty": "Faculty Member", "Faculty Code": "FAC-002", "Class": "II AIML-A", "Subject": "Artificial Intelligence", "Subject Code": "AI201", "Day": "Monday", "Start Time": "10:00", "End Time": "11:00", "Room": "Hall 102"},
        {"Faculty": "Faculty Member", "Faculty Code": "FAC-003", "Class": "II AIDS-A", "Subject": "Data Science", "Subject Code": "DS201", "Day": "Tuesday", "Start Time": "11:15", "End Time": "12:15", "Room": "Hall 103"},
        {"Faculty": "Faculty Member", "Faculty Code": "FAC-004", "Class": "III CS-A", "Subject": "Network Security", "Subject Code": "SEC301", "Day": "Wednesday", "Start Time": "13:15", "End Time": "14:15", "Room": "Lab 201"},
        {"Faculty": "Faculty Member", "Faculty Code": "FAC-005", "Class": "III CC-A", "Subject": "Cloud Computing", "Subject Code": "CLD301", "Day": "Thursday", "Start Time": "14:15", "End Time": "15:15", "Room": "Lab 202"},
        {"Faculty": "Faculty Member", "Faculty Code": "FAC-006", "Class": "IV AIHC-A", "Subject": "AI in Healthcare", "Subject Code": "HC401", "Day": "Friday", "Start Time": "09:00", "End Time": "10:00", "Room": "Hall 301"}
    ]
    df = pd.DataFrame(sample_data)
    stream = io.StringIO()
    df.to_csv(stream, index=False)

    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=apollo_timetable_template.csv"}
    )

