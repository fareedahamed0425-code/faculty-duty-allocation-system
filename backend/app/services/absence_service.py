from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import (
    Absence, Faculty, TimetableVersion, TimetableEntry,
    SubstitutionRequirement, SubstitutionDuty, AuditLog, Notification, User
)
from app.allocation.constraints import time_overlaps, get_week_bounds
from app.allocation.engine import generate_allocation
from app.allocation.multi_allocator import batch_allocate_requirements


def create_faculty_absence(
    db: Session,
    faculty_id: int,
    absence_date: date,
    end_date: Optional[date] = None,
    leave_type: str = "CASUAL",
    applied_by_role: str = "FACULTY",
    start_time: str = "00:00",
    end_time: str = "23:59",
    is_full_day: bool = True,
    reason: Optional[str] = None,
    reported_by: str = "Admin",
    auto_allocate: bool = True
) -> Dict[str, Any]:
    """
    Records a faculty absence or advance leave (single or multi-day range)
    and AUTOMATICALLY identifies all affected classes across the entire date range
    from the active timetable version. If auto_allocate=True, immediately solves
    and assigns eligible substitute faculty in advance.
    """
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        return {"success": False, "error": f"Faculty #{faculty_id} not found."}

    # Normalize end_date
    final_end_date = end_date if (end_date and end_date >= absence_date) else absence_date

    # Create Absence record
    absence = Absence(
        faculty_id=faculty_id,
        date=absence_date,
        end_date=final_end_date if final_end_date != absence_date else None,
        leave_type=leave_type,
        applied_by_role=applied_by_role,
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

    # Generate dates list from absence_date to final_end_date
    current_curr_date = absence_date
    date_list: List[date] = []
    while current_curr_date <= final_end_date:
        # Exclude Sunday (weekday 6) from class substitutions if normal classes don't run on Sunday
        if current_curr_date.weekday() != 6:
            date_list.append(current_curr_date)
        current_curr_date += timedelta(days=1)

    created_requirements: List[SubstitutionRequirement] = []

    for d in date_list:
        day_of_week = d.weekday()  # 0=Monday..6=Sunday

        # Find affected regular classes on this day of week
        entries = db.query(TimetableEntry).filter(
            TimetableEntry.timetable_version_id == active_version.id,
            TimetableEntry.faculty_id == faculty_id,
            TimetableEntry.day_of_week == day_of_week
        ).all()

        for entry in entries:
            # For first and last days of non-full-day leaves, check time overlap
            is_overlap = is_full_day or time_overlaps(entry.start_time, entry.end_time, start_time, end_time)
            if is_overlap:
                req = SubstitutionRequirement(
                    absence_id=absence.id,
                    date=d,
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
        event_type="ABSENCE_RECORDED" if final_end_date == absence_date else "ADVANCE_LEAVE_RECORDED",
        actor_name=reported_by,
        target_type="ABSENCE",
        target_id=absence.id,
        details={
            "faculty_name": faculty.name,
            "faculty_code": faculty.faculty_id,
            "from_date": str(absence_date),
            "to_date": str(final_end_date),
            "leave_type": leave_type,
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
            actor_name=f"Auto Allocation (Leave by {reported_by})"
        )
        allocation_results = batch_res["results"]

    # Notify the faculty member whose absence was recorded
    target_user = None
    if faculty.user_id:
        target_user = db.query(User).filter(User.id == faculty.user_id).first()
    if not target_user and faculty.email:
        target_user = db.query(User).filter(User.email == faculty.email).first()

    if target_user:
        alloc_cnt = sum(1 for r in created_requirements if r.status == "ALLOCATED")
        tot_cnt = len(created_requirements)
        date_str = str(absence_date) if final_end_date == absence_date else f"{absence_date} to {final_end_date}"
        notif_msg = (
            f"Your absence for {date_str} has been registered. "
            f"{alloc_cnt} of {tot_cnt} affected class(es) have been successfully allocated to substitute faculty."
            if tot_cnt > 0 else
            f"Your absence for {date_str} has been registered. No timetable classes were scheduled for this duration."
        )
        notif = Notification(
            user_id=target_user.id,
            title=f"📅 Absence Registered ({leave_type})",
            message=notif_msg,
            notification_type="LEAVE_APPLIED",
            metadata_json={
                "absence_id": absence.id,
                "from_date": str(absence_date),
                "to_date": str(final_end_date),
                "affected_classes_count": tot_cnt,
                "allocated_count": alloc_cnt
            }
        )
        db.add(notif)
        db.commit()

    requirements_summary: List[Dict[str, Any]] = []
    for req in created_requirements:
        requirements_summary.append({
            "id": req.id,
            "date": str(req.date),
            "class_name": req.class_section.name if req.class_section else "",
            "subject_name": req.subject.name if req.subject else "",
            "period": f"{req.period_start}-{req.period_end}",
            "status": req.status
        })

    return {
        "success": True,
        "absence_id": absence.id,
        "faculty_name": faculty.name,
        "from_date": str(absence_date),
        "to_date": str(final_end_date),
        "leave_type": leave_type,
        "affected_classes_count": len(created_requirements),
        "requirements": requirements_summary,
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
            # Notify assigned substitute faculty
            sub_fac = req.duty.assigned_faculty
            sub_user = None
            if sub_fac:
                if sub_fac.user_id:
                    sub_user = db.query(User).filter(User.id == sub_fac.user_id).first()
                if not sub_user and sub_fac.email:
                    sub_user = db.query(User).filter(User.email == sub_fac.email).first()

            if sub_user:
                notif = Notification(
                    user_id=sub_user.id,
                    title=f"Substitution Cancelled: {req.class_section.name}",
                    message=(
                        f"Your substitution duty for {req.class_section.name} on {req.date} "
                        f"({req.period_start}-{req.period_end}) has been cancelled as the regular faculty (Prof. {absence.faculty.name}) is marked Present."
                    ),
                    notification_type="SUBSTITUTION_CANCELLED",
                    metadata_json={
                        "duty_id": req.duty.id,
                        "date": str(req.date),
                        "period_start": req.period_start,
                        "period_end": req.period_end,
                        "class_name": req.class_section.name if req.class_section else ""
                    }
                )
                db.add(notif)

    # Also notify the regular faculty member who is now marked PRESENT
    if absence.faculty:
        reg_user = None
        if absence.faculty.user_id:
            reg_user = db.query(User).filter(User.id == absence.faculty.user_id).first()
        if not reg_user and absence.faculty.email:
            reg_user = db.query(User).filter(User.email == absence.faculty.email).first()

        if reg_user:
            notif = Notification(
                user_id=reg_user.id,
                title="✓ Marked Present: Timetable Restored",
                message=f"You are now marked PRESENT for {absence.date}. Any temporary substitution duties scheduled in relief have been cancelled.",
                notification_type="ATTENDANCE_UPDATE",
                metadata_json={
                    "absence_id": absence.id,
                    "date": str(absence.date),
                    "status": "PRESENT"
                }
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

