from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import Absence, Faculty, SubstitutionRequirement
from app.schemas.schemas import (
    AbsenceCreate, AbsenceOut, AdvanceLeaveCreate,
    AttendanceToggleRequest, AttendanceStatusOut
)
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
        end_date=a.end_date,
        leave_type=a.leave_type or "CASUAL",
        applied_by_role=a.applied_by_role or "FACULTY",
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
        query = query.filter(
            (Absence.date == target_date) | 
            ((Absence.end_date != None) & (Absence.date <= target_date) & (Absence.end_date >= target_date))
        )

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
        end_date=payload.end_date,
        leave_type=payload.leave_type,
        applied_by_role=current_user.role.name if current_user.role else "ADMIN",
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

@router.post("/advance-leave")
def apply_advance_leave(
    payload: AdvanceLeaveCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Resolve target faculty_id
    target_fac_id = payload.faculty_id or current_user.faculty_id
    if not target_fac_id:
        # Check if user has an associated faculty record
        fac = db.query(Faculty).filter(Faculty.user_id == current_user.id).first()
        if fac:
            target_fac_id = fac.id
        else:
            raise HTTPException(status_code=400, detail="No faculty profile found for this user. Please specify faculty_id.")

    user_role_name = current_user.role.name if current_user.role else "FACULTY"

    result = create_faculty_absence(
        db=db,
        faculty_id=target_fac_id,
        absence_date=payload.from_date,
        end_date=payload.to_date,
        leave_type=payload.leave_type,
        applied_by_role=user_role_name,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_full_day=payload.is_full_day,
        reason=payload.reason,
        reported_by=current_user.full_name,
        auto_allocate=payload.auto_allocate
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to apply advance leave."))
    return result

@router.post("/attendance-toggle")
def toggle_attendance(
    payload: AttendanceToggleRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    target_fac_id = payload.faculty_id or current_user.faculty_id
    if not target_fac_id:
        fac = db.query(Faculty).filter(Faculty.user_id == current_user.id).first()
        if fac:
            target_fac_id = fac.id
        else:
            raise HTTPException(status_code=400, detail="No faculty profile associated with user.")

    fac = db.query(Faculty).filter(Faculty.id == target_fac_id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Faculty member not found.")

    target_d = payload.target_date or date.today()

    if payload.status.upper() == "ABSENT":
        # Check if absence already exists for this date
        existing_abs = db.query(Absence).filter(
            Absence.faculty_id == target_fac_id,
            Absence.date == target_d,
            Absence.status == "CONFIRMED"
        ).first()
        if not existing_abs:
            res = create_faculty_absence(
                db=db,
                faculty_id=target_fac_id,
                absence_date=target_d,
                leave_type="CASUAL",
                applied_by_role=current_user.role.name if current_user.role else "FACULTY",
                reason=payload.reason or "Marked Absent via Portal Attendance Toggle",
                reported_by=current_user.full_name,
                auto_allocate=True
            )
            return {"success": True, "status": "ABSENT", "message": f"{fac.name} marked as Absent. Affected classes auto-allocated.", "details": res}
        return {"success": True, "status": "ABSENT", "message": f"{fac.name} is already recorded as Absent on {target_d}."}
    else:
        # Mark as PRESENT -> Cancel any active absence for today
        existing_abs = db.query(Absence).filter(
            Absence.faculty_id == target_fac_id,
            Absence.date == target_d,
            Absence.status == "CONFIRMED"
        ).first()
        if existing_abs:
            cancel_faculty_absence(db, existing_abs.id, cancelled_by=current_user.full_name)
            return {"success": True, "status": "PRESENT", "message": f"{fac.name} marked as Present. Absences and substitution duties reverted."}
        return {"success": True, "status": "PRESENT", "message": f"{fac.name} is marked as Present for {target_d}."}

@router.get("/attendance-status", response_model=AttendanceStatusOut)
def get_attendance_status(
    faculty_id: Optional[int] = None,
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    target_fac_id = faculty_id or current_user.faculty_id
    if not target_fac_id:
        fac = db.query(Faculty).filter(Faculty.user_id == current_user.id).first()
        if fac:
            target_fac_id = fac.id
        else:
            raise HTTPException(status_code=400, detail="No faculty profile found.")

    fac = db.query(Faculty).filter(Faculty.id == target_fac_id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Faculty member not found.")

    eval_date = target_date or date.today()

    active_abs = db.query(Absence).filter(
        Absence.faculty_id == target_fac_id,
        Absence.status == "CONFIRMED",
        (Absence.date == eval_date) | 
        ((Absence.end_date != None) & (Absence.date <= eval_date) & (Absence.end_date >= eval_date))
    ).first()

    upcoming_count = db.query(Absence).filter(
        Absence.faculty_id == target_fac_id,
        Absence.status == "CONFIRMED",
        Absence.date > eval_date
    ).count()

    return AttendanceStatusOut(
        faculty_id=fac.id,
        faculty_name=fac.name,
        date=eval_date,
        status="ABSENT" if active_abs else "PRESENT",
        active_leave={
            "id": active_abs.id,
            "leave_type": active_abs.leave_type,
            "reason": active_abs.reason,
            "from_date": str(active_abs.date),
            "to_date": str(active_abs.end_date or active_abs.date),
            "is_full_day": active_abs.is_full_day
        } if active_abs else None,
        upcoming_leaves_count=upcoming_count
    )

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
