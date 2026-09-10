import io
import re
import uuid
import pandas as pd
from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from app.models.entities import (
    TimetableVersion, TimetableEntry, Faculty, ClassSection, Subject, Department, User, Role, AuditLog
)
from app.core.security import get_password_hash
from app.allocation.constraints import time_overlaps

DAY_NAME_MAP = {
    "monday": 0, "mon": 0, "m": 0, "0": 0, "1": 0,
    "tuesday": 1, "tue": 1, "tu": 1, "t": 1, "2": 1,
    "wednesday": 2, "wed": 2, "w": 2, "3": 2,
    "thursday": 3, "thu": 3, "th": 3, "4": 3,
    "friday": 4, "fri": 4, "f": 4, "5": 4,
    "saturday": 5, "sat": 5, "s": 5, "6": 5,
    "sunday": 6, "sun": 6, "su": 6, "7": 6
}

FACULTY_ALIASES = [
    "faculty_code", "faculty_id", "faculty", "faculty_name", "instructor", "instructor_name",
    "teacher", "teacher_name", "prof", "professor", "staff", "staff_id", "staff_name",
    "emp_id", "employee_id", "fac_code", "fac_name", "faculty_email", "email", "lecturer"
]

CLASS_ALIASES = [
    "class_name", "class", "section", "class_section", "batch", "grade", "division",
    "group", "class_sec", "branch_sec", "sec", "semester_section", "course_section", "std_section"
]

SUBJECT_ALIASES = [
    "subject_code", "subject", "subject_name", "course", "course_code", "course_name",
    "sub_code", "sub_name", "sub", "paper", "module", "subject_title"
]

DAY_ALIASES = [
    "day", "day_of_week", "day_name", "weekday", "days", "day_no", "week_day"
]

START_TIME_ALIASES = [
    "start_time", "start", "from_time", "from", "time_start", "period_start",
    "slot_start", "begin_time", "start_at", "from_slot"
]

END_TIME_ALIASES = [
    "end_time", "end", "to_time", "to", "time_end", "period_end",
    "slot_end", "finish_time", "end_at", "to_slot"
]

COMBINED_TIME_ALIASES = [
    "time", "time_slot", "slot", "timing", "period", "time_period", "period_time",
    "hours", "slot_timing", "schedule_time", "period_slot"
]

ROOM_ALIASES = [
    "room_number", "room", "room_no", "classroom", "venue", "hall", "lab", "location", "room_id"
]

def normalize_header(col_name: str) -> str:
    return str(col_name).strip().lower().replace(" ", "_").replace("-", "_").replace(".", "_")

def find_matched_column(columns: List[str], aliases: List[str]) -> Optional[str]:
    norm_map = {normalize_header(c): c for c in columns}
    for alias in aliases:
        if alias in norm_map:
            return norm_map[alias]
    # Substring / partial matching
    for norm_c, orig_c in norm_map.items():
        for alias in aliases:
            if alias in norm_c or norm_c in alias:
                return orig_c
    return None

def normalize_time_str(time_str: str) -> Optional[str]:
    """Converts diverse time formats (e.g. '9:00', '09:00:00', '9 AM', '1:30 PM') to HH:MM (24-hr)."""
    t = str(time_str).strip().upper()
    if not t or t == "NAN":
        return None
    
    # 1. Standard 24-hr HH:MM or H:MM
    m24 = re.match(r"^(\d{1,2})[:.](\d{2})(?::\d{2})?$", t)
    if m24:
        hh = int(m24.group(1))
        mm = int(m24.group(2))
        if 0 <= hh <= 23 and 0 <= mm <= 59:
            return f"{hh:02d}:{mm:02d}"

    # 2. 12-hr with AM/PM
    m12 = re.match(r"^(\d{1,2})(?:[:.](\d{2}))?\s*(AM|PM)$", t)
    if m12:
        hh = int(m12.group(1))
        mm = int(m12.group(2)) if m12.group(2) else 0
        ampm = m12.group(3)
        if ampm == "PM" and hh < 12:
            hh += 12
        elif ampm == "AM" and hh == 12:
            hh = 0
        if 0 <= hh <= 23 and 0 <= mm <= 59:
            return f"{hh:02d}:{mm:02d}"

    # 3. Simple integer hour like "9" or "14"
    if t.isdigit():
        hh = int(t)
        if 0 <= hh <= 23:
            return f"{hh:02d}:00"

    return None

