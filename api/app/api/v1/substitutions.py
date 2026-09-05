from datetime import date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import (
    SubstitutionRequirement, SubstitutionDuty, Faculty, TimetableVersion,
    AuditLog, Notification, ClassSection, Subject
)
from app.schemas.schemas import (
    SubstitutionRequirementOut, SubstitutionDutyOut, AllocationResult,
    ManualOverrideRequest, CandidateEvaluation
)
from app.api.deps import get_current_user, require_admin
from app.allocation.engine import (
    evaluate_candidates_for_requirement, generate_allocation
)
from app.allocation.multi_allocator import batch_allocate_requirements
from app.allocation.constraints import (
    check_rule_1_free_period, check_rule_2_daily_class_limit,
    check_rule_3_weekly_substitution_limit, check_rule_4_exempt,
    check_rule_5_absent, check_rule_6_no_double_booking
)
from app.core.config import settings

router = APIRouter()

def enrich_req_out(r: SubstitutionRequirement) -> SubstitutionRequirementOut:
    duty = r.duty
    return SubstitutionRequirementOut(
        id=r.id,
        absence_id=r.absence_id,
        date=r.date,
        day_of_week=r.day_of_week,
        period_start=r.period_start,
        period_end=r.period_end,
        class_section_id=r.class_section_id,
        class_name=r.class_section.name if r.class_section else "Unknown",
        subject_id=r.subject_id,
        subject_code=r.subject.code if r.subject else "N/A",
        subject_name=r.subject.name if r.subject else "N/A",
        original_faculty_id=r.original_faculty_id,
        original_faculty_name=r.original_faculty.name if r.original_faculty else "Unknown",
        status=r.status,
        unallocated_reason=r.unallocated_reason,
        duty_id=duty.id if duty else None,
        assigned_faculty_id=duty.assigned_faculty_id if duty else None,
        assigned_faculty_name=duty.assigned_faculty.name if duty and duty.assigned_faculty else None,
        created_at=r.created_at
    )

def enrich_duty_out(d: SubstitutionDuty) -> SubstitutionDutyOut:
    return SubstitutionDutyOut(
        id=d.id,
        requirement_id=d.requirement_id,
        date=d.date,
        day_of_week=d.day_of_week,
        period_start=d.period_start,
        period_end=d.period_end,
        class_section_id=d.class_section_id,
        class_name=d.class_section.name if d.class_section else "Unknown",
        subject_id=d.subject_id,
        subject_code=d.subject.code if d.subject else "N/A",
        subject_name=d.subject.name if d.subject else "N/A",
        original_faculty_id=d.original_faculty_id,
        original_faculty_name=d.original_faculty.name if d.original_faculty else "Unknown",
        assigned_faculty_id=d.assigned_faculty_id,
        assigned_faculty_name=d.assigned_faculty.name if d.assigned_faculty else "Unknown",
        assigned_faculty_code=d.assigned_faculty.faculty_id if d.assigned_faculty else "N/A",
        allocation_method=d.allocation_method,
        status=d.status,
        weekly_count_at_assignment=d.weekly_count_at_assignment,
        daily_classes_at_assignment=d.daily_classes_at_assignment,
        is_manual_override=d.is_manual_override,
        override_reason=d.override_reason,
        overridden_by=d.overridden_by,
        allocation_reason=d.allocation_reason,
        created_at=d.created_at
    )

