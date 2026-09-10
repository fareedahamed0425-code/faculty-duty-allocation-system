import re
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.db.session import get_db
from app.models.entities import ExamDuty, Faculty, Notification, AuditLog, User, Absence, TimetableVersion, TimetableEntry, SubstitutionDuty
from app.schemas.schemas import ExamDutyCreate, ExamDutyOut, DynamicExamAllocationRequest, DynamicExamAllocationOut, DynamicExamCandidateEvaluation
from app.api.deps import get_current_user, require_admin

router = APIRouter()

def parse_time_to_minutes(time_str: str) -> int:
    """Convert '09:00 AM', '9:30', '14:00', '1:00 PM' etc. to minutes past midnight."""
    if not time_str:
        return 0
    t = time_str.strip().upper()
    is_pm = "PM" in t
    is_am = "AM" in t
    clean = re.sub(r"[^\d:]", "", t)
    parts = clean.split(":")
    if not parts or not parts[0]:
        return 0
    try:
        hours = int(parts[0])
        mins = int(parts[1]) if len(parts) > 1 and parts[1] else 0
    except ValueError:
        return 0
    
    if is_pm and hours < 12:
        hours += 12
    elif is_am and hours == 12:
        hours = 0
    return hours * 60 + mins

def intervals_overlap(start1_min: int, end1_min: int, start2_min: int, end2_min: int) -> bool:
    """Check if [start1, end1) and [start2, end2) overlap."""
    return max(start1_min, start2_min) < min(end1_min, end2_min)

def enrich_exam_duty_out(duty: ExamDuty) -> ExamDutyOut:
    fac = duty.assigned_faculty
    return ExamDutyOut(
        id=duty.id,
        exam_name=duty.exam_name,
        course_code=duty.course_code,
        course_name=duty.course_name,
        date=duty.date,
        reporting_time=duty.reporting_time,
        exam_start_time=duty.exam_start_time,
        exam_end_time=duty.exam_end_time,
        venue=duty.venue,
        assigned_faculty_id=duty.assigned_faculty_id,
        assigned_faculty_name=fac.name if fac else "Unknown",
        assigned_faculty_code=fac.faculty_id if fac else "N/A",
        department_name=fac.department.name if fac and fac.department else "N/A",
        role_type=duty.role_type,
        allotted_by=duty.allotted_by,
        status=duty.status,
        instructions=duty.instructions,
        created_at=duty.created_at
    )