def parse_time_slot(combined_val: str) -> Tuple[Optional[str], Optional[str]]:
    """Splits a combined slot string (e.g. '09:00 - 10:00', '9am to 10am', '9:00-10:00') into (start, end)."""
    s = str(combined_val).strip()
    # Remove slot prefixes like "Slot 1 (" or "Period 2:"
    s = re.sub(r"^[^\d]*\d+[\s:(-]+", "", s).rstrip(")")
    parts = re.split(r"\s*(?:-|–|—|to|\/)\s*", s, flags=re.IGNORECASE)
    if len(parts) >= 2:
        st = normalize_time_str(parts[0])
        et = normalize_time_str(parts[1])
        if st and et:
            return st, et
    return None, None

def parse_day_to_int(day_val: Any) -> Optional[int]:
    if day_val is None:
        return None
    d_str = str(day_val).strip().lower()
    if d_str in DAY_NAME_MAP:
        return DAY_NAME_MAP[d_str]
    # Check if number 0-6
    if d_str.isdigit():
        val = int(d_str)
        if 0 <= val <= 6:
            return val
        if val == 7:
            return 6
    # Substring search
    for k, v in DAY_NAME_MAP.items():
        if k in d_str or d_str.startswith(k[:3]):
            return v
    return None

CANONICAL_COURSES_MAP = {
    "CSE": "CSE", "COMPUTER SCIENCE": "CSE", "CS ENGINEERING": "CSE", "COMPUTER SCIENCE & ENGINEERING": "CSE",
    "AIDS": "AIDS", "AI & DS": "AIDS", "AI&DS": "AIDS", "ARTIFICIAL INTELLIGENCE & DATA SCIENCE": "AIDS", "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE": "AIDS",
    "AIML": "AIML", "AI & ML": "AIML", "AI&ML": "AIML", "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING": "AIML", "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING": "AIML",
    "CS": "CS", "CYBER SECURITY": "CS", "CYBER": "CS", "CYBERSECURITY": "CS",
    "CC": "CC", "CLOUD COMPUTING": "CC", "CLOUD": "CC",
    "AIHC": "AIHC", "AI & HC": "AIHC", "AI&HC": "AIHC", "HEALTHCARE": "AIHC", "AI IN HEALTHCARE": "AIHC", "ARTIFICIAL INTELLIGENCE IN HEALTH CARE": "AIHC"
}

def normalize_academic_year(year_val: Any) -> Optional[int]:
    """
    Normalizes Roman numerals and descriptive text to academic year integer (1, 2, 3, 4).
    I -> 1, II -> 2, III -> 3, IV -> 4
    1st Year, 2nd Year, 3rd Year, 4th Year -> 1, 2, 3, 4
    """
    if not year_val:
        return None
    y_str = str(year_val).strip().upper()
    if y_str in ["1", "I", "1ST", "1ST YEAR", "I YEAR", "YEAR 1", "YEAR I", "SEM 1", "SEM 2", "SEMESTER 1", "SEMESTER 2"]:
        return 1
    if y_str in ["2", "II", "2ND", "2ND YEAR", "II YEAR", "YEAR 2", "YEAR II", "SEM 3", "SEM 4", "SEMESTER 3", "SEMESTER 4"]:
        return 2
    if y_str in ["3", "III", "3RD", "3RD YEAR", "III YEAR", "YEAR 3", "YEAR III", "SEM 5", "SEM 6", "SEMESTER 5", "SEMESTER 6"]:
        return 3
    if y_str in ["4", "IV", "4TH", "4TH YEAR", "IV YEAR", "YEAR 4", "YEAR IV", "SEM 7", "SEM 8", "SEMESTER 7", "SEMESTER 8"]:
        return 4
    if re.search(r"\b(IV|4TH|YEAR\s*4|SEM\s*[78])\b", y_str):
        return 4
    if re.search(r"\b(III|3RD|YEAR\s*3|SEM\s*[56])\b", y_str):
        return 3
    if re.search(r"\b(II|2ND|YEAR\s*2|SEM\s*[34])\b", y_str):
        return 2
    if re.search(r"\b(I|1ST|YEAR\s*1|SEM\s*[12])\b", y_str):
        return 1
    return None