@router.get("/requirements", response_model=List[SubstitutionRequirementOut])
def list_requirements(
    status: Optional[str] = None,
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(SubstitutionRequirement)
    if status:
        query = query.filter(SubstitutionRequirement.status == status)
    if target_date:
        query = query.filter(SubstitutionRequirement.date == target_date)

    reqs = query.order_by(SubstitutionRequirement.date.desc(), SubstitutionRequirement.period_start.asc()).all()
    return [enrich_req_out(r) for r in reqs]

@router.get("/requirements/{requirement_id}/candidates")
def get_candidate_evaluations(
    requirement_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Evaluates candidate pool and returns eligible candidates and rejected candidates
    with exact institutional rule violation reasons.
    """
    req = db.query(SubstitutionRequirement).filter(SubstitutionRequirement.id == requirement_id).first()
    if not req:
        raise HTTPException(status_code=404, detail=f"Requirement #{requirement_id} not found.")

    eval_res = evaluate_candidates_for_requirement(db, req)
    return eval_res

@router.post("/requirements/{requirement_id}/allocate")
def trigger_requirement_allocation(
    requirement_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = generate_allocation(
        db=db,
        requirement_id=requirement_id,
        actor_name=current_user.full_name,
        allocation_method="MANUAL_TRIGGER"
    )
    return result

@router.post("/requirements/batch-allocate")
def batch_allocate(
    payload: Dict[str, List[int]],
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    req_ids = payload.get("requirement_ids", [])
    if not req_ids:
        # If empty list, find all PENDING requirements
        pending_reqs = db.query(SubstitutionRequirement).filter(
            SubstitutionRequirement.status.in_(["PENDING", "UNALLOCATED"])
        ).all()
        req_ids = [r.id for r in pending_reqs]

    result = batch_allocate_requirements(
        db=db,
        requirement_ids=req_ids,
        actor_name=f"Batch Run by {admin_user.full_name}"
    )
    return result

@router.get("/duties", response_model=List[SubstitutionDutyOut])
def list_duties(
    assigned_faculty_id: Optional[int] = None,
    target_date: Optional[date] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(SubstitutionDuty)
    if assigned_faculty_id:
        query = query.filter(SubstitutionDuty.assigned_faculty_id == assigned_faculty_id)
    if target_date:
        query = query.filter(SubstitutionDuty.date == target_date)
    if status:
        query = query.filter(SubstitutionDuty.status == status)

    # If current user is standard faculty, restrict to their own duties unless admin/dean/hod
    if current_user.role and current_user.role.name == "FACULTY" and current_user.faculty_profile:
        query = query.filter(SubstitutionDuty.assigned_faculty_id == current_user.faculty_profile.id)

    duties = query.order_by(SubstitutionDuty.date.desc(), SubstitutionDuty.period_start.asc()).all()
    return [enrich_duty_out(d) for d in duties]

@router.get("/duties/{duty_id}/reasoning")
def get_duty_allocation_reasoning(
    duty_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    duty = db.query(SubstitutionDuty).filter(SubstitutionDuty.id == duty_id).first()
    if not duty:
        raise HTTPException(status_code=404, detail=f"Duty #{duty_id} not found.")

    eval_res = evaluate_candidates_for_requirement(db, duty.requirement)
    audit = db.query(AuditLog).filter(
        AuditLog.requirement_id == duty.requirement_id
    ).order_by(AuditLog.created_at.desc()).first()

    return {
        "duty": enrich_duty_out(duty),
        "allocation_reason": duty.allocation_reason,
        "eligible_candidates_count": len(eval_res.get("eligible_candidates", [])),
        "rejected_candidates": eval_res.get("rejected_candidates", []),
        "audit_snapshot": audit.details if audit else {}
    }

@router.post("/duties/{duty_id}/override", response_model=SubstitutionDutyOut)
def manual_override_duty(
    duty_id: int,
    payload: ManualOverrideRequest,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """
    Allows administrator to manually reassign a substitution duty to a chosen faculty member.
    The backend performs hard constraint validation and logs an explicit audit trail.
    """
    duty = db.query(SubstitutionDuty).filter(SubstitutionDuty.id == duty_id).first()
    if not duty:
        raise HTTPException(status_code=404, detail=f"Duty #{duty_id} not found.")

    new_faculty = db.query(Faculty).filter(Faculty.id == payload.assigned_faculty_id).first()
    if not new_faculty:
        raise HTTPException(status_code=404, detail=f"Target faculty #{payload.assigned_faculty_id} not found.")

    version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
    if not version:
        raise HTTPException(status_code=400, detail="No active timetable version found.")

    # Validate against Hard Rules
    rejections = []
    r4_ok, r4_reason = check_rule_4_exempt(new_faculty)
    if not r4_ok:
        rejections.append(r4_reason)

    r5_ok, r5_reason = check_rule_5_absent(db, new_faculty.id, duty.date, duty.period_start, duty.period_end)
    if not r5_ok:
        rejections.append(r5_reason)

    r1_ok, r1_reason = check_rule_1_free_period(db, version.id, new_faculty.id, duty.day_of_week, duty.period_start, duty.period_end)
    if not r1_ok:
        rejections.append(r1_reason)

    r2_ok, daily_classes, r2_reason = check_rule_2_daily_class_limit(
        db, version.id, new_faculty.id, duty.day_of_week, settings.MAX_DAILY_REGULAR_CLASSES
    )
    if not r2_ok:
        rejections.append(r2_reason)

    r3_ok, weekly_subs, r3_reason = check_rule_3_weekly_substitution_limit(
        db, new_faculty.id, duty.date, new_faculty.max_weekly_substitutions or settings.MAX_WEEKLY_SUBSTITUTIONS, exclude_duty_id=duty.id
    )
    if not r3_ok:
        rejections.append(r3_reason)

    r6_ok, r6_reason = check_rule_6_no_double_booking(
        db, new_faculty.id, duty.date, duty.period_start, duty.period_end, exclude_duty_id=duty.id
    )
    if not r6_ok:
        rejections.append(r6_reason)

    if rejections and not payload.force_ignore_rules:
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Selection violates institutional constraints.",
                "violations": rejections
            }
        )

    prev_assigned_name = duty.assigned_faculty.name if duty.assigned_faculty else "Unknown"
    prev_faculty_id = duty.assigned_faculty_id

    # Update Duty
    duty.original_candidate_id = prev_faculty_id
    duty.assigned_faculty_id = new_faculty.id
    duty.is_manual_override = True
    duty.override_reason = payload.reason
    duty.overridden_by = admin_user.full_name
    duty.allocation_method = "MANUAL_OVERRIDE"
    duty.weekly_count_at_assignment = weekly_subs
    duty.daily_classes_at_assignment = daily_classes
    duty.allocation_reason = (
        f"Manually assigned by {admin_user.full_name}. Reason: {payload.reason}"
        + (f" [Exceptions granted: {', '.join(rejections)}]" if rejections else "")
    )
    db.flush()

    # Log Audit Trail
    audit = AuditLog(
        event_type="MANUAL_OVERRIDE_COMMITTED",
        actor_name=admin_user.full_name,
        target_type="SUBSTITUTION_DUTY",
        target_id=duty.id,
        requirement_id=duty.requirement_id,
        details={
            "duty_id": duty.id,
            "previous_faculty": prev_assigned_name,
            "new_faculty": new_faculty.name,
            "reason": payload.reason,
            "rule_violations_bypassed": rejections if payload.force_ignore_rules else []
        }
    )
    db.add(audit)

    # In-app notifications
    if new_faculty.user_id:
        notif_new = Notification(
            user_id=new_faculty.user_id,
            title=f"Manual Duty Assignment: {duty.class_section.name}",
            message=f"You have been assigned a substitution duty by administration for {duty.class_section.name} on {duty.date} ({duty.period_start}-{duty.period_end}).",
            notification_type="MANUAL_OVERRIDE"
        )
        db.add(notif_new)

    db.commit()
    db.refresh(duty)
    return enrich_duty_out(duty)
