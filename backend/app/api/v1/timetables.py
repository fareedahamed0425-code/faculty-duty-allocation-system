from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from app.db.session import get_db
from app.models.entities import TimetableVersion, TimetableEntry, Faculty, ClassSection, Subject
from app.schemas.schemas import (
    TimetableVersionOut, TimetableEntryOut, TimetableImportPreview, TimetableImportConfirm
)
from app.api.deps import get_current_user, require_admin
from app.services.timetable_service import parse_and_validate_timetable_file, commit_timetable_version

router = APIRouter()

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

@router.get("/versions", response_model=List[TimetableVersionOut])
def list_versions(db: Session = Depends(get_db)):
    # Ping the connection first to catch stale connections early
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
    faculty_id: Optional[int] = None,
    class_section_id: Optional[int] = None,
    day_of_week: Optional[int] = None,
    db: Session = Depends(get_db)
):
    # Ping connection — recover from server-closed connections silently
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db.rollback()

    active_version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
    if not active_version:
        return []

    # Eagerly load all relationships in a single JOIN query — no lazy loads, no stale connection risk
    query = (
        db.query(TimetableEntry)
        .options(
            joinedload(TimetableEntry.faculty),
            joinedload(TimetableEntry.class_section),
            joinedload(TimetableEntry.subject),
        )
        .filter(TimetableEntry.timetable_version_id == active_version.id)
    )

    if faculty_id:
        query = query.filter(TimetableEntry.faculty_id == faculty_id)
    if class_section_id:
        query = query.filter(TimetableEntry.class_section_id == class_section_id)
    if day_of_week is not None:
        query = query.filter(TimetableEntry.day_of_week == day_of_week)

    entries = query.order_by(TimetableEntry.day_of_week, TimetableEntry.start_time).all()
    return [enrich_entry_out(e) for e in entries]

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
        {"Faculty": "Prof. Arun Kumar", "Faculty Code": "FAC-008", "Class": "CSE-A", "Subject": "Data Structures & Algorithms", "Subject Code": "CS101", "Day": "Monday", "Start Time": "09:00", "End Time": "10:00", "Room": "Hall 101"},
        {"Faculty": "Prof. Priya Nair", "Faculty Code": "FAC-009", "Class": "CSE-B", "Subject": "Operating Systems", "Subject Code": "CS102", "Day": "Monday", "Start Time": "10:00", "End Time": "11:00", "Room": "Hall 102"},
        {"Faculty": "Prof. Mohammad Ahmed", "Faculty Code": "FAC-010", "Class": "CSE-C", "Subject": "Database Management Systems", "Subject Code": "CS103", "Day": "Tuesday", "Start Time": "11:15", "End Time": "12:15", "Room": "Hall 103"},
        {"Faculty": "Prof. Manoj Verma", "Faculty Code": "FAC-011", "Class": "ECE-A", "Subject": "Digital Signal Processing", "Subject Code": "EC201", "Day": "Wednesday", "Start Time": "13:15", "End Time": "14:15", "Room": "Lab 201"},
        {"Faculty": "Prof. Divya Krishnan", "Faculty Code": "FAC-012", "Class": "ECE-B", "Subject": "VLSI Design & Technology", "Subject Code": "EC202", "Day": "Thursday", "Start Time": "14:15", "End Time": "15:15", "Room": "Lab 202"},
        {"Faculty": "Prof. Sanjay Mehta", "Faculty Code": "FAC-013", "Class": "MECH-A", "Subject": "Engineering Thermodynamics", "Subject Code": "ME301", "Day": "Friday", "Start Time": "09:00", "End Time": "10:00", "Room": "Hall 301"},
        {"Faculty": "Prof. Kavita Reddy", "Faculty Code": "FAC-014", "Class": "MECH-B", "Subject": "Calculus & Linear Algebra", "Subject Code": "MA101", "Day": "Saturday", "Start Time": "10:00", "End Time": "11:00", "Room": "Hall 302"}
    ]
    df = pd.DataFrame(sample_data)
    stream = io.StringIO()
    df.to_csv(stream, index=False)

    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=apollo_timetable_template.csv"}
    )
