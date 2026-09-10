import io
import re
import uuid
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.entities import (
    ExamDuty, Faculty, Department, ClassSection, Subject, Notification, AuditLog, User, Absence, TimetableVersion, TimetableEntry, SubstitutionDuty
)
from app.services.timetable_service import find_matched_column, normalize_time_str, parse_time_slot

EXAM_NAME_ALIASES = ["exam_name", "exam", "examination", "exam_title", "title", "test_name", "test"]
COURSE_CODE_ALIASES = ["course_code", "subject_code", "sub_code", "course", "subject_id", "code"]
COURSE_NAME_ALIASES = ["course_name", "subject_name", "course", "subject", "sub_name", "paper"]
CLASS_ALIASES = ["class_name", "class", "section", "branch", "batch", "class_section", "dept_class"]
DATE_ALIASES = ["date", "exam_date", "day_date", "schedule_date"]
START_TIME_ALIASES = ["start_time", "exam_start", "start", "from_time", "exam_start_time"]
END_TIME_ALIASES = ["end_time", "exam_end", "end", "to_time", "exam_end_time"]
COMBINED_TIME_ALIASES = ["time", "timing", "time_slot", "slot", "duration", "exam_time", "period"]
REPORTING_TIME_ALIASES = ["reporting_time", "report_time", "reporting", "assembly_time"]
VENUE_ALIASES = ["venue", "room", "hall", "exam_hall", "room_number", "room_no", "location"]
FACULTY_ALIASES = ["faculty", "faculty_code", "faculty_id", "invigilator", "faculty_name", "assigned_faculty"]
INVIGILATORS_COUNT_ALIASES = ["invigilators", "invigilators_count", "required_count", "count", "num_invigilators", "staff_count"]
ROLE_ALIASES = ["role", "role_type", "duty_type", "invigilator_role"]

def parse_time_to_minutes(time_str: str) -> int:
    """Convert '09:00 AM', '9:30', '14:00', '1:00 PM' to minutes past midnight."""
    if not time_str:
        return 0
    t = str(time_str).strip().upper()
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
    return max(start1_min, start2_min) < min(end1_min, end2_min)

def normalize_date_str(val: Any) -> Optional[date]:
    """Parse dates in ISO, DD-MM-YYYY, MM/DD/YYYY formats."""
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.date()
    if isinstance(val, date):
        return val
    s = str(val).strip()
    for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d.%m.%Y"]:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None

