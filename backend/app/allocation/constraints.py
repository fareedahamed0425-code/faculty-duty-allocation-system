from datetime import date, datetime, timedelta
from typing import List, Tuple, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.entities import (
    Faculty, TimetableEntry, SubstitutionDuty, Absence, SystemRule
)

def get_week_bounds(target_date: date, week_start_day: int = 0) -> Tuple[date, date]:
    """
    Returns (start_date, end_date) for the week containing target_date.
    week_start_day: 0 = Monday (default), 6 = Sunday.
    """
    # target_date.weekday() is 0 for Monday..6 for Sunday
    current_weekday = target_date.weekday()
    diff = (current_weekday - week_start_day) % 7
    start_date = target_date - timedelta(days=diff)
    end_date = start_date + timedelta(days=6)
    return start_date, end_date

def time_overlaps(start1: str, end1: str, start2: str, end2: str) -> bool:
    """Check if time range [start1, end1) overlaps with [start2, end2)."""
    return max(start1, start2) < min(end1, end2)

def check_rule_1_free_period(
    db: Session,
    timetable_version_id: int,
    faculty_id: int,
    day_of_week: int,
    period_start: str,
    period_end: str
) -> Tuple[bool, Optional[str]]:
    """
    RULE 1: Faculty must be free during the exact period (no regular class).
    Returns (is_free, conflict_description)
    """
    entries = db.query(TimetableEntry).filter(
        TimetableEntry.timetable_version_id == timetable_version_id,
        TimetableEntry.faculty_id == faculty_id,
        TimetableEntry.day_of_week == day_of_week
    ).all()

    for entry in entries:
        if time_overlaps(entry.start_time, entry.end_time, period_start, period_end):
            class_name = entry.class_section.name if entry.class_section else "Unknown Class"
            subject_name = entry.subject.code if entry.subject else "Class"
            return False, f"Regular class conflict with {class_name} ({subject_name}) at {entry.start_time}-{entry.end_time}"
            
    return True, None

def check_rule_2_daily_class_limit(
    db: Session,
    timetable_version_id: int,
    faculty_id: int,
    day_of_week: int,
    max_daily_classes: int = 2
) -> Tuple[bool, int, Optional[str]]:
    """
    RULE 2: If a faculty member has >= 3 regular classes that day, NOT ELIGIBLE.
    0, 1, 2 regular classes -> ELIGIBLE.
    >= 3 regular classes -> NOT ELIGIBLE.
    Returns (is_eligible, regular_class_count, rejection_reason)
    """
    count = db.query(TimetableEntry).filter(
        TimetableEntry.timetable_version_id == timetable_version_id,
        TimetableEntry.faculty_id == faculty_id,
        TimetableEntry.day_of_week == day_of_week
    ).count()

    if count > max_daily_classes:
        return False, count, f"Has {count} regular classes today (maximum allowed for substitution is {max_daily_classes})"
    return True, count, None

def check_rule_3_weekly_substitution_limit(
    db: Session,
    faculty_id: int,
    target_date: date,
    max_weekly_substitutions: int = 4,
    exclude_duty_id: Optional[int] = None
) -> Tuple[bool, int, Optional[str]]:
    """
    RULE 3: Faculty can receive a maximum of 4 substitution duties in one week.
    0, 1, 2, 3 -> ELIGIBLE.
    4 -> NOT ELIGIBLE.
    Returns (is_eligible, current_weekly_count, rejection_reason)
    """
    week_start, week_end = get_week_bounds(target_date)
    
    query = db.query(SubstitutionDuty).filter(
        SubstitutionDuty.assigned_faculty_id == faculty_id,
        SubstitutionDuty.date >= week_start,
        SubstitutionDuty.date <= week_end,
        SubstitutionDuty.status != "CANCELLED"
    )
    if exclude_duty_id:
        query = query.filter(SubstitutionDuty.id != exclude_duty_id)
        
    count = query.count()

    if count >= max_weekly_substitutions:
        return False, count, f"Reached weekly limit of {max_weekly_substitutions} substitutions ({count}/{max_weekly_substitutions} assigned this week)"
    return True, count, None

def check_rule_4_exempt(
    faculty: Faculty
) -> Tuple[bool, Optional[str]]:
    """
    RULE 4: Exempt faculty / Non-eligible faculty must not be assigned.
    Returns (is_eligible, rejection_reason)
    """
    if faculty.is_exempt:
        return False, f"Faculty is exempt from substitution duties (Designation/Role: {faculty.designation})"
    if not faculty.is_substitution_eligible:
        return False, "Faculty is marked as not eligible for substitution duties"
    if faculty.status != "ACTIVE":
        return False, f"Faculty account status is {faculty.status}"
    return True, None

def check_rule_5_absent(
    db: Session,
    faculty_id: int,
    target_date: date,
    period_start: str,
    period_end: str
) -> Tuple[bool, Optional[str]]:
    """
    RULE 5: Absent/unavailable faculty cannot be selected.
    Returns (is_available, rejection_reason)
    """
    absences = db.query(Absence).filter(
        Absence.faculty_id == faculty_id,
        Absence.date == target_date,
        Absence.status != "CANCELLED"
    ).all()

    for absence in absences:
        if absence.is_full_day:
            return False, f"Faculty is marked absent on {target_date} (Reason: {absence.reason or 'Not specified'})"
        if time_overlaps(absence.start_time, absence.end_time, period_start, period_end):
            return False, f"Faculty is on partial leave from {absence.start_time} to {absence.end_time}"
            
    return True, None

def check_rule_6_no_double_booking(
    db: Session,
    faculty_id: int,
    target_date: date,
    period_start: str,
    period_end: str,
    exclude_duty_id: Optional[int] = None
) -> Tuple[bool, Optional[str]]:
    """
    RULE 6: No double booking with existing substitution duties.
    Returns (has_no_conflict, rejection_reason)
    """
    query = db.query(SubstitutionDuty).filter(
        SubstitutionDuty.assigned_faculty_id == faculty_id,
        SubstitutionDuty.date == target_date,
        SubstitutionDuty.status != "CANCELLED"
    )
    if exclude_duty_id:
        query = query.filter(SubstitutionDuty.id != exclude_duty_id)
        
    duties = query.all()
    for duty in duties:
        if time_overlaps(duty.period_start, duty.period_end, period_start, period_end):
            class_name = duty.class_section.name if duty.class_section else "another class"
            return False, f"Already assigned substitution for {class_name} at {duty.period_start}-{duty.period_end}"
            
    return True, None
