from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import ExamDuty, Faculty, Notification, AuditLog, User
from app.schemas.schemas import ExamDutyCreate, ExamDutyOut
from app.api.deps import get_current_user, require_admin

router = APIRouter()

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
