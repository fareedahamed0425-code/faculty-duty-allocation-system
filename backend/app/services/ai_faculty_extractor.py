import io
import re
import json
import uuid
import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from openai import OpenAI

from app.core.config import settings
from app.models.entities import Faculty, Department, Role, User
from app.core.security import get_password_hash

def extract_text_from_faculty_file(file_bytes: bytes, filename: str) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Extracts raw text and parsed tabular rows from Excel or CSV files.
    """
    raw_text = ""
    rows_data: List[Dict[str, Any]] = []

    try:
        if filename.endswith((".xlsx", ".xls")):
            excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
            combined_csvs = []
            for sheet_name in excel_file.sheet_names:
                df = excel_file.parse(sheet_name)
                # Drop rows where all elements are NaN
                df = df.dropna(how="all").dropna(axis=1, how="all")
                if not df.empty:
                    csv_rep = df.to_csv(index=False)
                    combined_csvs.append(f"--- Sheet: {sheet_name} ---\n{csv_rep}")
                    # Collect records
                    for _, r in df.iterrows():
                        row_dict = {str(k).strip(): (None if pd.isna(v) else str(v).strip()) for k, v in r.items()}
                        rows_data.append(row_dict)
            raw_text = "\n\n".join(combined_csvs)
        elif filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_bytes))
            df = df.dropna(how="all").dropna(axis=1, how="all")
            raw_text = df.to_csv(index=False)
            for _, r in df.iterrows():
                row_dict = {str(k).strip(): (None if pd.isna(v) else str(v).strip()) for k, v in r.items()}
                rows_data.append(row_dict)
        else:
            # Plain text or decoded string
            raw_text = file_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"Error parsing faculty file: {e}")
        raw_text = file_bytes.decode("utf-8", errors="ignore")

    return raw_text, rows_data


def clean_name_string(name: str) -> str:
    """
    Strips out honorary titles (Dr., Prof., Mr., Mrs., Ms., Er.) and extra spaces for matching.
    """
    if not name:
        return ""
    cleaned = re.sub(r'^(dr\.|prof\.|mr\.|mrs\.|ms\.|er\.|dr|prof|mr|mrs|ms|er)\s+', '', name.strip(), flags=re.IGNORECASE)
    return " ".join(cleaned.split())


def call_llm_for_faculty_extraction(raw_text: str, filename: str) -> List[Dict[str, Any]]:
    """
    Calls NVIDIA Nemotron / OpenAI LLM to intelligently extract structured faculty profiles.
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

    prompt = f"""You are an expert AI data extraction system for university faculty rosters and personnel documents.
Scan and intelligently understand the following faculty roster content from file '{filename}'.
The file may have non-standard columns, combined fields, abbreviations, or inconsistent formatting.

Raw Content:
```text
{raw_text[:7000]}
```

Extract all faculty members into a clean JSON array of objects.
Each object MUST have:
- "faculty_id": string (e.g. "FAC-101", "EMP-042", or empty string if not given)
- "name": string (Full name of the faculty member, e.g. "Dr. Sarah Jenkins", "Prof. K. Suresh", "Anil Kumar")
- "email": string (e.g. "sarah.jenkins@university.edu" or standard institutional email if derivable, else empty string)
- "phone": string (e.g. "+91 98765 43210" or empty string)
- "department": string (e.g. "Computer Science & Engineering", "CSE", "ECE", "Mechanical Engineering", "Mathematics")
- "designation": string (e.g. "Professor", "Associate Professor", "Assistant Professor", "Dean", "HOD", "Lecturer")
- "role": string (One of: "FACULTY", "HOD", "DEAN", "ADMIN", "PC", "COMMITTEE_MEMBER")
- "is_exempt": boolean (true if Dean, HOD, PC, or administrative leadership exempt from substitution duty; false for regular teaching faculty)
- "is_substitution_eligible": boolean (true if eligible for substitution duties; false if exempt or administrative only)
- "max_weekly_substitutions": integer (default 4, or 0 if exempt)
- "subject_expertise": array of strings (e.g. ["Machine Learning", "Data Structures", "Python"] or subject codes)

Rules:
1. Extract ALL valid faculty records. Ignore blank rows or non-person header rows.
2. If role is not explicitly specified: if designation has "Dean", role="DEAN"; if "Head" or "HOD", role="HOD"; else role="FACULTY".
3. If email is missing, generate a plausible institutional email like "firstname.lastname@university.edu.in".
4. Output ONLY a valid JSON array (starting with `[` and ending with `]`). No commentary, explanations, or markdown.
"""

    try:
        response = client.chat.completions.create(
            model=settings.NVIDIA_MODEL,
            messages=[
                {"role": "system", "content": "You are a precise institutional roster extraction AI that outputs only structured JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=3500,
            timeout=12.0
        )
        content = response.choices[0].message.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        parsed = json.loads(content)
        if isinstance(parsed, list):
            return parsed
        elif isinstance(parsed, dict) and "faculty" in parsed:
            return parsed["faculty"]
    except Exception as e:
        print(f"AI faculty extraction LLM call error: {e}")

    return []


def heuristic_faculty_extractor(rows_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deterministic fallback parser for structured CSV / Excel files with standard headers.
    """
    entries = []
    if not rows_data:
        return entries

    for row in rows_data:
        # Normalize keys to lowercase for flexible matching
        norm_row = {k.lower().strip(): v for k, v in row.items() if k and v is not None}

        # Find Name
        name_val = None
        for key in ["name", "faculty name", "faculty_name", "full name", "full_name", "teacher name", "professor", "employee name"]:
            if key in norm_row and norm_row[key]:
                name_val = norm_row[key]
                break

        if not name_val:
            # Check first string column that looks like a name
            for k, v in norm_row.items():
                if isinstance(v, str) and len(v.strip()) > 3 and not re.match(r'^\d+$', v.strip()) and "@" not in v:
                    name_val = v.strip()
                    break

        if not name_val or name_val.lower() in ["total", "sl.no", "s.no", "serial no", "legend"]:
            continue

        # Find Email
        email_val = None
        for key in ["email", "email id", "email_id", "mail", "contact email"]:
            if key in norm_row and norm_row[key]:
                email_val = norm_row[key]
                break
        if not email_val:
            for k, v in norm_row.items():
                if isinstance(v, str) and "@" in v:
                    email_val = v.strip()
                    break
        if not email_val:
            clean_n = clean_name_string(name_val).lower().replace(" ", ".")
            email_val = f"{clean_n}@apollouniversity.edu.in"

        # Find Faculty ID / Code
        fac_id_val = None
        for key in ["faculty_id", "faculty id", "id", "emp_id", "emp id", "employee id", "code", "faculty code"]:
            if key in norm_row and norm_row[key]:
                fac_id_val = norm_row[key]
                break

        # Find Department
        dept_val = None
        for key in ["department", "dept", "dept.", "branch", "department_name", "dept_code"]:
            if key in norm_row and norm_row[key]:
                dept_val = norm_row[key]
                break
        if not dept_val:
            dept_val = "Computer Science & Engineering"

        # Find Designation
        desig_val = None
        for key in ["designation", "role", "title", "position"]:
            if key in norm_row and norm_row[key]:
                desig_val = norm_row[key]
                break
        if not desig_val:
            desig_val = "Assistant Professor"

        # Find Phone
        phone_val = None
        for key in ["phone", "mobile", "contact", "contact_no", "phone number", "mobile number"]:
            if key in norm_row and norm_row[key]:
                phone_val = norm_row[key]
                break

        # Find Subjects / Expertise
        subj_val = []
        for key in ["subject", "subjects", "expertise", "specialization", "subject_expertise", "courses"]:
            if key in norm_row and norm_row[key]:
                val = norm_row[key]
                if isinstance(val, list):
                    subj_val = val
                else:
                    subj_val = [s.strip() for s in str(val).split(",") if s.strip()]
                break

        # Determine Role & Exemption
        desig_lower = desig_val.lower()
        role_val = "FACULTY"
        is_exempt = False
        is_eligible = True

        if "dean" in desig_lower:
            role_val = "DEAN"
            is_exempt = True
            is_eligible = False
        elif "hod" in desig_lower or "head" in desig_lower:
            role_val = "HOD"
            is_exempt = True
            is_eligible = False
        elif "admin" in desig_lower:
            role_val = "ADMIN"
            is_exempt = True
            is_eligible = False
        elif "coordinator" in desig_lower or "pc" in desig_lower:
            role_val = "PC"
            is_exempt = True
            is_eligible = False

        entries.append({
            "faculty_id": fac_id_val or "",
            "name": name_val,
            "email": email_val,
            "phone": phone_val or "+91 98765 00000",
            "department": dept_val,
            "designation": desig_val,
            "role": role_val,
            "is_exempt": is_exempt,
            "is_substitution_eligible": is_eligible,
            "max_weekly_substitutions": 0 if is_exempt else 4,
            "subject_expertise": subj_val
        })

    return entries


def preview_faculty_import(
    db: Session,
    file_bytes: bytes,
    filename: str
) -> Dict[str, Any]:
    """
    Scans the uploaded roster file using AI (with fallback), cross-references against the DB,
    and returns a categorized preview of records ready for user review and commit.
    """
    raw_text, rows_data = extract_text_from_faculty_file(file_bytes, filename)
    if not raw_text and not rows_data:
        return {"error": f"Could not read content from file '{filename}'."}

    # 1. Try AI Extraction first
    ai_used = False
    extracted_entries = []
    try:
        ai_entries = call_llm_for_faculty_extraction(raw_text, filename)
        if ai_entries and len(ai_entries) > 0:
            extracted_entries = ai_entries
            ai_used = True
    except Exception as e:
        print(f"AI extraction attempt failed: {e}")

    # 2. Fallback to Heuristic Parser if AI returned empty or failed
    if not extracted_entries:
        extracted_entries = heuristic_faculty_extractor(rows_data)

    if not extracted_entries:
        return {"error": f"No valid faculty entries could be detected in '{filename}'. Please verify file format."}

    # Pre-fetch database lookups
    all_departments = db.query(Department).all()
    dept_code_map = {d.code.upper(): d for d in all_departments}
    dept_name_map = {d.name.lower(): d for d in all_departments}
    default_dept = all_departments[0] if all_departments else None

    all_roles = db.query(Role).all()
    role_map = {r.name.upper(): r for r in all_roles}
    default_faculty_role = role_map.get("FACULTY")

    existing_faculties = db.query(Faculty).all()
    faculty_by_email = {f.email.lower(): f for f in existing_faculties}
    faculty_by_clean_name = {clean_name_string(f.name).lower(): f for f in existing_faculties}
    faculty_by_code = {f.faculty_id.upper(): f for f in existing_faculties if f.faculty_id}

    existing_users = db.query(User).all()
    user_by_email = {u.email.lower(): u for u in existing_users}
    user_by_clean_name = {clean_name_string(u.full_name).lower(): u for u in existing_users}

    preview_items = []
    warnings = []
    new_count = 0
    update_count = 0
    linked_user_count = 0

    def resolve_department(dept_str: Optional[str]) -> Tuple[int, str, str]:
        if not dept_str:
            return (default_dept.id if default_dept else 1, default_dept.code if default_dept else "CSE", default_dept.name if default_dept else "General")
        
        dept_clean = dept_str.strip()
        # Direct code match
        if dept_clean.upper() in dept_code_map:
            d = dept_code_map[dept_clean.upper()]
            return (d.id, d.code, d.name)
        
        # Direct name match
        if dept_clean.lower() in dept_name_map:
            d = dept_name_map[dept_clean.lower()]
            return (d.id, d.code, d.name)

        # Substring search
        for d in all_departments:
            if d.code.upper() in dept_clean.upper() or d.name.lower() in dept_clean.lower():
                return (d.id, d.code, d.name)

        # If not found, return default
        return (default_dept.id if default_dept else 1, default_dept.code if default_dept else "CSE", default_dept.name if default_dept else "General")

    for idx, entry in enumerate(extracted_entries, 1):
        raw_name = str(entry.get("name", "")).strip()
        if not raw_name:
            continue

        raw_email = str(entry.get("email", "")).strip().lower()
        if not raw_email or "@" not in raw_email:
            clean_n = clean_name_string(raw_name).lower().replace(" ", ".")
            raw_email = f"{clean_n}@apollouniversity.edu.in"

        raw_code = str(entry.get("faculty_id", "")).strip().upper()
        raw_phone = str(entry.get("phone", "+91 98765 00000")).strip()
        raw_dept = str(entry.get("department", "CSE")).strip()
        raw_desig = str(entry.get("designation", "Assistant Professor")).strip()
        raw_role = str(entry.get("role", "FACULTY")).strip().upper()
        
        dept_id, dept_code, dept_name = resolve_department(raw_dept)
        
        # Resolve role
        role_obj = role_map.get(raw_role) or default_faculty_role
        role_name = role_obj.name if role_obj else "FACULTY"

        # Exemption / Eligibility resolution
        is_leadership = role_name in ["ADMIN", "DEAN", "HOD", "PC", "COMMITTEE_MEMBER"] or "dean" in raw_desig.lower() or "head" in raw_desig.lower()
        is_exempt = bool(entry.get("is_exempt", is_leadership))
        is_eligible = bool(entry.get("is_substitution_eligible", not is_leadership))
        max_weekly = 0 if is_exempt else int(entry.get("max_weekly_substitutions", 4) or 4)

        expertise = entry.get("subject_expertise", [])
        if isinstance(expertise, str):
            expertise = [s.strip() for s in expertise.split(",") if s.strip()]

        # Check existing match
        clean_n = clean_name_string(raw_name).lower()
        matched_faculty = faculty_by_email.get(raw_email) or faculty_by_clean_name.get(clean_n) or (faculty_by_code.get(raw_code) if raw_code else None)
        matched_user = user_by_email.get(raw_email) or user_by_clean_name.get(clean_n)

        status_tag = "NEW"
        status_detail = "Will create new faculty profile"
        if matched_faculty:
            status_tag = "UPDATE"
            status_detail = f"Will update existing faculty (#{matched_faculty.faculty_id})"
            update_count += 1
        else:
            new_count += 1

        if matched_user:
            linked_user_count += 1
            status_detail += f" • Matched registered user '{matched_user.email}'"

        preview_items.append({
            "temp_id": idx,
            "faculty_id": raw_code or (matched_faculty.faculty_id if matched_faculty else f"FAC-{uuid.uuid4().hex[:5].upper()}"),
            "name": raw_name,
            "email": raw_email,
            "phone": raw_phone,
            "department_id": dept_id,
            "department_code": dept_code,
            "department_name": dept_name,
            "designation": raw_desig,
            "role_id": role_obj.id if role_obj else None,
            "role_name": role_name,
            "is_exempt": is_exempt,
            "is_substitution_eligible": is_eligible,
            "max_weekly_substitutions": max_weekly,
            "subject_expertise": expertise,
            "status_tag": status_tag,
            "status_detail": status_detail,
            "matched_user_id": matched_user.id if matched_user else None,
            "matched_user_email": matched_user.email if matched_user else None
        })

    return {
        "filename": filename,
        "ai_used": ai_used,
        "total_count": len(preview_items),
        "new_count": new_count,
        "update_count": update_count,
        "linked_user_count": linked_user_count,
        "preview_items": preview_items,
        "warnings": warnings,
        "message": f"Successfully parsed {len(preview_items)} faculty records ({new_count} new, {update_count} to update, {linked_user_count} linked to active accounts)."
    }


def commit_faculty_import(
    db: Session,
    faculty_entries: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Commits the validated list of faculty into the DB, creates/updates Faculty profiles,
    and automatically binds them to User accounts if matching users already exist or when they register.
    """
    if not faculty_entries:
        return {"status": "error", "message": "No faculty entries provided for commit."}

    created_count = 0
    updated_count = 0
    linked_count = 0

    roles_by_name = {r.name.upper(): r for r in db.query(Role).all()}
    default_role = roles_by_name.get("FACULTY")
    departments_by_id = {d.id: d for d in db.query(Department).all()}
    default_dept = db.query(Department).first()

    for item in faculty_entries:
        raw_name = str(item.get("name", "")).strip()
        raw_email = str(item.get("email", "")).strip().lower()
        if not raw_name or not raw_email:
            continue

        raw_code = str(item.get("faculty_id", "")).strip().upper()
        if not raw_code:
            raw_code = f"FAC-{uuid.uuid4().hex[:6].upper()}"

        dept_id = item.get("department_id")
        if not dept_id or dept_id not in departments_by_id:
            dept_id = default_dept.id if default_dept else 1

        role_name = str(item.get("role_name", "FACULTY")).upper()
        role_obj = roles_by_name.get(role_name) or default_role

        is_exempt = bool(item.get("is_exempt", False))
        is_eligible = bool(item.get("is_substitution_eligible", True))
        max_sub = int(item.get("max_weekly_substitutions", 4) or 4)
        expertise = item.get("subject_expertise", [])
        if isinstance(expertise, str):
            expertise = [s.strip() for s in expertise.split(",") if s.strip()]

        # Check existing user
        clean_n = clean_name_string(raw_name).lower()
        matched_user = (
            db.query(User).filter(func.lower(User.email) == raw_email).first() or
            db.query(User).filter(func.lower(User.full_name) == raw_name.lower()).first()
        )

        # Check existing faculty
        existing_faculty = (
            db.query(Faculty).filter(func.lower(Faculty.email) == raw_email).first() or
            db.query(Faculty).filter(Faculty.faculty_id == raw_code).first() or
            db.query(Faculty).filter(func.lower(Faculty.name) == raw_name.lower()).first()
        )

        if existing_faculty:
            # Update existing faculty profile
            existing_faculty.name = raw_name
            existing_faculty.email = raw_email
            if item.get("phone"):
                existing_faculty.phone = item.get("phone")
            existing_faculty.department_id = dept_id
            existing_faculty.designation = item.get("designation", existing_faculty.designation)
            existing_faculty.role_id = role_obj.id if role_obj else existing_faculty.role_id
            existing_faculty.is_exempt = is_exempt
            existing_faculty.is_substitution_eligible = is_eligible
            existing_faculty.max_weekly_substitutions = max_sub
            if expertise:
                existing_faculty.subject_expertise = expertise

            # Link user if available and unlinked
            if matched_user and not existing_faculty.user_id:
                existing_faculty.user_id = matched_user.id
                linked_count += 1
            updated_count += 1
        else:
            # Create new faculty profile
            new_faculty = Faculty(
                faculty_id=raw_code,
                user_id=matched_user.id if matched_user else None,
                name=raw_name,
                email=raw_email,
                phone=item.get("phone", "+91 98765 00000"),
                department_id=dept_id,
                designation=item.get("designation", "Assistant Professor"),
                role_id=role_obj.id if role_obj else None,
                is_substitution_eligible=is_eligible,
                is_exempt=is_exempt,
                max_weekly_substitutions=max_sub,
                subject_expertise=expertise,
                status="ACTIVE"
            )
            db.add(new_faculty)
            created_count += 1
            if matched_user:
                linked_count += 1

    db.commit()

    return {
        "status": "success",
        "created_count": created_count,
        "updated_count": updated_count,
        "linked_count": linked_count,
        "total_processed": len(faculty_entries),
        "message": f"Successfully processed {len(faculty_entries)} faculty ({created_count} added, {updated_count} updated, {linked_count} auto-synced to registered accounts)."
    }


def sync_user_faculty_linkage(db: Session, user: User) -> Optional[Faculty]:
    """
    Checks if an unlinked or pre-uploaded Faculty profile exists matching the User's email
    or clean full name, and binds them together.
    """
    if user.faculty_profile:
        return user.faculty_profile

    clean_email = user.email.strip().lower()
    clean_n = clean_name_string(user.full_name).lower()

    # 1. Try exact email match
    faculty = db.query(Faculty).filter(func.lower(Faculty.email) == clean_email).first()

    # 2. Try clean name match if no email match
    if not faculty and clean_n:
        faculty = db.query(Faculty).filter(func.lower(Faculty.name) == user.full_name.lower()).first()
        if not faculty:
            faculties = db.query(Faculty).all()
            for f in faculties:
                if clean_name_string(f.name).lower() == clean_n:
                    faculty = f
                    break

    if faculty:
        faculty.user_id = user.id
        if user.role_id and not faculty.role_id:
            faculty.role_id = user.role_id
        db.commit()
        db.refresh(user)
        return faculty

    return None


def generate_faculty_template_csv() -> str:
    """
    Generates a sample CSV template for faculty roster uploads.
    """
    sample_rows = [
        "Faculty ID,Full Name,Email,Department,Designation,Phone,Subject Specialization,Role,Is Exempt,Substitution Eligible,Max Weekly Substitutions",
        "FAC-101,Dr. Rajesh Kumar,rajesh.kumar@apollouniversity.edu.in,CSE,Professor,+91 98765 43210,\"Artificial Intelligence, Machine Learning, Deep Learning\",FACULTY,False,True,4",
        "FAC-102,Dr. Priya Sharma,priya.sharma@apollouniversity.edu.in,CSE,Head of Department,+91 98765 43211,\"Data Structures, Algorithms\",HOD,True,False,0",
        "FAC-103,Prof. Ramesh Varma,ramesh.varma@apollouniversity.edu.in,ECE,Associate Professor,+91 98765 43212,\"Signals & Systems, Digital Signal Processing\",FACULTY,False,True,4",
        "FAC-104,Dr. Ananya Sen,ananya.sen@apollouniversity.edu.in,MATH,Dean of Academic Affairs,+91 98765 43213,\"Discrete Mathematics, Linear Algebra\",DEAN,True,False,0",
        "FAC-105,Mr. Vikram Reddy,vikram.reddy@apollouniversity.edu.in,MECH,Assistant Professor,+91 98765 43214,\"Thermodynamics, Fluid Mechanics\",FACULTY,False,True,4"
    ]
    return "\n".join(sample_rows)