@router.get("", response_model=List[ExamDutyOut])
def list_exam_duties(
    faculty_id: Optional[int] = None,
    target_date: Optional[date] = None,
    role_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(ExamDuty)
    
    # If standard faculty, they see their own duties unless they are Admin/Dean/HOD
    user_role = current_user.role.name if current_user.role else "FACULTY"
    if user_role == "FACULTY" and current_user.faculty_id:
        query = query.filter(ExamDuty.assigned_faculty_id == current_user.faculty_id)
    elif faculty_id:
        query = query.filter(ExamDuty.assigned_faculty_id == faculty_id)

    if target_date:
        query = query.filter(ExamDuty.date == target_date)
    if role_type:
        query = query.filter(ExamDuty.role_type == role_type)
    if status:
        query = query.filter(ExamDuty.status == status)

    duties = query.order_by(ExamDuty.date.asc(), ExamDuty.reporting_time.asc()).all()
    return [enrich_exam_duty_out(d) for d in duties]

@router.post("", response_model=ExamDutyOut)
def allocate_exam_duty(
    payload: ExamDutyCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    faculty = db.query(Faculty).filter(Faculty.id == payload.assigned_faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found.")

    duty = ExamDuty(
        exam_name=payload.exam_name,
        course_code=payload.course_code,
        course_name=payload.course_name,
        date=payload.date,
        reporting_time=payload.reporting_time,
        exam_start_time=payload.exam_start_time,
        exam_end_time=payload.exam_end_time,
        venue=payload.venue,
        assigned_faculty_id=payload.assigned_faculty_id,
        role_type=payload.role_type,
        allotted_by=current_user.full_name,
        target_roles=payload.target_roles,
        status="SCHEDULED",
        instructions=payload.instructions
    )
    db.add(duty)
    db.flush()

    # Send rich interactive notification card to the assigned faculty
    if faculty.user_id:
        notif = Notification(
            user_id=faculty.user_id,
            title=f"📋 Exam Duty Allotted: {payload.exam_name}",
            message=(
                f"You have been allotted {payload.role_type} duty for {payload.course_name} on {payload.date}. "
                f"Reporting Time: {payload.reporting_time} | Exam Time: {payload.exam_start_time}-{payload.exam_end_time} | Venue: {payload.venue}"
            ),
            notification_type="EXAM_DUTY_ALLOCATED",
            metadata_json={
                "duty_id": duty.id,
                "exam_name": payload.exam_name,
                "course_code": payload.course_code,
                "course_name": payload.course_name,
                "date": str(payload.date),
                "reporting_time": payload.reporting_time,
                "exam_start_time": payload.exam_start_time,
                "exam_end_time": payload.exam_end_time,
                "venue": payload.venue,
                "role_type": payload.role_type,
                "allotted_by": current_user.full_name
            }
        )
        db.add(notif)

    # Audit log
    audit = AuditLog(
        event_type="EXAM_DUTY_ALLOCATED",
        actor_name=current_user.full_name,
        target_type="EXAM_DUTY",
        target_id=duty.id,
        details={
            "exam_name": payload.exam_name,
            "course_name": payload.course_name,
            "faculty_name": faculty.name,
            "date": str(payload.date),
            "venue": payload.venue,
            "reporting_time": payload.reporting_time
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(duty)

    return enrich_exam_duty_out(duty)

@router.post("/dynamic-allocate", response_model=DynamicExamAllocationOut)
def dynamic_allocate_exam_duties(
    payload: DynamicExamAllocationRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Dynamically allocate exam invigilation duties across available faculty.
    Evaluates:
      1. Active status
      2. Leave/Absence records on target date
      3. Existing exam duty conflicts during the slot
      4. Regular timetable class conflicts (if strict check enabled)
      5. Workload balancing: prioritizes faculty with lowest cumulative exam duties.
    """
    exam_start_min = parse_time_to_minutes(payload.exam_start_time)
    exam_end_min = parse_time_to_minutes(payload.exam_end_time)
    if exam_end_min <= exam_start_min:
        exam_end_min = exam_start_min + 180  # Default 3 hours if parsing fails

    query = db.query(Faculty).filter(Faculty.status == "ACTIVE")
    if payload.department_id:
        query = query.filter(Faculty.department_id == payload.department_id)
    
    faculties = query.all()
    if not faculties:
        raise HTTPException(status_code=400, detail="No active faculty members found for allocation.")

    # Find active timetable version for timetable conflict check
    active_tt = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
    weekday = payload.date.weekday()

    evaluations: List[DynamicExamCandidateEvaluation] = []
    available_candidates = []

    for fac in faculties:
        dept_name = fac.department.name if fac.department else "N/A"
        
        # 1. Check Leave / Absence
        absence = db.query(Absence).filter(
            Absence.faculty_id == fac.id,
            Absence.date <= payload.date,
            or_(Absence.end_date == None, Absence.end_date >= payload.date),
            Absence.status.in_(["CONFIRMED", "REPORTED", "APPROVED", "PENDING"])
        ).first()

        if absence:
            evaluations.append(DynamicExamCandidateEvaluation(
                faculty_id=fac.id,
                faculty_name=fac.name,
                faculty_code=fac.faculty_id,
                department_name=dept_name,
                status="UNAVAILABLE_ABSENT",
                reason=f"On {absence.leave_type or 'Approved'} leave on {payload.date}",
                current_exam_duty_count=0
            ))
            continue

        # 2. Check Existing Exam Duty Conflict on target date
        existing_exam_duties = db.query(ExamDuty).filter(
            ExamDuty.assigned_faculty_id == fac.id,
            ExamDuty.date == payload.date,
            ExamDuty.status.in_(["SCHEDULED", "ACKNOWLEDGED"])
        ).all()

        has_exam_conflict = False
        exam_conflict_reason = ""
        for ed in existing_exam_duties:
            ed_s = parse_time_to_minutes(ed.exam_start_time)
            ed_e = parse_time_to_minutes(ed.exam_end_time)
            if intervals_overlap(exam_start_min, exam_end_min, ed_s, ed_e):
                has_exam_conflict = True
                exam_conflict_reason = f"Already assigned to {ed.exam_name} ({ed.exam_start_time}-{ed.exam_end_time})"
                break

        if has_exam_conflict:
            evaluations.append(DynamicExamCandidateEvaluation(
                faculty_id=fac.id,
                faculty_name=fac.name,
                faculty_code=fac.faculty_id,
                department_name=dept_name,
                status="UNAVAILABLE_EXAM_CONFLICT",
                reason=exam_conflict_reason,
                current_exam_duty_count=0
            ))
            continue

        # 3. Check Regular Class Conflict in Timetable (if requested)
        if payload.strict_timetable_check and active_tt:
            tt_entries = db.query(TimetableEntry).filter(
                TimetableEntry.timetable_version_id == active_tt.id,
                TimetableEntry.faculty_id == fac.id,
                TimetableEntry.day_of_week == weekday
            ).all()

            has_class_conflict = False
            class_conflict_reason = ""
            for tte in tt_entries:
                tt_s = parse_time_to_minutes(tte.start_time)
                tt_e = parse_time_to_minutes(tte.end_time)
                if intervals_overlap(exam_start_min, exam_end_min, tt_s, tt_e):
                    has_class_conflict = True
                    c_name = tte.class_section.name if tte.class_section else "Class"
                    class_conflict_reason = f"Teaching {c_name} at {tte.start_time}-{tte.end_time}"
                    break

            if has_class_conflict:
                evaluations.append(DynamicExamCandidateEvaluation(
                    faculty_id=fac.id,
                    faculty_name=fac.name,
                    faculty_code=fac.faculty_id,
                    department_name=dept_name,
                    status="UNAVAILABLE_CLASS_CONFLICT",
                    reason=class_conflict_reason,
                    current_exam_duty_count=0
                ))
                continue

        # Compute fairness metrics
        exam_duty_count = db.query(ExamDuty).filter(
            ExamDuty.assigned_faculty_id == fac.id,
            ExamDuty.status != "CANCELLED"
        ).count()

        sub_duty_count = db.query(SubstitutionDuty).filter(
            SubstitutionDuty.assigned_faculty_id == fac.id,
            SubstitutionDuty.status != "CANCELLED"
        ).count()

        available_candidates.append({
            "faculty": fac,
            "dept_name": dept_name,
            "exam_duty_count": exam_duty_count,
            "sub_duty_count": sub_duty_count
        })

    # Sort available candidates by lowest exam duties, then lowest substitutions, then name
    available_candidates.sort(key=lambda c: (c["exam_duty_count"], c["sub_duty_count"], c["faculty"].name))

    # Take top N
    selected_candidates = available_candidates[:payload.required_count]
    selected_faculty_ids = {c["faculty"].id for c in selected_candidates}

    # Add available candidates to evaluations
    for c in available_candidates:
        fac = c["faculty"]
        if fac.id in selected_faculty_ids:
            evaluations.append(DynamicExamCandidateEvaluation(
                faculty_id=fac.id,
                faculty_name=fac.name,
                faculty_code=fac.faculty_id,
                department_name=c["dept_name"],
                status="SELECTED",
                reason=f"Optimal match: {c['exam_duty_count']} previous exam duties",
                current_exam_duty_count=c["exam_duty_count"]
            ))
        else:
            evaluations.append(DynamicExamCandidateEvaluation(
                faculty_id=fac.id,
                faculty_name=fac.name,
                faculty_code=fac.faculty_id,
                department_name=c["dept_name"],
                status="AVAILABLE",
                reason=f"Eligible but quota filled ({c['exam_duty_count']} previous duties)",
                current_exam_duty_count=c["exam_duty_count"]
            ))

    # Create the exam duties and notifications
    created_duties = []
    for c in selected_candidates:
        fac = c["faculty"]
        duty = ExamDuty(
            exam_name=payload.exam_name,
            course_code=payload.course_code,
            course_name=payload.course_name,
            date=payload.date,
            reporting_time=payload.reporting_time,
            exam_start_time=payload.exam_start_time,
            exam_end_time=payload.exam_end_time,
            venue=payload.venue,
            assigned_faculty_id=fac.id,
            role_type=payload.role_type,
            allotted_by=current_user.full_name,
            target_roles=payload.target_roles,
            status="SCHEDULED",
            instructions=payload.instructions
        )
        db.add(duty)
        db.flush()

        if fac.user_id:
            notif = Notification(
                user_id=fac.user_id,
                title=f"📋 Dynamic Exam Duty Allotted: {payload.exam_name}",
                message=(
                    f"You have been dynamically allotted {payload.role_type} duty for {payload.course_name} on {payload.date}. "
                    f"Reporting Time: {payload.reporting_time} | Exam Time: {payload.exam_start_time}-{payload.exam_end_time} | Venue: {payload.venue}"
                ),
                notification_type="EXAM_DUTY_ALLOCATED",
                metadata_json={
                    "duty_id": duty.id,
                    "exam_name": payload.exam_name,
                    "course_code": payload.course_code,
                    "course_name": payload.course_name,
                    "date": str(payload.date),
                    "reporting_time": payload.reporting_time,
                    "exam_start_time": payload.exam_start_time,
                    "exam_end_time": payload.exam_end_time,
                    "venue": payload.venue,
                    "role_type": payload.role_type,
                    "allotted_by": current_user.full_name
                }
            )
            db.add(notif)

        audit = AuditLog(
            event_type="DYNAMIC_EXAM_DUTY_ALLOCATED",
            actor_name=current_user.full_name,
            target_type="EXAM_DUTY",
            target_id=duty.id,
            details={
                "exam_name": payload.exam_name,
                "faculty_name": fac.name,
                "date": str(payload.date),
                "role_type": payload.role_type,
                "venue": payload.venue,
                "previous_exam_duties": c["exam_duty_count"]
            }
        )
        db.add(audit)
        created_duties.append(duty)

    db.commit()

    total_allocated = len(created_duties)
    summary_msg = f"Successfully dynamically allocated {total_allocated} of {payload.required_count} requested invigilators based on lowest duty load and 0 conflicts."
    if total_allocated < payload.required_count:
        summary_msg = f"Allocated {total_allocated} invigilators (requested {payload.required_count}). Only {len(available_candidates)} faculty members were conflict-free."

    return DynamicExamAllocationOut(
        allocated_duties=[enrich_exam_duty_out(d) for d in created_duties],
        total_requested=payload.required_count,
        total_allocated=total_allocated,
        evaluations=evaluations,
        summary_message=summary_msg
    )

@router.patch("/{duty_id}/acknowledge")
def acknowledge_exam_duty(
    duty_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    duty = db.query(ExamDuty).filter(ExamDuty.id == duty_id).first()
    if not duty:
        raise HTTPException(status_code=404, detail="Exam duty not found.")

    duty.status = "ACKNOWLEDGED"
    db.commit()
    return {"success": True, "message": "Exam duty acknowledged successfully."}

@router.delete("/{duty_id}")
def cancel_exam_duty(
    duty_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    duty = db.query(ExamDuty).filter(ExamDuty.id == duty_id).first()
    if not duty:
        raise HTTPException(status_code=404, detail="Exam duty not found.")

    faculty = duty.assigned_faculty
    if faculty and faculty.user_id:
        notif = Notification(
            user_id=faculty.user_id,
            title=f"Exam Duty Cancelled: {duty.exam_name}",
            message=f"Your scheduled {duty.role_type} duty on {duty.date} at {duty.venue} has been cancelled.",
            notification_type="EXAM_DUTY_CANCELLED"
        )
        db.add(notif)

    db.delete(duty)
    db.commit()
    return {"success": True, "message": "Exam duty cancelled successfully."}

@router.get("/template/csv")
def download_exam_timetable_template():
    """Download standard sample CSV template for bulk exam timetable uploads."""
    csv_content = (
        "Exam Name,Course Code,Course Name,Class Section,Date,Reporting Time,Exam Time Slot,Venue,Invigilators Count,Role Type,Faculty Assigned\n"
        "Mid-Term Examination 2026,CS101,Data Structures & Algorithms,I CSE-A,2026-09-22,09:00 AM,09:30 AM - 12:30 PM,Exam Hall B-204,2,Room Invigilator,DYNAMIC\n"
        "Mid-Term Examination 2026,AI201,Artificial Intelligence & Expert Systems,II AIML-A,2026-09-22,09:00 AM,09:30 AM - 12:30 PM,LH-101,1,Room Invigilator,DYNAMIC\n"
        "Mid-Term Examination 2026,DS201,Data Science & Big Data Analytics,II AIDS-A,2026-09-23,01:30 PM,02:00 PM - 05:00 PM,Exam Hall A-102,2,Room Invigilator,DYNAMIC\n"
        "End-Term Examination 2026,SEC301,Network Security & Cryptography,III CS-A,2026-09-24,09:00 AM,09:30 AM - 12:30 PM,Block-3 Auditorium,3,Room Invigilator,DYNAMIC\n"
        "End-Term Examination 2026,CLD301,Cloud Infrastructure & Virtualization,III CC-A,2026-09-24,09:00 AM,09:30 AM - 12:30 PM,Exam Hall B-205,2,Room Invigilator,DYNAMIC\n"
        "End-Term Examination 2026,HC401,AI in Medical Diagnostics,IV AIHC-A,2026-09-25,09:00 AM,09:30 AM - 12:30 PM,Exam Hall C-301,2,Room Invigilator,DYNAMIC\n"
    )
    from fastapi import Response
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=exam_timetable_template.csv"}
    )

@router.post("/import/preview")
async def preview_exam_timetable_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Parses and validates an uploaded exam timetable CSV or Excel spreadsheet."""
    from app.services.exam_timetable_service import parse_and_validate_exam_timetable
    file_bytes = await file.read()
    res = parse_and_validate_exam_timetable(db, file_bytes, file.filename or "exam_timetable.csv")
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.post("/import/confirm")
def confirm_exam_timetable_import(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Confirms batch exam schedule entries, dynamically allocates invigilators,
    and dispatches interactive notification cards.
    """
    from app.services.exam_timetable_service import execute_exam_timetable_import_and_dispatch
    entries = payload.get("entries", [])
    if not entries:
        raise HTTPException(status_code=400, detail="No valid exam schedule entries provided for import.")
    
    return execute_exam_timetable_import_and_dispatch(db, entries, current_user)


