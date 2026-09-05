from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.entities import (
    Faculty, TimetableVersion, TimetableEntry, SubstitutionRequirement,
    SubstitutionDuty, Absence, AuditLog, Notification, ClassSection, Subject
)
from app.allocation.constraints import (
    check_rule_1_free_period,
    check_rule_2_daily_class_limit,
    check_rule_3_weekly_substitution_limit,
    check_rule_4_exempt,
    check_rule_5_absent,
    check_rule_6_no_double_booking,
    get_week_bounds
)
from app.allocation.ranking import rank_eligible_candidates, RankedCandidate
from app.core.config import settings

def get_active_timetable_version(db: Session) -> Optional[TimetableVersion]:
    return db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()

def evaluate_candidates_for_requirement(
    db: Session,
    requirement: SubstitutionRequirement
) -> Dict[str, Any]:
    """
    Evaluates all active faculty against Rules 1-6.
    Returns dictionary with:
    - eligible_candidates: list of candidate dicts
    - rejected_candidates: list of candidate dicts with precise rejection reasons
    - active_version: TimetableVersion
    """
    version = get_active_timetable_version(db)
    if not version:
        return {
            "error": "No active timetable version found in the system.",
            "eligible_candidates": [],
            "rejected_candidates": [],
            "version": None
        }

    all_faculty = db.query(Faculty).all()
    eligible_list: List[Dict[str, Any]] = []
    rejected_list: List[Dict[str, Any]] = []

    target_date = requirement.date
    day_of_week = requirement.day_of_week
    p_start = requirement.period_start
    p_end = requirement.period_end

    for faculty in all_faculty:
        # Don't assign the original absent faculty to their own affected class
        if faculty.id == requirement.original_faculty_id:
            continue

        rejections = []

        # Rule 4: Exemption / Ineligible status
        r4_ok, r4_reason = check_rule_4_exempt(faculty)
        if not r4_ok:
            rejections.append(r4_reason)

        # Rule 5: Absence / Leave on target date
        r5_ok, r5_reason = check_rule_5_absent(db, faculty.id, target_date, p_start, p_end)
        if not r5_ok:
            rejections.append(r5_reason)

        # Rule 1: Free during period (No regular class)
        r1_ok, r1_reason = check_rule_1_free_period(db, version.id, faculty.id, day_of_week, p_start, p_end)
        if not r1_ok:
            rejections.append(r1_reason)

        # Rule 2: Daily regular class limit (< 3 regular classes today)
        r2_ok, daily_classes, r2_reason = check_rule_2_daily_class_limit(
            db, version.id, faculty.id, day_of_week, settings.MAX_DAILY_REGULAR_CLASSES
        )
        if not r2_ok:
            rejections.append(r2_reason)

        # Rule 3: Weekly substitution limit (< 4 substitutions this week)
        r3_ok, weekly_subs, r3_reason = check_rule_3_weekly_substitution_limit(
            db, faculty.id, target_date, faculty.max_weekly_substitutions or settings.MAX_WEEKLY_SUBSTITUTIONS
        )
        if not r3_ok:
            rejections.append(r3_reason)

        # Rule 6: No double booking with existing substitution duties
        r6_ok, r6_reason = check_rule_6_no_double_booking(db, faculty.id, target_date, p_start, p_end)
        if not r6_ok:
            rejections.append(r6_reason)

        cand_data = {
            "faculty": faculty,
            "faculty_id": faculty.id,
            "faculty_name": faculty.name,
            "faculty_code": faculty.faculty_id,
            "department_name": faculty.department.name if faculty.department else "N/A",
            "department_id": faculty.department_id,
            "weekly_substitutions": weekly_subs,
            "daily_regular_classes": daily_classes,
            "is_exempt": faculty.is_exempt,
            "is_absent": not r5_ok,
            "has_timetable_conflict": not r1_ok,
            "has_duty_conflict": not r6_ok,
            "is_eligible": len(rejections) == 0,
            "rejection_reasons": rejections
        }

        if cand_data["is_eligible"]:
            eligible_list.append(cand_data)
        else:
            rejected_list.append(cand_data)

    return {
        "eligible_candidates": eligible_list,
        "rejected_candidates": rejected_list,
        "version": version
    }

