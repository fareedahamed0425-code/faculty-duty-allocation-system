from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import (
    Absence, Faculty, TimetableVersion, TimetableEntry,
    SubstitutionRequirement, SubstitutionDuty, AuditLog, Notification
)
from app.allocation.constraints import time_overlaps, get_week_bounds
from app.allocation.engine import generate_allocation
from app.allocation.multi_allocator import batch_allocate_requirements

def create_faculty_absence(
    db: Session,
    faculty_id: int,
    absence_date: date,
    start_time: str = "00:00",
    end_time: str = "23:59",
    is_full_day: bool = True,
    reason: Optional[str] = None,
    reported_by: str = "Admin",
    auto_allocate: bool = True
) -> Dict[str, Any]:
    """
    Records a faculty absence and AUTOMATICALLY identifies all affected classes
    from the active timetable version. If auto_allocate=True, immediately solves
    and assigns eligible substitute faculty.
    """
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        return {"success": False, "error": f"Faculty #{faculty_id} not found."}

    # Create Absence record
    absence = Absence(
        faculty_id=faculty_id,
        date=absence_date,
        start_time=start_time,
        end_time=end_time,
        is_full_day=is_full_day,
        reason=reason,
        status="CONFIRMED",
        reported_by=reported_by
    )
    db.add(absence)
    db.flush()

    # Find active timetable version
    active_version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
    if not active_version:
        db.commit()
        return {
            "success": True,
            "absence_id": absence.id,
            "affected_classes": [],
            "message": "Absence recorded. However, no active timetable version was found to discover affected classes."
        }

    # Determine day of week (0=Monday..6=Sunday)
    day_of_week = absence_date.weekday()

    # Find affected regular classes
    entries = db.query(TimetableEntry).filter(
        TimetableEntry.timetable_version_id == active_version.id,
        TimetableEntry.faculty_id == faculty_id,
        TimetableEntry.day_of_week == day_of_week
    ).all()

    created_requirements: List[SubstitutionRequirement] = []
    for entry in entries:
        # Check if entry overlaps with absence period
        if is_full_day or time_overlaps(entry.start_time, entry.end_time, start_time, end_time):
            req = SubstitutionRequirement(
                absence_id=absence.id,
                date=absence_date,
                day_of_week=day_of_week,
                period_start=entry.start_time,
                period_end=entry.end_time,
                class_section_id=entry.class_section_id,
                subject_id=entry.subject_id,
                original_faculty_id=faculty_id,
                status="PENDING"
            )
            db.add(req)
            db.flush()
            created_requirements.append(req)

    # Audit log
    audit = AuditLog(
        event_type="ABSENCE_RECORDED",
        actor_name=reported_by,
        target_type="ABSENCE",
        target_id=absence.id,
        details={
            "faculty_name": faculty.name,
            "faculty_code": faculty.faculty_id,
            "date": str(absence_date),
            "is_full_day": is_full_day,
            "reason": reason,
            "affected_classes_count": len(created_requirements)
        }
    )
    db.add(audit)
    db.commit()

    # Automatically run allocation if requested and affected classes exist
    allocation_results = []
    if auto_allocate and created_requirements:
        batch_res = batch_allocate_requirements(
            db=db,
            requirement_ids=[r.id for r in created_requirements],
            actor_name=f"Auto Allocation (Absence by {reported_by})"
        )
        allocation_results = batch_res["results"]

    return {
        "success": True,
        "absence_id": absence.id,
        "faculty_name": faculty.name,
        "date": str(absence_date),
        "affected_classes_count": len(created_requirements),
        "requirements": [
            {
                "id": r.id,
                "class_name": r.class_section.name if r.class_section else "",
                "subject_name": r.subject.name if r.subject else "",
                "period": f"{r.period_start}-{r.period_end}",
                "status": r.status
            }
            for r in created_requirements
        ],
        "allocation_results": allocation_results
    }

def cancel_faculty_absence(
    db: Session,
    absence_id: int,
    cancelled_by: str = "Admin"
) -> Dict[str, Any]:
    """
    Cancels an absence, cancels all related requirements and duties,
    and notifies any faculty whose assigned duties were removed.
    """
    absence = db.query(Absence).filter(Absence.id == absence_id).first()
    if not absence:
        return {"success": False, "error": f"Absence #{absence_id} not found."}

    absence.status = "CANCELLED"
    
    # Cancel requirements and duties
    for req in absence.requirements:
        req.status = "CANCELLED"
        if req.duty:
            req.duty.status = "CANCELLED"
            # Notify assigned faculty
            if req.duty.assigned_faculty and req.duty.assigned_faculty.user_id:
                notif = Notification(
                    user_id=req.duty.assigned_faculty.user_id,
                    title=f"Substitution Cancelled: {req.class_section.name}",
                    message=(
                        f"Your substitution duty for {req.class_section.name} on {req.date} "
                        f"({req.period_start}-{req.period_end}) has been cancelled as the original faculty is now available."
                    ),
                    notification_type="SUBSTITUTION_CANCELLED"
                )
                db.add(notif)

    audit = AuditLog(
        event_type="ABSENCE_CANCELLED",
        actor_name=cancelled_by,
        target_type="ABSENCE",
        target_id=absence.id,
        details={
            "absence_id": absence.id,
            "faculty_name": absence.faculty.name,
            "date": str(absence.date)
        }
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"Absence #{absence_id} and associated duties have been cancelled."}
