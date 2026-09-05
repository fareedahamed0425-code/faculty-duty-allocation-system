import io
import pandas as pd
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.entities import (
    TimetableVersion, TimetableEntry, Faculty, ClassSection, Subject, AuditLog
)
from app.allocation.constraints import time_overlaps

DAY_NAME_MAP = {
    "monday": 0, "mon": 0, "0": 0,
    "tuesday": 1, "tue": 1, "1": 1,
    "wednesday": 2, "wed": 2, "2": 2,
    "thursday": 3, "thu": 3, "3": 3,
    "friday": 4, "fri": 4, "4": 4,
    "saturday": 5, "sat": 5, "5": 5,
    "sunday": 6, "sun": 6, "6": 6
}

def parse_and_validate_timetable_file(
    db: Session,
    file_bytes: bytes,
    filename: str
) -> Dict[str, Any]:
    """
    Parses CSV or Excel file and returns validation diagnostics, errors, warnings,
    and conflicts without modifying the database.
    """
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            return {"error": "Unsupported file format. Please upload CSV or Excel (.xlsx)."}
    except Exception as e:
        return {"error": f"Failed to parse file: {str(e)}"}

    # Standardize column headers
    df.columns = [str(col).strip().lower().replace(" ", "_") for col in df.columns]

    required_cols = ["faculty_code", "class_name", "subject_code", "day", "start_time", "end_time"]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        return {"error": f"Missing required columns in file: {', '.join(missing_cols)}"}

    # Pre-fetch existing entities for fast validation
    faculty_map = {f.faculty_id.upper(): f for f in db.query(Faculty).all()}
    faculty_name_map = {f.name.lower(): f for f in db.query(Faculty).all()}
    class_map = {c.name.upper(): c for c in db.query(ClassSection).all()}
    subject_map = {s.code.upper(): s for s in db.query(Subject).all()}

    valid_rows = []
    errors = []
    warnings = []
    conflicts = []

    # Temporary tracker for internal conflict detection in the uploaded file
    faculty_schedule_tracker: Dict[str, List[Dict[str, Any]]] = {}
    class_schedule_tracker: Dict[str, List[Dict[str, Any]]] = {}

    for idx, row in df.iterrows():
        row_num = idx + 2  # 1-indexed Excel row
        
        fac_val = str(row.get("faculty_code", "")).strip()
        cls_val = str(row.get("class_name", "")).strip()
        sub_val = str(row.get("subject_code", "")).strip()
        day_val = str(row.get("day", "")).strip().lower()
        start_t = str(row.get("start_time", "")).strip()
        end_t = str(row.get("end_time", "")).strip()
        room = str(row.get("room_number", row.get("room", "Room-101"))).strip()

        # Format times (e.g., '9:00' -> '09:00')
        if len(start_t) == 4 and start_t[1] == ":":
            start_t = "0" + start_t
        if len(end_t) == 4 and end_t[1] == ":":
            end_t = "0" + end_t

        row_errors = []

        # Validate Faculty
        faculty_obj = faculty_map.get(fac_val.upper()) or faculty_name_map.get(fac_val.lower())
        if not faculty_obj:
            row_errors.append(f"Row {row_num}: Unknown faculty identifier '{fac_val}'.")

        # Validate Class
        class_obj = class_map.get(cls_val.upper())
        if not class_obj:
            row_errors.append(f"Row {row_num}: Unknown class/section '{cls_val}'.")

        # Validate Subject
        subject_obj = subject_map.get(sub_val.upper())
        if not subject_obj:
            row_errors.append(f"Row {row_num}: Unknown subject code '{sub_val}'.")

        # Validate Day
        day_int = DAY_NAME_MAP.get(day_val)
        if day_int is None:
            row_errors.append(f"Row {row_num}: Invalid day '{day_val}'. Must be Mon-Sun.")

        # Validate Times
        if not (len(start_t) == 5 and start_t[2] == ":") or not (len(end_t) == 5 and end_t[2] == ":"):
            row_errors.append(f"Row {row_num}: Invalid time format '{start_t}' or '{end_t}'. Use HH:MM.")
        elif start_t >= end_t:
            row_errors.append(f"Row {row_num}: Start time ({start_t}) must be before end time ({end_t}).")

        if row_errors:
            errors.extend(row_errors)
            continue

        # Check for internal conflicts (Overlap within the same file)
        fac_key = f"{faculty_obj.id}_{day_int}"
        if fac_key in faculty_schedule_tracker:
            for prev in faculty_schedule_tracker[fac_key]:
                if time_overlaps(start_t, end_t, prev["start_time"], prev["end_time"]):
                    conf_msg = f"Row {row_num} conflicts with Row {prev['row_num']}: Faculty {faculty_obj.name} double-booked at {start_t}-{end_t} on day {day_val}."
                    conflicts.append({"type": "FACULTY_OVERLAP", "message": conf_msg, "row": row_num})

        class_key = f"{class_obj.id}_{day_int}"
        if class_key in class_schedule_tracker:
            for prev in class_schedule_tracker[class_key]:
                if time_overlaps(start_t, end_t, prev["start_time"], prev["end_time"]):
                    conf_msg = f"Row {row_num} conflicts with Row {prev['row_num']}: Class {class_obj.name} scheduled for two simultaneous classes at {start_t}-{end_t}."
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
            "room_number": room
        }

        faculty_schedule_tracker.setdefault(fac_key, []).append(entry_dict)
        class_schedule_tracker.setdefault(class_key, []).append(entry_dict)
        valid_rows.append(entry_dict)

    return {
        "filename": filename,
        "total_rows": len(df),
        "valid_rows_count": len(valid_rows),
        "error_count": len(errors),
        "warning_count": len(warnings),
        "conflict_count": len(conflicts),
        "errors": errors[:30],  # Return up to 30 errors for clean UI
        "warnings": warnings,
        "conflicts": conflicts[:30],
        "preview_entries": valid_rows[:50]  # Preview first 50 rows
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
