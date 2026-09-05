from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.entities import (
    Faculty, Department, TimetableEntry, TimetableVersion, Absence,
    SubstitutionRequirement, SubstitutionDuty, AuditLog
)
from app.allocation.constraints import get_week_bounds
from app.core.config import settings

def get_dashboard_stats(db: Session, target_date: Optional[date] = None) -> Dict[str, Any]:
    if not target_date:
        target_date = date.today()

    week_start, week_end = get_week_bounds(target_date)

    total_faculty = db.query(Faculty).count()
    active_faculty = db.query(Faculty).filter(Faculty.status == "ACTIVE").count()

    today_absences = db.query(Absence).filter(
        Absence.date == target_date,
        Absence.status != "CANCELLED"
    ).count()

    today_requirements = db.query(SubstitutionRequirement).filter(
        SubstitutionRequirement.date == target_date,
        SubstitutionRequirement.status != "CANCELLED"
    ).all()

    today_affected = len(today_requirements)
    today_allocated = sum(1 for r in today_requirements if r.status == "ALLOCATED")
    today_unallocated = sum(1 for r in today_requirements if r.status == "UNALLOCATED")

    weekly_duties = db.query(SubstitutionDuty).filter(
        SubstitutionDuty.date >= week_start,
        SubstitutionDuty.date <= week_end,
        SubstitutionDuty.status != "CANCELLED"
    ).all()

    weekly_total_substitutions = len(weekly_duties)

    # Calculate duty distribution for all active faculty: count who has 0, 1, 2, 3, 4 duties this week
    faculty_duties_map: Dict[int, int] = {f.id: 0 for f in db.query(Faculty).filter(Faculty.status == "ACTIVE").all()}
    for duty in weekly_duties:
        if duty.assigned_faculty_id in faculty_duties_map:
            faculty_duties_map[duty.assigned_faculty_id] += 1

    duty_dist = {"0": 0, "1": 0, "2": 0, "3": 0, "4+": 0}
    faculty_at_limit = 0
    faculty_near_limit = 0

    for fid, cnt in faculty_duties_map.items():
        if cnt == 0:
            duty_dist["0"] += 1
        elif cnt == 1:
            duty_dist["1"] += 1
        elif cnt == 2:
            duty_dist["2"] += 1
        elif cnt == 3:
            duty_dist["3"] += 1
            faculty_near_limit += 1
        else:
            duty_dist["4+"] += 1
            faculty_at_limit += 1

    # Recent Audit Activities
    recent_audits = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(8).all()
    activities = [
        {
            "id": a.id,
            "event_type": a.event_type,
            "actor_name": a.actor_name,
            "created_at": a.created_at.strftime("%H:%M:%S") if a.created_at else "",
            "details": a.details
        }
        for a in recent_audits
    ]

    # System Alerts (Unallocated classes or faculty approaching limit)
    alerts = []
    if today_unallocated > 0:
        alerts.append({
            "type": "ERROR",
            "title": f"{today_unallocated} Unallocated Substitution(s)",
            "message": "Manual review required. No eligible substitute found within institutional constraints."
        })
    if faculty_at_limit > 0:
        alerts.append({
            "type": "WARNING",
            "title": f"{faculty_at_limit} Faculty at Weekly Limit",
            "message": "Faculty members have reached 4/4 substitutions and cannot be automatically assigned."
        })

    return {
        "today_date": str(target_date),
        "total_faculty": total_faculty,
        "active_faculty": active_faculty,
        "today_absences_count": today_absences,
        "today_affected_classes_count": today_affected,
        "today_allocated_count": today_allocated,
        "today_unallocated_count": today_unallocated,
        "weekly_total_substitutions": weekly_total_substitutions,
        "faculty_at_limit_count": faculty_at_limit,
        "faculty_near_limit_count": faculty_near_limit,
        "duty_distribution": duty_dist,
        "recent_activities": activities,
        "system_alerts": alerts
    }

def get_workload_report(db: Session, target_date: Optional[date] = None) -> List[Dict[str, Any]]:
    if not target_date:
        target_date = date.today()

    week_start, week_end = get_week_bounds(target_date)
    active_version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()

    faculty_list = db.query(Faculty).filter(Faculty.status == "ACTIVE").all()
    report = []

    for f in faculty_list:
        # Regular classes per week
        reg_count = 0
        if active_version:
            reg_count = db.query(TimetableEntry).filter(
                TimetableEntry.timetable_version_id == active_version.id,
                TimetableEntry.faculty_id == f.id
            ).count()

        # Substitutions this week
        sub_count = db.query(SubstitutionDuty).filter(
            SubstitutionDuty.assigned_faculty_id == f.id,
            SubstitutionDuty.date >= week_start,
            SubstitutionDuty.date <= week_end,
            SubstitutionDuty.status != "CANCELLED"
        ).count()

        max_limit = f.max_weekly_substitutions or settings.MAX_WEEKLY_SUBSTITUTIONS
        utilization = round((sub_count / max_limit) * 100.0, 1) if max_limit > 0 else 0.0

        if sub_count >= max_limit:
            status = "AT_LIMIT"
        elif sub_count >= max_limit - 1:
            status = "NEAR_LIMIT"
        else:
            status = "SAFE"

        report.append({
            "faculty_id": f.id,
            "faculty_code": f.faculty_id,
            "name": f.name,
            "department": f.department.name if f.department else "N/A",
            "designation": f.designation,
            "is_exempt": f.is_exempt,
            "is_eligible": f.is_substitution_eligible,
            "regular_classes_per_week": reg_count,
            "substitutions_this_week": sub_count,
            "max_weekly_limit": max_limit,
            "utilization_rate": utilization,
            "status": status
        })

    # Sort by substitutions this week (descending)
    report.sort(key=lambda x: x["substitutions_this_week"], reverse=True)
    return report

def get_department_workload_summary(db: Session, target_date: Optional[date] = None) -> List[Dict[str, Any]]:
    if not target_date:
        target_date = date.today()

    week_start, week_end = get_week_bounds(target_date)
    departments = db.query(Department).all()
    dept_summary = []

    for d in departments:
        faculty_ids = [f.id for f in d.faculty_members if f.status == "ACTIVE"]
        faculty_count = len(faculty_ids)

        sub_count = 0
        if faculty_ids:
            sub_count = db.query(SubstitutionDuty).filter(
                SubstitutionDuty.assigned_faculty_id.in_(faculty_ids),
                SubstitutionDuty.date >= week_start,
                SubstitutionDuty.date <= week_end,
                SubstitutionDuty.status != "CANCELLED"
            ).count()

        dept_summary.append({
            "department_id": d.id,
            "department_code": d.code,
            "department_name": d.name,
            "faculty_count": faculty_count,
            "substitutions_this_week": sub_count,
            "average_substitutions": round(sub_count / faculty_count, 2) if faculty_count > 0 else 0.0
        })

    return dept_summary
