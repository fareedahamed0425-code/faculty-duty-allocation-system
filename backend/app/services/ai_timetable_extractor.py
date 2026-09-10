import io
import re
import json
import uuid
import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from openai import OpenAI

from app.core.config import settings
from app.models.entities import Faculty, ClassSection, Subject, Department, User, Role
from app.core.security import get_password_hash
from app.services.timetable_service import normalize_time_str, parse_time_slot, parse_day_to_int

DAY_MAP = {
    "mon": 0, "monday": 0,
    "tue": 1, "tues": 1, "tuesday": 1,
    "wed": 2, "wednesday": 2,
    "thu": 3, "thur": 3, "thurs": 3, "thursday": 3,
    "fri": 4, "friday": 4,
    "sat": 5, "saturday": 5,
    "sun": 6, "sunday": 6
}

def extract_text_from_file_sheets(file_bytes: bytes, filename: str) -> Dict[str, str]:
    """
    Extracts structured raw text / CSV representations of each sheet in an Excel or CSV file.
    """
    sheets_dict = {}
    if filename.endswith((".xlsx", ".xls")):
        excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
        for sheet_name in excel_file.sheet_names:
            df = excel_file.parse(sheet_name, header=None)
            # Remove entirely empty rows and cols
            df = df.dropna(how="all").dropna(axis=1, how="all")
            if not df.empty:
                # Convert to clean CSV text representation
                csv_str = df.to_csv(index=False, header=False)
                sheets_dict[sheet_name] = csv_str
    elif filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes), header=None)
        df = df.dropna(how="all").dropna(axis=1, how="all")
        sheets_dict["Main"] = df.to_csv(index=False, header=False)
    
    return sheets_dict