def parse_and_validate_exam_timetable(
    db: Session,
    file_bytes: bytes,
    filename: str
) -> Dict[str, Any]:
    """
    Parses exam timetable spreadsheet (CSV/Excel) and validates records.
    Returns preview entries and diagnostics.
    """
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            return {"error": "Unsupported file format. Please upload CSV or Excel (.xlsx / .xls)."}
    except Exception as e:
        return {"error": f"Failed to read file: {str(e)}"}

    if df.empty:
        return {"error": "Uploaded exam timetable spreadsheet is empty."}

    columns = list(df.columns)
    exam_col = find_matched_column(columns, EXAM_NAME_ALIASES)
    code_col = find_matched_column(columns, COURSE_CODE_ALIASES)
    name_col = find_matched_column(columns, COURSE_NAME_ALIASES)
    class_col = find_matched_column(columns, CLASS_ALIASES)
    date_col = find_matched_column(columns, DATE_ALIASES)
    start_col = find_matched_column(columns, START_TIME_ALIASES)
    end_col = find_matched_column(columns, END_TIME_ALIASES)
    combined_time_col = find_matched_column(columns, COMBINED_TIME_ALIASES)
    reporting_col = find_matched_column(columns, REPORTING_TIME_ALIASES)
    venue_col = find_matched_column(columns, VENUE_ALIASES)
    faculty_col = find_matched_column(columns, FACULTY_ALIASES)
    count_col = find_matched_column(columns, INVIGILATORS_COUNT_ALIASES)
    role_col = find_matched_column(columns, ROLE_ALIASES)

    # Validate essential columns
    missing = []
    if not (code_col or name_col or exam_col):
        missing.append("Course / Exam Name")
    if not date_col:
        missing.append("Exam Date")
    if not (start_col or combined_time_col):
        missing.append("Exam Time Slot or Start Time")

    if missing:
        return {
            "error": f"Missing required columns in exam timetable: {', '.join(missing)}.",
            "detected_columns": columns
        }

    preview_entries = []
    errors = []
    valid_count = 0

    for idx, row in df.iterrows():
        row_num = idx + 2
        
        # 1. Exam Name
        exam_name_val = str(row[exam_col]).strip() if exam_col and not pd.isna(row[exam_col]) else "Semester Examination 2026"
        
        # 2. Course Code & Name
        code_val = str(row[code_col]).strip() if code_col and not pd.isna(row[code_col]) else "EXAM"
        name_val = str(row[name_col]).strip() if name_col and not pd.isna(row[name_col]) else (code_val if code_val != "EXAM" else exam_name_val)

        # 3. Class section
        class_val = str(row[class_col]).strip() if class_col and not pd.isna(row[class_col]) else "All Sections"

        # 4. Date
        date_raw = row[date_col] if date_col and not pd.isna(row[date_col]) else None
        parsed_date = normalize_date_str(date_raw)
        if not parsed_date:
            errors.append(f"Row {row_num}: Invalid or missing date format '{date_raw}'.")
            continue

        # 5. Times
        start_time_val = None
        end_time_val = None
        if combined_time_col and not pd.isna(row[combined_time_col]):
            s_val, e_val = parse_time_slot(str(row[combined_time_col]))
            if not s_val:
                s_val = normalize_time_str(str(row[combined_time_col]))
            start_time_val = s_val
            end_time_val = e_val

        if not start_time_val and start_col and not pd.isna(row[start_col]):
            start_time_val = normalize_time_str(str(row[start_col]))
        if not end_time_val and end_col and not pd.isna(row[end_col]):
            end_time_val = normalize_time_str(str(row[end_col]))

        if not start_time_val:
            start_time_val = "09:30"
        if not end_time_val:
            # Default +3 hours from start
            s_min = parse_time_to_minutes(start_time_val)
            e_min = s_min + 180
            end_time_val = f"{e_min // 60:02d}:{e_min % 60:02d}"

        # 6. Reporting time (default 30 mins prior to exam start)
        if reporting_col and not pd.isna(row[reporting_col]):
            reporting_val = normalize_time_str(str(row[reporting_col])) or "09:00"
        else:
            s_min = parse_time_to_minutes(start_time_val)
            r_min = max(0, s_min - 30)
            reporting_val = f"{r_min // 60:02d}:{r_min % 60:02d}"

        # 7. Venue
        venue_val = str(row[venue_col]).strip() if venue_col and not pd.isna(row[venue_col]) else "Main Exam Hall"

        # 8. Faculty or Invigilator count
        faculty_val = str(row[faculty_col]).strip() if faculty_col and not pd.isna(row[faculty_col]) else "DYNAMIC"
        count_val = 1
        if count_col and not pd.isna(row[count_col]):
            try:
                count_val = max(1, int(row[count_col]))
            except ValueError:
                count_val = 1

        role_val = str(row[role_col]).strip() if role_col and not pd.isna(row[role_col]) else "Room Invigilator"

        entry = {
            "row_num": row_num,
            "exam_name": exam_name_val,
            "course_code": code_val,
            "course_name": name_val,
            "class_name": class_val,
            "date": str(parsed_date),
            "reporting_time": reporting_val,
            "exam_start_time": start_time_val,
            "exam_end_time": end_time_val,
            "venue": venue_val,
            "faculty_assigned": faculty_val,
            "invigilators_count": count_val,
            "role_type": role_val
        }
        preview_entries.append(entry)
        valid_count += 1

    return {
        "filename": filename,
        "total_rows": len(df),
        "valid_rows_count": valid_count,
        "error_count": len(errors),
        "errors": errors,
        "preview_entries": preview_entries[:50],
        "all_valid_entries": preview_entries
    }


