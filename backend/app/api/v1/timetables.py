from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import TimetableVersion, TimetableEntry, Faculty, ClassSection, Subject
from app.schemas.schemas import (
    TimetableVersionOut, TimetableEntryOut, TimetableImportPreview, TimetableImportConfirm
)
from app.api.deps import get_current_user, require_admin
from app.services.timetable_service import parse_and_validate_timetable_file, commit_timetable_version

router = APIRouter()

def enrich_entry_out(e: TimetableEntry) -> TimetableEntryOut:
    return TimetableEntryOut(
        id=e.id,
        timetable_version_id=e.timetable_version_id,
        faculty_id=e.faculty_id,
        faculty_name=e.faculty.name if e.faculty else None,
        class_section_id=e.class_section_id,
        class_name=e.class_section.name if e.class_section else None,
        subject_id=e.subject_id,
        subject_code=e.subject.code if e.subject else None,
        subject_name=e.subject.name if e.subject else None,
        day_of_week=e.day_of_week,
        start_time=e.start_time,
        end_time=e.end_time,
        room_number=e.room_number
    )

@router.get("/versions", response_model=List[TimetableVersionOut])
def list_versions(db: Session = Depends(get_db)):
    versions = db.query(TimetableVersion).order_by(TimetableVersion.id.desc()).all()
    out = []
    for v in versions:
        out.append(TimetableVersionOut(
            id=v.id,
            name=v.name,
            academic_year=v.academic_year,
            semester=v.semester,
            is_active=v.is_active,
            created_by=v.created_by,
            created_at=v.created_at,
            total_entries=len(v.entries)
        ))
    return out

@router.get("/active/entries", response_model=List[TimetableEntryOut])
def get_active_timetable_entries(
    faculty_id: Optional[int] = None,
    class_section_id: Optional[int] = None,
    day_of_week: Optional[int] = None,
    db: Session = Depends(get_db)
):
    active_version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
    if not active_version:
        return []

    query = db.query(TimetableEntry).filter(TimetableEntry.timetable_version_id == active_version.id)
    if faculty_id:
        query = query.filter(TimetableEntry.faculty_id == faculty_id)
    if class_section_id:
        query = query.filter(TimetableEntry.class_section_id == class_section_id)
    if day_of_week is not None:
        query = query.filter(TimetableEntry.day_of_week == day_of_week)

    entries = query.order_by(TimetableEntry.day_of_week, TimetableEntry.start_time).all()
    return [enrich_entry_out(e) for e in entries]

@router.post("/import/preview", response_model=TimetableImportPreview)
async def preview_timetable_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    content = await file.read()
    result = parse_and_validate_timetable_file(db, content, file.filename)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@router.post("/import/confirm")
def confirm_timetable_import(
    payload: TimetableImportConfirm,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    if not payload.entries:
        raise HTTPException(status_code=400, detail="No entries provided to import.")

    result = commit_timetable_version(
        db=db,
        version_name=payload.version_name,
        entries_data=payload.entries,
        academic_year=payload.academic_year,
        semester=payload.semester,
        activate_immediately=payload.activate_immediately,
        created_by=admin_user.full_name
    )
    return result

@router.post("/versions/{version_id}/activate")
def activate_version(
    version_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    version = db.query(TimetableVersion).filter(TimetableVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail=f"Timetable version #{version_id} not found.")

    db.query(TimetableVersion).filter(TimetableVersion.is_active == True).update({"is_active": False})
    version.is_active = True
    db.commit()
    return {"success": True, "message": f"Timetable version '{version.name}' is now active."}