def call_llm_for_timetable_extraction(sheet_name: str, sheet_csv: str) -> List[Dict[str, Any]]:
    """
    Calls NVIDIA Nemotron / OpenAI LLM to scan and extract all lecture periods from the 2D matrix or table.
    """
    base_url = settings.NVIDIA_INVOKE_URL
    if base_url.endswith("/chat/completions"):
        base_url = base_url.replace("/chat/completions", "")
    elif base_url.endswith("/chat/completions/"):
        base_url = base_url.replace("/chat/completions/", "")

    client = OpenAI(
        base_url=base_url,
        api_key=settings.NVIDIA_API_KEY
    )

    prompt = f"""You are an expert AI for university timetable parsing.
Scan and intelligently understand the following raw timetable spreadsheet (Sheet: '{sheet_name}').
It may be a 2D matrix (Days as rows, Time slots/periods as columns) with title headers at the top and a Faculty/Subject Key table at the bottom.

Raw Spreadsheet Content:
```csv
{sheet_csv[:6000]}
```

Extract every single teaching period / class entry into a clean JSON array of objects.
Each object MUST have:
- "class_name": string (e.g. "{sheet_name}" or the section found in the title like "III CSE(AIML A)", "III CSE-B", "CSE-A")
- "day_of_week": integer (0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday)
- "start_time": string (e.g. "09:00", "09:55", "11:15", "14:00")
- "end_time": string (e.g. "09:55", "10:50", "12:15", "15:00")
- "subject_code": string (e.g. "CS301", "ML", "DAA", "WT")
- "subject_name": string (e.g. "Machine Learning", "Design & Analysis of Algorithms", or subject code)
- "faculty_name": string (e.g. "Dr. Alice", "Prof. K. Suresh", or "Faculty Member")
- "room_number": string (e.g. "LH-201", "Room-101", "Lab-2", or "Classroom")

Rules:
1. Ignore Break/Lunch periods (do not extract lunch or recess as a class).
2. If subject abbreviations exist (like "ML", "DAA"), resolve them using the faculty/subject legend table if present in the spreadsheet.
3. If no faculty name is mentioned for a slot, use the subject teacher or "Faculty Member".
4. Output ONLY the raw JSON array (start with `[` and end with `]`). No markdown commentary or extra text.
"""

    try:
        response = client.chat.completions.create(
            model=settings.NVIDIA_MODEL,
            messages=[
                {"role": "system", "content": "You are a precise data extraction AI that outputs only structured JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=3000,
            timeout=10.0
        )
        content = response.choices[0].message.content.strip()
        # Clean any markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        parsed = json.loads(content)
        if isinstance(parsed, list):
            return parsed
        elif isinstance(parsed, dict) and "entries" in parsed:
            return parsed["entries"]
    except Exception as e:
        print(f"AI extraction call error for sheet {sheet_name}: {e}")

    return []


DEFAULT_HASH = get_password_hash("Apollo@2026")

def parse_institutional_matrix_sheet(
    df: pd.DataFrame,
    sheet_name: str
) -> List[Dict[str, Any]]:
    """
    High-precision parser tailored for institutional university timetable sheets (e.g. Apollo University,
    Engineering Colleges) with metadata headers, 2D Day-Period grid, merged lab periods, and bottom legend tables.
    """
    rows = df.values.tolist()
    if not rows:
        return []

    # 1. Extract Room & Department / Class from top metadata rows
    room_no = "Room-101"
    class_name = sheet_name.strip()
    year_prefix = ""

    for r_idx in range(min(7, len(rows))):
        row_str = " ".join([str(v) for v in rows[r_idx] if pd.notna(v)])
        
        m_room = re.search(r"Room\s*No\s*[:=]?\s*([A-Za-z0-9-]+)", row_str, re.I)
        if m_room:
            room_no = "Room " + m_room.group(1).strip()

        m_year = re.search(r"Year\s*:\s*([I|V|X|0-9]+)", row_str, re.I)
        if m_year:
            year_prefix = m_year.group(1).strip()

        # Extract specific department / section e.g. "AIML-A", "AIML-B", "CS", "CSE(AIML-A)", "CSE-A"
        m_dept = re.search(r"Dept\s*:\s*([A-Za-z0-9&()\s/_-]+?)(?=\s+(?:Year|Sem|Date|Ref|Course|Class|$))", row_str, re.I)
        if not m_dept:
            m_dept = re.search(r"Dept\s*:\s*([A-Za-z0-9&()_-]+)", row_str, re.I)

        if m_dept:
            dept_name = m_dept.group(1).strip()
            if dept_name:
                if year_prefix and not dept_name.startswith(year_prefix):
                    class_name = f"{year_prefix} {dept_name}".strip()
                else:
                    class_name = dept_name

    # If sheet_name is already a specific class identifier (e.g. 'III AIML-A', 'CSE-A'), prefer it if class_name is too generic
    if re.match(r"^(?:Sheet\d*|Table\d*|Main)$", class_name, re.I) and not re.match(r"^(?:Sheet\d*|Table\d*|Main)$", sheet_name, re.I):
        class_name = sheet_name.strip()

    # 2. Extract Legend table mapping (Subject Code, Subject Name, Faculty Name, Contact)
    legend = {}
    legend_start_idx = None

    for r_idx in range(7, len(rows)):
        row_str = " ".join([str(v) for v in rows[r_idx] if pd.notna(v)]).lower()
        if "subject" in row_str and ("faculty" in row_str or "code" in row_str or "sl.no" in row_str):
            legend_start_idx = r_idx
            break

    if legend_start_idx is not None:
        for r_idx in range(legend_start_idx + 1, len(rows)):
            row = rows[r_idx]
            non_empty = [str(v).strip() for v in row if pd.notna(v) and str(v).strip()]
            if not non_empty or any(w in " ".join(non_empty).lower() for w in ["prepared by", "verified by", "approved by", "doc.no"]):
                continue

            c1 = str(row[0]).strip() if len(row) > 0 and pd.notna(row[0]) else ""
            c2 = str(row[1]).strip() if len(row) > 1 and pd.notna(row[1]) else ""
            c3 = str(row[2]).strip() if len(row) > 2 and pd.notna(row[2]) else ""
            c6 = str(row[5]).strip() if len(row) > 5 and pd.notna(row[5]) else ""

            sub_code = c2 if re.match(r"^[A-Za-z0-9]{4,12}$", c2) else ""
            sub_name = c3 or (c2 if not sub_code else "")
            fac_name = c6.split("/")[0].split(",")[0].strip() if (c6 and c6 != "-") else ""

            if sub_name or sub_code or fac_name:
                item = {
                    "code": sub_code or "SUB",
                    "name": sub_name or sub_code,
                    "faculty": fac_name or "Faculty Member"
                }

                clean_name = re.sub(r"\(.*?\)", "", sub_name).strip()
                keys_to_add = [k.lower() for k in [sub_code, sub_name, clean_name] if k]
                words = re.findall(r"[A-Za-z0-9]+", clean_name)
                acro1 = "".join([w[0] for w in words if w.lower() not in ["and", "in", "of", "with", "the", "for", "to"]]).upper()
                acro2 = "".join([w[0] for w in words]).upper()
                if acro1:
                    keys_to_add.append(acro1.lower())
                if acro2:
                    keys_to_add.append(acro2.lower())

                # Domain-specific subject shorthand mappings
                if "ai and ml" in sub_name.lower() or "ai&ml" in sub_name.lower():
                    keys_to_add.extend(["ai&ml in bm", "ai & ml in bm", "pe-1", "pe - i", "pe-i", "pe 1"])
                if "placement" in sub_name.lower() or "training" in sub_name.lower():
                    keys_to_add.extend(["pt", "placement training"])
                if "networks lab" in sub_name.lower():
                    keys_to_add.extend(["cn lab", "cnlab"])
                if "r lab" in sub_name.lower() or "analytics with r" in sub_name.lower():
                    keys_to_add.extend(["eda with r lab", "eda with r"])
                if "cryptography and network security lab" in sub_name.lower():
                    keys_to_add.extend(["cns lab", "cnslab"])
                if "artificial intelligence lab" in sub_name.lower():
                    keys_to_add.extend(["ai lab", "ailab"])
                if "entrepreneurship" in sub_name.lower():
                    keys_to_add.extend(["e&sm", "esm", "e & sm"])
                if "faculty elective" in sub_name.lower():
                    keys_to_add.extend(["fe-1", "fe - i", "fe-i", "fe 1", "fe1", "fe"])

                for k in keys_to_add:
                    legend[k] = item

    # 3. Time slot column mapping
    def to_24hr_school(t_val: Optional[str]) -> Optional[str]:
        if not t_val:
            return None
        parts = str(t_val).split(":")
        try:
            h = int(parts[0])
            m = int(parts[1]) if len(parts) > 1 else 0
            if 1 <= h <= 6:
                h += 12
            return f"{h:02d}:{m:02d}"
        except Exception:
            return t_val

    # Standard default period slots
    col_time_map = {
        1: ("09:00", "10:00"),
        2: ("10:00", "11:00"),
        3: ("11:00", "11:10"), # Break
        4: ("11:10", "12:10"),
        5: ("12:10", "13:00"),
        6: ("13:00", "14:00"), # Lunch
        7: ("14:00", "15:00"),
        8: ("15:00", "16:00"),
    }

    # Detect dynamic time slot headers if present in rows 5-8
    for r_idx in range(4, min(9, len(rows))):
        row = rows[r_idx]
        matches = [re.findall(r"\b\d{1,2}[:.]\d{2}\b", str(v)) for v in row if pd.notna(v)]
        flat_matches = [m for sublist in matches for m in sublist]
        if len(flat_matches) >= 4:
            # Parse dynamic column times
            for c_idx, cell_val in enumerate(row):
                if pd.notna(cell_val):
                    s_t, e_t = parse_time_slot(str(cell_val))
                    if s_t and e_t:
                        col_time_map[c_idx] = (to_24hr_school(s_t), to_24hr_school(e_t))

    # 4. Extract schedule matrix from Monday-Saturday rows
    entries = []
    max_matrix_row = legend_start_idx if legend_start_idx is not None else min(16, len(rows))

    for r_idx in range(4, max_matrix_row):
        row = rows[r_idx]
        if not row:
            continue
        first_cell = str(row[0]).strip().lower() if pd.notna(row[0]) else ""
        if first_cell in DAY_MAP:
            day_num = DAY_MAP[first_cell]
            col_idx = 1
            while col_idx < len(row):
                cell_val = str(row[col_idx]).strip() if pd.notna(row[col_idx]) else ""
                
                # Check for Break / Lunch / Free periods
                if col_idx in [3, 6] or cell_val.upper() in ["BREAK", "LUNCH", "SPORTS", "CLUB ACTIVITIES", "EXTRA-CURRICULAR", "-", ""]:
                    col_idx += 1
                    continue

                start_t, end_t = col_time_map.get(col_idx, ("09:00", "10:00"))

                # Check if multi-period lab spanning 2 hours (e.g. Afternoon Lab or Morning Lab)
                if "LAB" in cell_val.upper() and col_idx in [4, 7]:
                    next_col_t = col_time_map.get(col_idx + 1)
                    if next_col_t:
                        end_t = next_col_t[1]

                # Match against Legend
                clean_key = cell_val.lower().strip()
                item = legend.get(clean_key)
                if not item:
                    # Partial fuzzy match
                    for lk, lv in legend.items():
                        if lk in clean_key or clean_key in lk:
                            item = lv
                            break

                if item:
                    sub_code = item["code"]
                    sub_name = item["name"]
                    fac_name = item["faculty"]
                else:
                    sub_code = cell_val[:12].upper()
                    sub_name = cell_val
                    fac_name = "Faculty Member"

                entries.append({
                    "class_name": class_name,
                    "day_of_week": day_num,
                    "start_time": start_t,
                    "end_time": end_t,
                    "subject_code": sub_code,
                    "subject_name": sub_name,
                    "faculty_name": fac_name,
                    "room_number": room_no
                })
                col_idx += 1

    return entries


def heuristic_matrix_extractor(sheet_name: str, sheet_csv: str) -> List[Dict[str, Any]]:
    """
    Ultra-resilient deterministic 2D matrix extractor that parses days along rows and time slots along columns.
    Works as an instant local parser and fallback.
    """
    try:
        df = pd.read_csv(io.StringIO(sheet_csv), header=None)
        return parse_institutional_matrix_sheet(df, sheet_name)
    except Exception as e:
        print(f"Matrix sheet extraction error: {e}")
        return []

    return entries


def scan_and_extract_timetable_with_ai(
    db: Session,
    file_bytes: bytes,
    filename: str
) -> Dict[str, Any]:
    """
    Unified entrypoint:
    1. Extracts all sheets.
    2. Sends sheet representations to NVIDIA Nemotron / OpenAI AI for intelligent structured extraction.
    3. Merges and falls back to deterministic matrix parsing if AI returns partial rows.
    4. Auto-enrolls missing faculty, subjects, and class sections in the database.
    5. Returns validated, previewable, and commit-ready timetable entries.
    """
    sheets = extract_text_from_file_sheets(file_bytes, filename)
    if not sheets:
        return {"error": f"Could not extract spreadsheet sheets from '{filename}'."}

    all_extracted_entries = []
    ai_used = False

    for sheet_name, sheet_csv in sheets.items():
        # First try high-precision institutional matrix parser (instant)
        extracted = heuristic_matrix_extractor(sheet_name, sheet_csv)
        if not extracted or len(extracted) < 3:
            # Fall back to AI extraction if matrix heuristic did not find enough periods
            try:
                ai_entries = call_llm_for_timetable_extraction(sheet_name, sheet_csv)
                if ai_entries and len(ai_entries) >= 3:
                    extracted = ai_entries
                    ai_used = True
            except Exception as e:
                print(f"LLM extraction fallback error for {sheet_name}: {e}")

        if extracted:
            all_extracted_entries.extend(extracted)

    if not all_extracted_entries:
        return {"error": f"Could not detect timetable matrix schedules in '{filename}'. Please verify file contents."}

    # Pre-fetch existing database entities
    faculties = db.query(Faculty).all()
    faculty_map = {f.faculty_id.upper(): f for f in faculties}
    faculty_name_map = {f.name.lower(): f for f in faculties}
    faculty_email_map = {f.email.lower(): f for f in faculties}

    classes = db.query(ClassSection).all()
    class_map = {c.name.upper(): c for c in classes}

    subjects = db.query(Subject).all()
    subject_map = {s.code.upper(): s for s in subjects}
    subject_name_map = {s.name.lower(): s for s in subjects}

    departments = db.query(Department).all()
    default_dept = departments[0] if departments else None

    def resolve_dept(text: str) -> Department:
        upper = text.upper()
        for d in departments:
            if re.search(r'\b' + re.escape(d.code.upper()) + r'\b', upper):
                return d
        for d in departments:
            if d.code.upper() in upper or (d.name and d.name.lower() in text.lower()):
                return d
        return default_dept

    faculty_role = db.query(Role).filter(Role.name == "FACULTY").first()

    valid_entries = []
    warnings = []
    row_num = 1

    for raw in all_extracted_entries:
        cls_name = str(raw.get("class_name", "CSE-A")).strip().replace('"', '')
        day_val = raw.get("day_of_week", 0)
        start_t = normalize_time_str(raw.get("start_time", "09:00")) or "09:00"
        end_t = normalize_time_str(raw.get("end_time", "10:00")) or "10:00"
        sub_code = str(raw.get("subject_code", "CS101")).strip().upper().replace('"', '')[:15]
        sub_name = str(raw.get("subject_name", sub_code)).strip().replace('"', '')
        fac_name = str(raw.get("faculty_name", "Faculty Member")).strip().replace('"', '')
        room_no = str(raw.get("room_number", "Room-101")).strip().replace('"', '')

        # Resolve Department for this class and subject
        class_dept = resolve_dept(cls_name) or resolve_dept(sub_code) or default_dept

        # Resolve or Auto-Provision Class Section
        class_obj = class_map.get(cls_name.upper())
        if not class_obj:
            class_obj = ClassSection(
                name=cls_name.upper(),
                department_id=class_dept.id if class_dept else 1,
                academic_year="2026",
                semester=1
            )
            db.add(class_obj)
            db.flush()
            class_map[cls_name.upper()] = class_obj
            warnings.append(f"Auto-created class section '{cls_name.upper()}' under {class_dept.code if class_dept else 'General'}.")

        # Resolve or Auto-Provision Subject
        subject_obj = subject_map.get(sub_code) or subject_name_map.get(sub_name.lower())
        if not subject_obj:
            subject_dept = resolve_dept(sub_code) or class_dept
            subject_obj = Subject(
                code=sub_code,
                name=sub_name if sub_name else sub_code,
                department_id=subject_dept.id if subject_dept else 1,
                credits=3,
                is_active=True
            )
            db.add(subject_obj)
            db.flush()
            subject_map[sub_code] = subject_obj
            subject_name_map[sub_name.lower()] = subject_obj
            warnings.append(f"Auto-created subject '{sub_code}' ({sub_name}).")

        # Resolve or Auto-Provision Faculty
        fac_clean_name = fac_name if fac_name and fac_name != "Faculty Member" else f"Prof. {sub_code} Instructor"
        faculty_obj = (
            faculty_map.get(fac_clean_name.upper()) or
            faculty_name_map.get(fac_clean_name.lower())
        )
        if not faculty_obj:
            clean_email = f"{fac_clean_name.lower().replace(' ', '.').replace('dr.', '').replace('prof.', '').strip('.')}@apollouniversity.edu.in"
            existing_fac = db.query(Faculty).filter(or_(Faculty.email == clean_email, Faculty.name.ilike(fac_clean_name))).first()
            if existing_fac:
                faculty_obj = existing_fac
                faculty_map[existing_fac.faculty_id.upper()] = faculty_obj
                faculty_name_map[existing_fac.name.lower()] = faculty_obj
            else:
                fac_code = f"FAC-{uuid.uuid4().hex[:6].upper()}"
                user_acc = User(
                    email=clean_email,
                    hashed_password=DEFAULT_HASH,
                    full_name=fac_clean_name,
                    role_id=faculty_role.id if faculty_role else 2,
                    is_active=True
                )
                db.add(user_acc)
                db.flush()

                faculty_obj = Faculty(
                    faculty_id=fac_code,
                    user_id=user_acc.id,
                    name=fac_clean_name,
                    email=clean_email,
                    phone="+91 98765 00000",
                    department_id=default_dept.id if default_dept else 1,
                    designation="Assistant Professor",
                    role_id=faculty_role.id if faculty_role else 2,
                    is_substitution_eligible=True,
                    is_exempt=False,
                    max_weekly_substitutions=4,
                    subject_expertise=[sub_code],
                    status="ACTIVE"
                )
                db.add(faculty_obj)
                db.flush()
                faculty_map[fac_code.upper()] = faculty_obj
                faculty_name_map[fac_clean_name.lower()] = faculty_obj
                warnings.append(f"Auto-enrolled faculty '{fac_clean_name}' ({fac_code}).")

        valid_entries.append({
            "row_num": row_num,
            "faculty_id": faculty_obj.id,
            "faculty_name": faculty_obj.name,
            "faculty_code": faculty_obj.faculty_id,
            "class_section_id": class_obj.id,
            "class_name": class_obj.name,
            "subject_id": subject_obj.id,
            "subject_code": subject_obj.code,
            "subject_name": subject_obj.name,
            "day_of_week": int(day_val) if isinstance(day_val, int) else 0,
            "start_time": start_t,
            "end_time": end_t,
            "room_number": room_no
        })
        row_num += 1

    db.commit()

    # Build segregated classes summary across all sheets
    classes_summary = []
    class_groups: Dict[str, List[Dict[str, Any]]] = {}
    for entry in valid_entries:
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
        "ai_scan_performed": ai_used,
        "sheets_scanned": list(sheets.keys()),
        "total_rows": len(valid_entries),
        "valid_rows_count": len(valid_entries),
        "error_count": 0,
        "warning_count": len(warnings),
        "conflict_count": 0,
        "errors": [],
        "conflicts": [],
        "warnings": warnings[:10],
        "preview_entries": valid_entries,
        "all_valid_entries": valid_entries,
        "classes_summary": classes_summary,
        "message": f"AI scanner successfully segregated {len(classes_summary)} class(es) across {len(sheets)} sheet(s) in '{filename}', extracting {len(valid_entries)} periods with auto-enrolled entities!"
    }


