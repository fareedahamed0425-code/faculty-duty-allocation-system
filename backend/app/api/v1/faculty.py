from datetime import date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import Faculty, Department, Role, TimetableVersion, TimetableEntry, SubstitutionDuty
from app.schemas.schemas import FacultyOut, FacultyCreate, FacultyUpdate, DepartmentOut
from app.api.deps import get_current_user, require_admin
from app.allocation.constraints import get_week_bounds
from app.services.ai_faculty_extractor import (
    preview_faculty_import,
    commit_faculty_import,
    generate_faculty_template_csv
)

router = APIRouter()

def enrich_faculty_out(faculty: Faculty, db: Session, target_date: Optional[date] = None) -> FacultyOut:
    if not target_date:
        target_date = date.today()

    week_start, week_end = get_week_bounds(target_date)
    sub_count = db.query(SubstitutionDuty).filter(
        SubstitutionDuty.assigned_faculty_id == faculty.id,
        SubstitutionDuty.date >= week_start,
        SubstitutionDuty.date <= week_end,
        SubstitutionDuty.status != "CANCELLED"
    ).count()

    active_version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
    today_reg = 0
    if active_version:
        today_reg = db.query(TimetableEntry).filter(
            TimetableEntry.timetable_version_id == active_version.id,
            TimetableEntry.faculty_id == faculty.id,
            TimetableEntry.day_of_week == target_date.weekday()
        ).count()

    return FacultyOut(
        id=faculty.id,
        faculty_id=faculty.faculty_id,
        user_id=faculty.user_id,
        name=faculty.name,
        email=faculty.email,
        phone=faculty.phone,
        department_id=faculty.department_id,
        department_code=faculty.department.code if faculty.department else None,
        department_name=faculty.department.name if faculty.department else None,
        designation=faculty.designation,
        role_id=faculty.role_id,
        role_name=faculty.role.name if faculty.role else None,
        is_substitution_eligible=faculty.is_substitution_eligible,
        is_exempt=faculty.is_exempt,
        max_weekly_substitutions=faculty.max_weekly_substitutions or 4,
        subject_expertise=faculty.subject_expertise or [],
        status=faculty.status,
        weekly_substitution_count=sub_count,
        today_regular_classes_count=today_reg,
        created_at=faculty.created_at
    )

@router.get("", response_model=List[FacultyOut])
def list_faculty(
    department_id: Optional[int] = None,
    is_exempt: Optional[bool] = None,
    is_eligible: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Faculty)
    if department_id:
        query = query.filter(Faculty.department_id == department_id)
    if is_exempt is not None:
        query = query.filter(Faculty.is_exempt == is_exempt)
    if is_eligible is not None:
        query = query.filter(Faculty.is_substitution_eligible == is_eligible)
    if search:
        s = f"%{search}%"
        query = query.filter((Faculty.name.ilike(s)) | (Faculty.faculty_id.ilike(s)) | (Faculty.email.ilike(s)))

    faculty_list = query.order_by(Faculty.id.asc()).all()
    return [enrich_faculty_out(f, db) for f in faculty_list]

@router.get("/departments", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).order_by(Department.code.asc()).all()

@router.get("/template/csv")
def download_faculty_template_csv():
    """
    Returns downloadable CSV template for faculty roster uploads.
    """
    csv_content = generate_faculty_template_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=faculty_roster_template.csv"}
    )

@router.post("/upload-ai/preview")
async def preview_faculty_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """
    Upload a faculty list file (Excel, CSV, TXT). Uses NVIDIA Nemotron AI with heuristic fallback
    to extract faculty, resolve departments/roles, and return structured preview before committing.
    """
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    result = preview_faculty_import(db, file_bytes, file.filename or "faculty_list.csv")
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result

@router.post("/upload-ai/commit")
def commit_faculty_upload(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    """
    Commits validated faculty list to the database, auto-linking existing user accounts.
    """
    faculty_entries = payload.get("faculty_entries", [])
    if not faculty_entries:
        raise HTTPException(status_code=400, detail="No faculty entries provided for commit.")

    result = commit_faculty_import(db, faculty_entries)
    return result

@router.get("/{faculty_id}", response_model=FacultyOut)
def get_faculty_detail(
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail=f"Faculty #{faculty_id} not found.")
    return enrich_faculty_out(faculty, db)

@router.patch("/{faculty_id}", response_model=FacultyOut)
def update_faculty(
    faculty_id: int,
    payload: FacultyUpdate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail=f"Faculty #{faculty_id} not found.")

    update_data = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(faculty, field, value)

    db.commit()
    db.refresh(faculty)
    return enrich_faculty_out(faculty, db)

@router.post("", response_model=FacultyOut)
def create_faculty(
    payload: FacultyCreate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    existing = db.query(Faculty).filter(
        (Faculty.faculty_id == payload.faculty_id) | (Faculty.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Faculty ID or Email already exists.")

    faculty = Faculty(**payload.dict())
    db.add(faculty)
    db.commit()
    db.refresh(faculty)
    return enrich_faculty_out(faculty, db)

