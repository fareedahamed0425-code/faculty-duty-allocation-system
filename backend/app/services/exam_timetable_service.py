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
COURSE_CODE_ALIASES = ["course_code", "subject_code", "sub_code", "course", "subject_id", "code", "paper_code"]
COURSE_NAME_ALIASES = ["course_name", "subject_name", "course", "subject", "sub_name", "paper", "paper_title"]
CLASS_ALIASES = ["class_name", "class", "section", "branch", "batch", "class_section", "dept_class", "cohort"]
DEPARTMENT_ALIASES = ["department", "dept", "department_code", "dept_code", "program", "course_dept"]
SEMESTER_ALIASES = ["semester", "sem", "term", "academic_semester", "exam_sem", "year_sem"]
DATE_ALIASES = ["date", "exam_date", "day_date", "schedule_date"]
START_TIME_ALIASES = ["start_time", "exam_start", "start", "from_time", "exam_start_time"]
END_TIME_ALIASES = ["end_time", "exam_end", "end", "to_time", "exam_end_time"]
COMBINED_TIME_ALIASES = ["time", "timing", "time_slot", "slot", "duration", "exam_time", "period", "session_time"]
REPORTING_TIME_ALIASES = ["reporting_time", "report_time", "reporting", "assembly_time"]
VENUE_ALIASES = ["venue", "room", "hall", "exam_hall", "room_number", "room_no", "location", "hall_no"]
FACULTY_ALIASES = ["faculty", "faculty_code", "faculty_id", "invigilator", "faculty_name", "assigned_faculty"]
INVIGILATORS_COUNT_ALIASES = ["invigilators", "invigilators_count", "required_count", "count", "num_invigilators", "staff_count"]
ROLE_ALIASES = ["role", "role_type", "duty_type", "invigilator_role"]

APPROVED_DEPTS = ["AIDS", "AIML", "CSE", "CS", "CC", "AIHC"]

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

def infer_department_code(text: str) -> str:
    """Matches text against the 6 approved university departments."""
    upper = text.upper()
    for code in APPROVED_DEPTS:
        if re.search(r'\b' + re.escape(code) + r'\b', upper):
            return code
    if "DATA SCIENCE" in upper or "DATA" in upper:
        return "AIDS"
    if "MACHINE LEARNING" in upper or "AIML" in upper:
        return "AIML"
    if "COMPUTER SCIENCE" in upper or "CSE" in upper:
        return "CSE"
    if "CYBER" in upper or "SECURITY" in upper:
        return "CS"
    if "CLOUD" in upper:
        return "CC"
    if "HEALTH" in upper or "MEDICAL" in upper:
        return "AIHC"
    return "CSE"

def infer_semester_and_year(text: str) -> Tuple[int, int]:
    """Infers semester (1-8) and academic year (1-4)."""
    upper = text.upper()
    m_sem = re.search(r'(?:SEM|SEMESTER)\s*[:=-]?\s*([1-8])', upper)
    if m_sem:
        sem = int(m_sem.group(1))
        year = (sem + 1) // 2
        return sem, year

    if "IV " in upper or "4TH" in upper or "YEAR 4" in upper or "SEM 7" in upper or "SEM 8" in upper:
        return 7, 4
    if "III " in upper or "3RD" in upper or "YEAR 3" in upper or "SEM 5" in upper or "SEM 6" in upper:
        return 5, 3
    if "II " in upper or "2ND" in upper or "YEAR 2" in upper or "SEM 3" in upper or "SEM 4" in upper:
        return 3, 2
    if "I " in upper or "1ST" in upper or "YEAR 1" in upper or "SEM 1" in upper or "SEM 2" in upper:
        return 1, 1

    return 1, 1