def execute_exam_timetable_import_and_dispatch(
    db: Session,
    entries: List[Dict[str, Any]],
    current_user: Any
) -> Dict[str, Any]:
    """
    Commits batch exam schedule entries.
    Dynamically balances & allocates invigilators, generates notifications,
    and updates timetable exam sessions.
    """
    active_tt = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
    all_faculties = db.query(Faculty).filter(Faculty.status == "ACTIVE").all()
    faculty_by_code = {f.faculty_id.upper(): f for f in all_faculties}
    faculty_by_name = {f.name.lower(): f for f in all_faculties}

    allocated_duties = []
    dispatched_notifications = 0

    for entry in entries:
        exam_date = normalize_date_str(entry["date"])
        if not exam_date:
            continue

        exam_name = entry.get("exam_name", "Semester Examination 2026")
        course_code = entry.get("course_code")
        course_name = entry.get("course_name", "Course Examination")
        reporting_time = entry.get("reporting_time", "09:00")
        start_time = entry.get("exam_start_time", "09:30")
        end_time = entry.get("exam_end_time", "12:30")
        venue = entry.get("venue", "Exam Hall")
        role_type = entry.get("role_type", "Room Invigilator")
        assigned_val = str(entry.get("faculty_assigned", "DYNAMIC")).strip()
        invigilator_count = max(1, int(entry.get("invigilators_count", 1)))

        start_min = parse_time_to_minutes(start_time)
        end_min = parse_time_to_minutes(end_time)
        if end_min <= start_min:
            end_min = start_min + 180

        chosen_faculties: List[Faculty] = []

        # Case A: Specific Faculty Code/Name provided in spreadsheet
        if assigned_val.upper() not in ["DYNAMIC", "AUTO", "ANY", "NONE", ""]:
            fac = faculty_by_code.get(assigned_val.upper()) or faculty_by_name.get(assigned_val.lower())
            if fac:
                chosen_faculties.append(fac)

        # Case B: Dynamic Smart Allocation
        if len(chosen_faculties) < invigilator_count:
            needed = invigilator_count - len(chosen_faculties)
            already_chosen_ids = {f.id for f in chosen_faculties}
            
            weekday = exam_date.weekday()
            available = []

            for fac in all_faculties:
                if fac.id in already_chosen_ids:
                    continue

                # 1. Leave Check
                on_leave = db.query(Absence).filter(
                    Absence.faculty_id == fac.id,
                    Absence.date <= exam_date,
                    or_(Absence.end_date == None, Absence.end_date >= exam_date),
                    Absence.status.in_(["CONFIRMED", "REPORTED", "APPROVED", "PENDING"])
                ).first()
                if on_leave:
                    continue

                # 2. Existing Exam Duty Overlap
                existing_ed = db.query(ExamDuty).filter(
                    ExamDuty.assigned_faculty_id == fac.id,
                    ExamDuty.date == exam_date,
                    ExamDuty.status.in_(["SCHEDULED", "ACKNOWLEDGED"])
                ).all()
                has_exam_conflict = False
                for ed in existing_ed:
                    ed_s = parse_time_to_minutes(ed.exam_start_time)
                    ed_e = parse_time_to_minutes(ed.exam_end_time)
                    if intervals_overlap(start_min, end_min, ed_s, ed_e):
                        has_exam_conflict = True
                        break
                if has_exam_conflict:
                    continue

                # 3. Regular Class Conflict
                if active_tt:
                    tt_entries = db.query(TimetableEntry).filter(
                        TimetableEntry.timetable_version_id == active_tt.id,
                        TimetableEntry.faculty_id == fac.id,
                        TimetableEntry.day_of_week == weekday
                    ).all()
                    has_tt_conflict = False
                    for tte in tt_entries:
                        tt_s = parse_time_to_minutes(tte.start_time)
                        tt_e = parse_time_to_minutes(tte.end_time)
                        if intervals_overlap(start_min, end_min, tt_s, tt_e):
                            has_tt_conflict = True
                            break
                    if has_tt_conflict:
                        continue

                # Count current exam duties for load balance
                duty_count = db.query(ExamDuty).filter(
                    ExamDuty.assigned_faculty_id == fac.id,
                    ExamDuty.status != "CANCELLED"
                ).count()

                sub_count = db.query(SubstitutionDuty).filter(
                    SubstitutionDuty.assigned_faculty_id == fac.id,
                    SubstitutionDuty.status != "CANCELLED"
                ).count()

                available.append({
                    "faculty": fac,
                    "duty_count": duty_count,
                    "sub_count": sub_count
                })

            available.sort(key=lambda x: (x["duty_count"], x["sub_count"], x["faculty"].name))
            for cand in available[:needed]:
                chosen_faculties.append(cand["faculty"])

        # Create ExamDuty records and Notifications for each chosen faculty
        for fac in chosen_faculties:
            duty = ExamDuty(
                exam_name=exam_name,
                course_code=course_code,
                course_name=course_name,
                date=exam_date,
                reporting_time=reporting_time,
                exam_start_time=start_time,
                exam_end_time=end_time,
                venue=venue,
                assigned_faculty_id=fac.id,
                role_type=role_type,
                allotted_by=current_user.full_name if hasattr(current_user, "full_name") else "Academic Controller",
                target_roles=["FACULTY", "DEAN", "PC"],
                status="SCHEDULED",
                instructions=f"Official university examination invigilation duty for {course_name}."
            )
            db.add(duty)
            db.flush()
            allocated_duties.append(duty)

            # Send rich interactive notification card to the assigned faculty
            if fac.user_id:
                notif = Notification(
                    user_id=fac.user_id,
                    title=f"📋 Exam Duty Scheduled: {exam_name}",
                    message=(
                        f"You have been allotted {role_type} for {course_name} on {exam_date}. "
                        f"Reporting: {reporting_time} | Exam: {start_time}-{end_time} | Venue: {venue}"
                    ),
                    notification_type="EXAM_DUTY_ALLOCATED",
                    metadata_json={
                        "duty_id": duty.id,
                        "exam_name": exam_name,
                        "course_code": course_code,
                        "course_name": course_name,
                        "date": str(exam_date),
                        "reporting_time": reporting_time,
                        "exam_start_time": start_time,
                        "exam_end_time": end_time,
                        "venue": venue,
                        "role_type": role_type,
                        "allotted_by": current_user.full_name if hasattr(current_user, "full_name") else "Controller of Exams"
                    }
                )
                db.add(notif)
                dispatched_notifications += 1

    # Log audit event
    audit = AuditLog(
        event_type="BATCH_EXAM_TIMETABLE_DISPATCHED",
        actor_name=current_user.full_name if hasattr(current_user, "full_name") else "Admin",
        target_type="EXAM_DUTY_BATCH",
        details={
            "total_exam_slots": len(entries),
            "allocated_invigilators_count": len(allocated_duties),
            "notifications_dispatched": dispatched_notifications
        }
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "total_exam_slots": len(entries),
        "total_invigilators_allocated": len(allocated_duties),
        "notifications_dispatched": dispatched_notifications,
        "message": f"Successfully processed {len(entries)} exam slots and dynamically allocated {len(allocated_duties)} invigilation duties with instant notifications!"
    }
