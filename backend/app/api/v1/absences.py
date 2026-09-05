from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import Absence, Faculty, SubstitutionRequirement
from app.schemas.schemas import AbsenceCreate, AbsenceOut
from app.api.deps import get_current_user, require_admin
from app.services.absence_service import create_faculty_absence, cancel_faculty_absence

router = APIRouter()

def enrich_absence_out(a: Absence) -> AbsenceOut:
    reqs = a.requirements
    affected = len(reqs)
    alloc = sum(1 for r in reqs if r.status == "ALLOCATED")
    unalloc = sum(1 for r in reqs if r.status == "UNALLOCATED")

    return AbsenceOut(
        id=a.id,
        faculty_id=a.faculty_id,
        faculty_name=a.faculty.name if a.faculty else "Unknown",
        faculty_code=a.faculty.faculty_id if a.faculty else "N/A",
        department_name=a.faculty.department.name if a.faculty and a.faculty.department else "N/A",
        date=a.date,
        start_time=a.start_time,
        end_time=a.end_time,
        is_full_day=a.is_full_day,
        reason=a.reason,
        status=a.status,
        reported_by=a.reported_by,
        affected_classes_count=affected,
        allocated_count=alloc,
        unallocated_count=unalloc,
        created_at=a.created_at
    )

@router.get("", response_model=List[AbsenceOut])
def list_absences(
    faculty_id: Optional[int] = None,
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Absence)
    if faculty_id:
        query = query.filter(Absence.faculty_id == faculty_id)
    if target_date:
        query = query.filter(Absence.date == target_date)

    absences = query.order_by(Absence.date.desc(), Absence.id.desc()).all()
    return [enrich_absence_out(a) for a in absences]

@router.post("")
def record_absence(
    payload: AbsenceCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = create_faculty_absence(
        db=db,
        faculty_id=payload.faculty_id,
        absence_date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_full_day=payload.is_full_day,
        reason=payload.reason,
        reported_by=current_user.full_name,
        auto_allocate=payload.auto_allocate
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to record absence."))
    return result

@router.post("/{absence_id}/cancel")
def cancel_absence(
    absence_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    result = cancel_faculty_absence(db, absence_id, cancelled_by=admin_user.full_name)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to cancel absence."))
    return result