def parse_and_validate_exam_timetable(
    db: Session,
    file_bytes: bytes,
    filename: str
) -> Dict[str, Any]:
    """
    Parses exam timetable spreadsheet (CSV/Excel) across multiple courses and semesters.
    Returns segregated preview entries, course breakdowns, and batch diagnostics.
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
    dept_col = find_matched_column(columns, DEPARTMENT_ALIASES)
    sem_col = find_matched_column(columns, SEMESTER_ALIASES)
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
        missing.append("Course / Subject / Exam Name")
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
        code_val = str(row[code_col]).strip().upper() if code_col and not pd.isna(row[code_col]) else "EXAM"
        name_val = str(row[name_col]).strip() if name_col and not pd.isna(row[name_col]) else (code_val if code_val != "EXAM" else exam_name_val)

        # 3. Class section
        class_val = str(row[class_col]).strip() if class_col and not pd.isna(row[class_col]) else "All Sections"

        # 4. Department / Course Code & Semester
        raw_dept_str = str(row[dept_col]).strip() if dept_col and not pd.isna(row[dept_col]) else f"{class_val} {code_val} {name_val}"
        dept_code_val = infer_department_code(raw_dept_str)

        raw_sem_str = str(row[sem_col]).strip() if sem_col and not pd.isna(row[sem_col]) else f"{class_val} {name_val}"
        sem_val, year_val = infer_semester_and_year(raw_sem_str)

        # 5. Date
        date_raw = row[date_col] if date_col and not pd.isna(row[date_col]) else None
        parsed_date = normalize_date_str(date_raw)
        if not parsed_date:
            errors.append(f"Row {row_num}: Invalid or missing date format '{date_raw}'.")
            continue

        # 6. Times
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

        start_time_val = start_time_val or "09:30"
        end_time_val = end_time_val or "12:30"

        # 7. Reporting Time
        reporting_val = None
        if reporting_col and not pd.isna(row[reporting_col]):
            reporting_val = normalize_time_str(str(row[reporting_col]))
        if not reporting_val:
            s_min = parse_time_to_minutes(start_time_val)
            rep_min = max(0, s_min - 30)
            reporting_val = f"{rep_min // 60:02d}:{rep_min % 60:02d}"

        # 8. Venue & Staff requirements
        venue_val = str(row[venue_col]).strip() if venue_col and not pd.isna(row[venue_col]) else "Exam Hall B-204"
        faculty_val = str(row[faculty_col]).strip() if faculty_col and not pd.isna(row[faculty_col]) else "DYNAMIC"
        
        count_val = 1
        if count_col and not pd.isna(row[count_col]):
            try:
                count_val = max(1, int(float(str(row[count_col]))))
            except ValueError:
                count_val = 1

        role_val = str(row[role_col]).strip() if role_col and not pd.isna(row[role_col]) else "Room Invigilator"

        entry = {
            "row_num": row_num,
            "exam_name": exam_name_val,
            "course_code": code_val,
            "course_name": name_val,
            "class_section": class_val,
            "department_code": dept_code_val,
            "semester": sem_val,
            "academic_year": year_val,
            "date": parsed_date.strftime("%Y-%m-%d"),
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

    # Segregation metrics breakdown across courses & semesters
    course_breakdown = {}
    semester_breakdown = {}
    venue_breakdown = {}

    for e in preview_entries:
        c_code = e["department_code"]
        course_breakdown[c_code] = course_breakdown.get(c_code, 0) + 1

        s_num = f"Semester {e['semester']} (Year {e['academic_year']})"
        semester_breakdown[s_num] = semester_breakdown.get(s_num, 0) + 1

        v_name = e["venue"]
        venue_breakdown[v_name] = venue_breakdown.get(v_name, 0) + 1

    return {
        "filename": filename,
        "total_rows": len(df),
        "valid_rows_count": valid_count,
        "error_count": len(errors),
        "errors": errors,
        "course_breakdown": course_breakdown,
        "semester_breakdown": semester_breakdown,
        "venue_breakdown": venue_breakdown,
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
    Dynamically balances & allocates invigilators using mathematical constraint scoring,
    dispatches unified notifications, and integrates with the active timetable.
    """
    active_tt = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
    
    # Filter only active, non-exempt teaching faculty
    all_faculties = db.query(Faculty).filter(
        Faculty.status == "ACTIVE",
        Faculty.is_exempt == False,
        Faculty.is_substitution_eligible == True
    ).all()

    # Fallback to all active faculties if filtered pool is too small
    if not all_faculties:
        all_faculties = db.query(Faculty).filter(Faculty.status == "ACTIVE").all()

    faculty_by_code = {f.faculty_id.upper(): f for f in all_faculties}
    faculty_by_name = {f.name.lower(): f for f in all_faculties}

    allocated_duties = []
    dispatched_notifications = 0

    # Track duties assigned during this batch run to guarantee intra-batch balance
    batch_duty_counts = {f.id: 0 for f in all_faculties}
    faculty_daily_assignments = {}  # (faculty_id, exam_date) -> count

    for entry in entries:
        exam_date = normalize_date_str(entry["date"])
        if not exam_date:
            continue

        exam_name = entry.get("exam_name", "Semester Examination 2026")
        course_code = entry.get("course_code", "EXAM")
        course_name = entry.get("course_name", "Course Examination")
        dept_code = entry.get("department_code", "CSE")
        reporting_time = entry.get("reporting_time", "09:00")
        start_time = entry.get("exam_start_time", "09:30")
        end_time = entry.get("exam_end_time", "12:30")
        venue = entry.get("venue", "Exam Hall B-204")
        role_type = entry.get("role_type", "Room Invigilator")
        assigned_val = str(entry.get("faculty_assigned", "DYNAMIC")).strip()
        invigilator_count = max(1, int(entry.get("invigilators_count", 1)))

        start_min = parse_time_to_minutes(start_time)
        end_min = parse_time_to_minutes(end_time)
        if end_min <= start_min:
            end_min = start_min + 180

        chosen_faculties: List[Faculty] = []

        # Case A: Specific Faculty Code or Name provided in spreadsheet
        if assigned_val.upper() not in ["DYNAMIC", "AUTO", "ANY", "NONE", ""]:
            fac = faculty_by_code.get(assigned_val.upper()) or faculty_by_name.get(assigned_val.lower())
            if fac:
                chosen_faculties.append(fac)

        # Case B: Dynamic Mathematical Allocation
        if len(chosen_faculties) < invigilator_count:
            needed = invigilator_count - len(chosen_faculties)
            already_chosen_ids = {f.id for f in chosen_faculties}
            
            weekday = exam_date.weekday()
            candidate_pool = []

            for fac in all_faculties:
                if fac.id in already_chosen_ids:
                    continue

                # 1. Leave / Absence Hard Constraint
                on_leave = db.query(Absence).filter(
                    Absence.faculty_id == fac.id,
                    Absence.date <= exam_date,
                    or_(Absence.end_date == None, Absence.end_date >= exam_date),
                    Absence.status.in_(["CONFIRMED", "REPORTED", "APPROVED", "PENDING"])
                ).first()
                if on_leave:
                    continue

                # 2. Existing Exam Duty Overlap Hard Constraint
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

                # 3. Regular Timetable Class Collision Hard Constraint
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

                # 4. Daily Duty Cap (Preference: max 1 exam duty per calendar day)
                same_day_assigned = faculty_daily_assignments.get((fac.id, exam_date), 0)

                # 5. Workload Balancer & Neutrality Scoring
                prior_exam_duties = db.query(ExamDuty).filter(
                    ExamDuty.assigned_faculty_id == fac.id,
                    ExamDuty.status != "CANCELLED"
                ).count()

                prior_sub_duties = db.query(SubstitutionDuty).filter(
                    SubstitutionDuty.assigned_faculty_id == fac.id,
                    SubstitutionDuty.status != "CANCELLED"
                ).count()

                total_exam_load = prior_exam_duties + batch_duty_counts.get(fac.id, 0)
                
                # Neutrality: bonus if faculty department is different from course exam department
                is_dept_neutral = fac.department and fac.department.code != dept_code
                neutral_bonus = 20 if is_dept_neutral else 0

                # Score: higher is better
                score = 100 - (15 * total_exam_load) - (5 * prior_sub_duties) - (50 * same_day_assigned) + neutral_bonus

                candidate_pool.append({
                    "faculty": fac,
                    "score": score,
                    "same_day_assigned": same_day_assigned,
                    "total_exam_load": total_exam_load
                })

            # Sort candidate pool by highest score
            candidate_pool.sort(key=lambda x: (x["score"], -x["total_exam_load"]), reverse=True)
            for cand in candidate_pool[:needed]:
                chosen_faculties.append(cand["faculty"])
                batch_duty_counts[cand["faculty"].id] = batch_duty_counts.get(cand["faculty"].id, 0) + 1
                faculty_daily_assignments[(cand["faculty"].id, exam_date)] = faculty_daily_assignments.get((cand["faculty"].id, exam_date), 0) + 1

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

            # Dispatch rich interactive notification card to the assigned faculty
            if fac.user_id:
                notif = Notification(
                    user_id=fac.user_id,
                    title=f"📋 Exam Invigilation Allocated: {exam_name}",
                    message=(
                        f"You are allocated as {role_type} for {course_code} - {course_name} on {exam_date}. "
                        f"Reporting: {reporting_time} | Exam: {start_time}-{end_time} | Venue: {venue}"
                    ),
                    notification_type="EXAM_DUTY_ALLOCATED",
                    metadata_json={
                        "duty_id": duty.id,
                        "exam_name": exam_name,
                        "course_code": course_code,
                        "course_name": course_name,
                        "department_code": dept_code,
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

    # Log to Audit Trail
    audit = AuditLog(
        event_type="EXAM_DUTIES_BATCH_ALLOCATED",
        actor_id=current_user.id if hasattr(current_user, "id") else None,
        actor_name=current_user.full_name if hasattr(current_user, "full_name") else "Administrator",
        target_type="EXAM_DUTY",
        details={
            "total_duties_created": len(allocated_duties),
            "notifications_dispatched": dispatched_notifications
        }
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "total_duties_allocated": len(allocated_duties),
        "notifications_dispatched": dispatched_notifications,
        "message": f"Successfully allocated and dispatched {len(allocated_duties)} exam duty assignment(s) across all courses and venues with {dispatched_notifications} real-time alert notifications!"
    }