def generate_allocation(
    db: Session,
    requirement_id: int,
    actor_name: str = "Automatic Allocation Engine",
    allocation_method: str = "AUTOMATIC"
) -> Dict[str, Any]:
    """
    Executes deterministic allocation for a single requirement:
    1. Loads requirement.
    2. Runs constraint checks.
    3. Ranks candidates via Rule 7.
    4. Selects best candidate or marks UNALLOCATED.
    5. Saves duty, writes audit log, dispatches notification.
    """
    requirement = db.query(SubstitutionRequirement).filter(
        SubstitutionRequirement.id == requirement_id
    ).first()

    if not requirement:
        return {"success": False, "error": f"Requirement #{requirement_id} not found."}

    eval_result = evaluate_candidates_for_requirement(db, requirement)
    if "error" in eval_result and not eval_result.get("version"):
        requirement.status = "UNALLOCATED"
        requirement.unallocated_reason = eval_result["error"]
        db.commit()
        return {"success": False, "error": eval_result["error"]}

    eligible_candidates = eval_result["eligible_candidates"]
    rejected_candidates = eval_result["rejected_candidates"]

    target_class = requirement.class_section
    target_subject = requirement.subject

    if not eligible_candidates:
        # NO ELIGIBLE CANDIDATE
        requirement.status = "UNALLOCATED"
        unallocated_msg = (
            f"No eligible faculty available for {target_class.name} ({requirement.period_start}-{requirement.period_end}). "
            f"All {len(rejected_candidates)} candidates were disqualified due to timetable conflicts, "
            f"reaching the weekly limit (4/4), daily 3-class limit, leaves, or exemptions."
        )
        requirement.unallocated_reason = unallocated_msg
        
        # Log Audit
        audit = AuditLog(
            event_type="ALLOCATION_FAILED_UNALLOCATED",
            actor_name=actor_name,
            target_type="SUBSTITUTION_REQUIREMENT",
            target_id=requirement.id,
            requirement_id=requirement.id,
            details={
                "requirement_id": requirement.id,
                "class": target_class.name,
                "subject": target_subject.code,
                "date": str(requirement.date),
                "period": f"{requirement.period_start}-{requirement.period_end}",
                "status": "UNALLOCATED",
                "rejection_count": len(rejected_candidates),
                "rejected_samples": [
                    {"name": r["faculty_name"], "reasons": r["rejection_reasons"]}
                    for r in rejected_candidates[:10]
                ]
            }
        )
        db.add(audit)
        db.commit()

        return {
            "success": True,
            "status": "UNALLOCATED",
            "requirement_id": requirement.id,
            "class_name": target_class.name,
            "subject_name": f"{target_subject.name} ({target_subject.code})",
            "period": f"{requirement.period_start}-{requirement.period_end}",
            "date": requirement.date,
            "original_faculty_name": requirement.original_faculty.name,
            "selected_faculty": None,
            "eligible_candidates": [],
            "rejected_candidates": rejected_candidates,
            "explanation": unallocated_msg,
            "unallocated_reason": unallocated_msg
        }

    # Rank eligible candidates
    ranked = rank_eligible_candidates(eligible_candidates, target_class, target_subject)
    best_candidate: RankedCandidate = ranked[0]
    selected_faculty = best_candidate.faculty

    # Explanation Generation based on deterministic facts
    explanation_lines = [
        f"{selected_faculty.name} was selected because:",
        f"  • Free during {requirement.period_start}-{requirement.period_end} (no conflicting regular classes).",
        f"  • Has {best_candidate.daily_regular_classes} regular classes today (under daily limit of {settings.MAX_DAILY_REGULAR_CLASSES}).",
        f"  • Has {best_candidate.weekly_substitutions} substitution duties this week (lowest among eligible faculty).",
        f"  • Active, not on leave, and eligible for duty allocation."
    ]
    if best_candidate.department_match:
        explanation_lines.append(f"  • Same department ({selected_faculty.department.name}).")
    if best_candidate.subject_match:
        explanation_lines.append(f"  • Subject expertise match ({target_subject.name}).")

    explanation_str = "\n".join(explanation_lines)

    # Remove any previous active duty for this requirement if re-allocating
    existing_duty = db.query(SubstitutionDuty).filter(
        SubstitutionDuty.requirement_id == requirement.id
    ).first()
    if existing_duty:
        db.delete(existing_duty)
        db.flush()

    # Create new SubstitutionDuty
    duty = SubstitutionDuty(
        requirement_id=requirement.id,
        date=requirement.date,
        day_of_week=requirement.day_of_week,
        period_start=requirement.period_start,
        period_end=requirement.period_end,
        class_section_id=requirement.class_section_id,
        subject_id=requirement.subject_id,
        original_faculty_id=requirement.original_faculty_id,
        assigned_faculty_id=selected_faculty.id,
        allocation_method=allocation_method,
        status="SCHEDULED",
        weekly_count_at_assignment=best_candidate.weekly_substitutions,
        daily_classes_at_assignment=best_candidate.daily_regular_classes,
        allocation_reason=explanation_str
    )
    db.add(duty)
    requirement.status = "ALLOCATED"
    requirement.unallocated_reason = None
    db.flush()

    # Audit Logging
    audit = AuditLog(
        event_type="ALLOCATION_SUCCESSFUL",
        actor_name=actor_name,
        target_type="SUBSTITUTION_DUTY",
        target_id=duty.id,
        requirement_id=requirement.id,
        details={
            "requirement_id": requirement.id,
            "duty_id": duty.id,
            "date": str(requirement.date),
            "period": f"{requirement.period_start}-{requirement.period_end}",
            "class": target_class.name,
            "subject": target_subject.code,
            "original_faculty": requirement.original_faculty.name,
            "assigned_faculty": selected_faculty.name,
            "weekly_count": best_candidate.weekly_substitutions,
            "daily_classes": best_candidate.daily_regular_classes,
            "eligible_count": len(eligible_candidates),
            "rejected_count": len(rejected_candidates),
            "explanation": explanation_str,
            "allocation_method": allocation_method
        }
    )
    db.add(audit)

    # In-app Notification for assigned faculty if user account exists
    if selected_faculty.user_id:
        notif = Notification(
            user_id=selected_faculty.user_id,
            title=f"Substitution Duty Assigned: {target_class.name}",
            message=(
                f"You have been allocated a substitution class for {target_class.name} "
                f"({target_subject.name}) on {requirement.date} from {requirement.period_start} to {requirement.period_end}."
            ),
            notification_type="SUBSTITUTION_ASSIGNED",
            metadata_json={
                "duty_id": duty.id,
                "date": str(requirement.date),
                "period_start": requirement.period_start,
                "period_end": requirement.period_end,
                "class_name": target_class.name,
                "subject_code": target_subject.code
            }
        )
        db.add(notif)

    db.commit()
    db.refresh(duty)

    return {
        "success": True,
        "status": "ALLOCATED",
        "duty_id": duty.id,
        "requirement_id": requirement.id,
        "class_name": target_class.name,
        "subject_name": f"{target_subject.name} ({target_subject.code})",
        "period": f"{requirement.period_start}-{requirement.period_end}",
        "date": requirement.date,
        "original_faculty_name": requirement.original_faculty.name,
        "selected_faculty": {
            "id": selected_faculty.id,
            "name": selected_faculty.name,
            "faculty_id": selected_faculty.faculty_id,
            "department": selected_faculty.department.name if selected_faculty.department else "",
            "weekly_substitutions": best_candidate.weekly_substitutions,
            "daily_regular_classes": best_candidate.daily_regular_classes
        },
        "eligible_candidates": eligible_candidates,
        "rejected_candidates": rejected_candidates,
        "explanation": explanation_str,
        "unallocated_reason": None
    }