def normalize_course_code(course_val: Any) -> Optional[str]:
    """
    Normalizes course / department input to one of the 6 canonical course codes:
    CSE, AIDS, AIML, CS, CC, AIHC.
    """
    if not course_val:
        return None
    c_str = str(course_val).strip().upper().replace("_", " ").replace("-", " ")
    for k, v in CANONICAL_COURSES_MAP.items():
        if c_str == k or c_str.startswith(k + " ") or f" {k} " in f" {c_str} ":
            return v
    return None

def parse_and_validate_timetable_file(
    db: Session,
    file_bytes: bytes,
    filename: str
) -> Dict[str, Any]:
    """
    Parses CSV or Excel file with ultra-resilient column mapping and auto entity resolution.
    Returns diagnostics, previews, and parsed rows.
    """
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            return {"error": "Unsupported file format. Please upload a CSV or Excel (.xlsx / .xls) file."}
    except Exception as e:
        return {"error": f"Failed to read file: {str(e)}"}

    if df.empty:
        return {"error": "The uploaded file is empty. Please provide a timetable spreadsheet with class schedule data."}

    columns = list(df.columns)
    
    # 1. Match columns dynamically
    fac_col = find_matched_column(columns, FACULTY_ALIASES)
    class_col = find_matched_column(columns, CLASS_ALIASES)
    sub_col = find_matched_column(columns, SUBJECT_ALIASES)
    day_col = find_matched_column(columns, DAY_ALIASES)
    start_col = find_matched_column(columns, START_TIME_ALIASES)
    end_col = find_matched_column(columns, END_TIME_ALIASES)
    combined_time_col = find_matched_column(columns, COMBINED_TIME_ALIASES)
    room_col = find_matched_column(columns, ROOM_ALIASES)

    # Check minimum essential columns
    missing_fields = []
    if not fac_col:
        missing_fields.append("Faculty (e.g. Faculty Name or Code)")
    if not class_col:
        missing_fields.append("Class / Section (e.g. CSE-A)")
    if not sub_col:
        missing_fields.append("Subject (e.g. CS101 or Data Structures)")
    if not day_col:
        missing_fields.append("Day (e.g. Monday, Tue)")
    if not (start_col and end_col) and not combined_time_col:
        missing_fields.append("Time Slots (e.g. Start Time & End Time, or '09:00 - 10:00')")

    if missing_fields:
        # File is a 2D Matrix, multi-sheet university export, or custom format -> Trigger AI Matrix Extractor!
        try:
            from app.services.ai_timetable_extractor import scan_and_extract_timetable_with_ai
            ai_res = scan_and_extract_timetable_with_ai(db, file_bytes, filename)
            if "error" not in ai_res and ai_res.get("valid_rows_count", 0) > 0:
                return ai_res
        except Exception as e:
            print(f"AI Timetable extraction fallback error: {e}")

        return {
            "error": (
                f"Could not identify required timetable columns in '{filename}'. "
                f"Missing: {', '.join(missing_fields)}. "
                f"Detected columns in file: {', '.join([str(c) for c in columns])}. "
                f"Tip: You can download our standardized timetable template below."
            )
        }

    # Pre-fetch existing entities
    faculties = db.query(Faculty).all()
    faculty_map = {f.faculty_id.upper(): f for f in faculties}
    faculty_name_map = {f.name.lower(): f for f in faculties}
    faculty_email_map = {f.email.lower(): f for f in faculties}

    classes = db.query(ClassSection).all()
    class_map = {c.name.upper(): c for c in classes}

    subjects = db.query(Subject).all()
    subject_map = {s.code.upper(): s for s in subjects}
    subject_name_map = {s.name.lower(): s for s in subjects}

    default_dept = db.query(Department).first()
    faculty_role = db.query(Role).filter(Role.name == "FACULTY").first()

    valid_rows = []
    errors = []
    warnings = []
    conflicts = []

    faculty_schedule_tracker: Dict[str, List[Dict[str, Any]]] = {}
    class_schedule_tracker: Dict[str, List[Dict[str, Any]]] = {}

    for idx, row in df.iterrows():
        row_num = idx + 2  # 1-indexed row for humans
        
        fac_val = str(row[fac_col]).strip() if fac_col and pd.notna(row[fac_col]) else ""
        cls_val = str(row[class_col]).strip() if class_col and pd.notna(row[class_col]) else ""
        sub_val = str(row[sub_col]).strip() if sub_col and pd.notna(row[sub_col]) else ""
        day_raw = row[day_col] if day_col and pd.notna(row[day_col]) else ""
        room_val = str(row[room_col]).strip() if room_col and pd.notna(row[room_col]) else "Room-101"

        if not fac_val or not cls_val or not sub_val or not day_raw:
            # Skip empty spacer rows
            continue

        # Resolve Times
        start_t = None
        end_t = None
        if start_col and end_col and pd.notna(row[start_col]) and pd.notna(row[end_col]):
            start_t = normalize_time_str(str(row[start_col]))
            end_t = normalize_time_str(str(row[end_col]))
        elif combined_time_col and pd.notna(row[combined_time_col]):
            start_t, end_t = parse_time_slot(str(row[combined_time_col]))

        # Fallback slot guessing if only start time is provided (default 1-hour period)
        if start_t and not end_t:
            try:
                hh, mm = map(int, start_t.split(":"))
                end_t = f"{(hh + 1) % 24:02d}:{mm:02d}"
            except Exception:
                pass

        row_errors = []

        if not start_t or not end_t:
            row_errors.append(f"Row {row_num}: Could not determine valid start and end time.")
        elif start_t >= end_t:
            row_errors.append(f"Row {row_num}: Start time ({start_t}) must be before end time ({end_t}).")

        # Resolve Day
        day_int = parse_day_to_int(day_raw)
        if day_int is None:
            row_errors.append(f"Row {row_num}: Unrecognized weekday '{day_raw}'. Use Monday–Saturday.")

        if row_errors:
            errors.extend(row_errors)
            continue

        # Resolve or Auto-Provision Faculty
        faculty_obj = (
            faculty_map.get(fac_val.upper()) or
            faculty_name_map.get(fac_val.lower()) or
            faculty_email_map.get(fac_val.lower())
        )
        if not faculty_obj:
            # Check database directly in case added recently
            clean_name = fac_val if "@" not in fac_val else fac_val.split("@")[0].replace(".", " ").title()
            clean_email = fac_val.lower() if "@" in fac_val else f"{clean_name.lower().replace(' ', '.')}@apollouniversity.edu.in"
            
            existing_fac = db.query(Faculty).filter(
                or_(
                    Faculty.faculty_id == fac_val.upper(),
                    Faculty.email == clean_email,
                    Faculty.name.ilike(clean_name)
                )
            ).first()

            if existing_fac:
                faculty_obj = existing_fac
                faculty_map[existing_fac.faculty_id.upper()] = faculty_obj
                faculty_name_map[existing_fac.name.lower()] = faculty_obj
                faculty_email_map[existing_fac.email.lower()] = faculty_obj
            else:
                # Auto-provision faculty so upload never fails
                fac_code = fac_val.upper() if len(fac_val) <= 15 and " " not in fac_val else f"FAC-{uuid.uuid4().hex[:6].upper()}"
                while db.query(Faculty).filter(Faculty.faculty_id == fac_code).first():
                    fac_code = f"FAC-{uuid.uuid4().hex[:6].upper()}"

                # Check if user account exists
                user_acc = db.query(User).filter(User.email == clean_email).first()
                if not user_acc:
                    user_acc = User(
                        email=clean_email,
                        hashed_password=get_password_hash("Apollo@2026"),
                        full_name=clean_name,
                        role_id=faculty_role.id if faculty_role else 2,
                        is_active=True
                    )
                    db.add(user_acc)
                    db.flush()

                faculty_obj = Faculty(
                    faculty_id=fac_code,
                    user_id=user_acc.id,
                    name=clean_name,
                    email=clean_email,
                    phone="+91 98765 00000",
                    department_id=default_dept.id if default_dept else 1,
                    designation="Assistant Professor",
                    role_id=faculty_role.id if faculty_role else 2,
                    is_substitution_eligible=True,
                    is_exempt=False,
                    max_weekly_substitutions=4,
                    subject_expertise=[sub_val.upper()],
                    status="ACTIVE"
                )
                db.add(faculty_obj)
                db.flush()
                faculty_map[fac_code.upper()] = faculty_obj
                faculty_name_map[clean_name.lower()] = faculty_obj
                faculty_email_map[clean_email.lower()] = faculty_obj
                warnings.append(f"Row {row_num}: Auto-enrolled new faculty '{clean_name}' ({fac_code}).")

        # Resolve or Auto-Provision Class Section
        class_obj = class_map.get(cls_val.upper())
        if not class_obj:
            extracted_yr = normalize_academic_year(cls_val) or 1
            class_obj = ClassSection(
                name=cls_val.upper(),
                department_id=default_dept.id if default_dept else 1,
                academic_year="2026",
                year_level=extracted_yr,
                semester=(extracted_yr * 2 - 1)
            )
            db.add(class_obj)
            db.flush()
            class_map[cls_val.upper()] = class_obj
            warnings.append(f"Row {row_num}: Auto-created new class section '{cls_val.upper()}' (Year {extracted_yr}).")

        # Resolve or Auto-Provision Subject
        subject_obj = subject_map.get(sub_val.upper()) or subject_name_map.get(sub_val.lower())
        if not subject_obj:
            sub_code = sub_val.upper() if len(sub_val) <= 10 and " " not in sub_val else f"SUB-{cls_val.upper()[:3]}-{len(subject_map)+1}"
            sub_title = sub_val if " " in sub_val else f"{sub_code} Course"
            subject_obj = Subject(
                code=sub_code,
                name=sub_title,
                department_id=default_dept.id if default_dept else 1,
                credits=3
            )
            db.add(subject_obj)
            db.flush()
            subject_map[sub_code.upper()] = subject_obj
            subject_name_map[sub_title.lower()] = subject_obj
            warnings.append(f"Row {row_num}: Auto-created new subject '{sub_title}' ({sub_code}).")

        # Conflict Detection inside uploaded spreadsheet
        fac_key = f"{faculty_obj.id}_{day_int}"
        if fac_key in faculty_schedule_tracker:
            for prev in faculty_schedule_tracker[fac_key]:
                if time_overlaps(start_t, end_t, prev["start_time"], prev["end_time"]):
                    conf_msg = f"Row {row_num} overlaps with Row {prev['row_num']}: Faculty {faculty_obj.name} double-booked at {start_t}-{end_t} on weekday {day_int}."
                    conflicts.append({"type": "FACULTY_OVERLAP", "message": conf_msg, "row": row_num})

        class_key = f"{class_obj.id}_{day_int}"
        if class_key in class_schedule_tracker:
            for prev in class_schedule_tracker[class_key]:
                if time_overlaps(start_t, end_t, prev["start_time"], prev["end_time"]):
                    conf_msg = f"Row {row_num} overlaps with Row {prev['row_num']}: Class {class_obj.name} has two simultaneous sessions at {start_t}-{end_t}."
                    conflicts.append({"type": "CLASS_OVERLAP", "message": conf_msg, "row": row_num})

        entry_dict = {
            "row_num": row_num,
            "faculty_id": faculty_obj.id,
            "faculty_name": faculty_obj.name,
            "faculty_code": faculty_obj.faculty_id,
            "class_section_id": class_obj.id,
            "class_name": class_obj.name,
            "subject_id": subject_obj.id,
            "subject_code": subject_obj.code,
            "subject_name": subject_obj.name,
            "day_of_week": day_int,
            "start_time": start_t,
            "end_time": end_t,
            "room_number": room_val or "Room-101"
        }

        faculty_schedule_tracker.setdefault(fac_key, []).append(entry_dict)
        class_schedule_tracker.setdefault(class_key, []).append(entry_dict)
        valid_rows.append(entry_dict)

    classes_summary = []
    class_groups: Dict[str, List[Dict[str, Any]]] = {}
    for entry in valid_rows:
        c_name = entry["class_name"]
        class_groups.setdefault(c_name, []).append(entry)

    for c_name, c_entries in class_groups.items():
        subjs = list({e["subject_code"] for e in c_entries if e.get("subject_code")})
        subj_names = list({e["subject_name"] for e in c_entries if e.get("subject_name")})
        facs = list({e["faculty_name"] for e in c_entries if e.get("faculty_name")})
        rooms = list({e["room_number"] for e in c_entries if e.get("room_number")})
        classes_summary.append({
            "class_name": c_name,
            "total_periods": len(c_entries),
            "room_number": rooms[0] if rooms else "Room-101",
            "subjects_count": len(subjs),
            "subjects": subjs,
            "subject_names": subj_names,
            "faculty_count": len(facs),
            "faculty": facs
        })

    return {
        "filename": filename,
        "total_rows": len(df),
        "valid_rows_count": len(valid_rows),
        "error_count": len(errors),
        "warning_count": len(warnings),
        "conflict_count": len(conflicts),
        "errors": errors[:30],
        "warnings": warnings[:20],
        "conflicts": conflicts[:30],
        "preview_entries": valid_rows,
        "all_valid_entries": valid_rows,
        "classes_summary": classes_summary
    }

def commit_timetable_version(
    db: Session,
    version_name: str,
    entries_data: List[Dict[str, Any]],
    academic_year: str = "2026",
    semester: int = 1,
    activate_immediately: bool = True,
    created_by: str = "Admin"
) -> Dict[str, Any]:
    """
    Saves and creates a new immutable TimetableVersion with all valid entries.
    If activate_immediately is True, deactivates older versions and activates this one.
    """
    if activate_immediately:
        db.query(TimetableVersion).filter(TimetableVersion.is_active == True).update({"is_active": False})

    version = TimetableVersion(
        name=version_name,
        academic_year=academic_year,
        semester=semester,
        is_active=activate_immediately,
        created_by=created_by
    )
    db.add(version)
    db.flush()

    for item in entries_data:
        entry = TimetableEntry(
            timetable_version_id=version.id,
            faculty_id=item["faculty_id"],
            class_section_id=item["class_section_id"],
            subject_id=item["subject_id"],
            day_of_week=item["day_of_week"],
            start_time=item["start_time"],
            end_time=item["end_time"],
            room_number=item.get("room_number", "Room-101")
        )
        db.add(entry)

    audit = AuditLog(
        event_type="TIMETABLE_VERSION_CREATED",
        actor_name=created_by,
        target_type="TIMETABLE_VERSION",
        target_id=version.id,
        details={
            "version_name": version_name,
            "total_entries": len(entries_data),
            "is_active": activate_immediately
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(version)

    return {
        "success": True,
        "version_id": version.id,
        "version_name": version.name,
        "total_entries": len(entries_data),
        "is_active": version.is_active
    }

