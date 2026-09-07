from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import AcademicHoliday
from app.schemas.schemas import AcademicHolidayCreate, AcademicHolidayOut, CheckDateOut
from app.api.deps import get_current_user, require_admin

router = APIRouter()

def get_second_saturday_for_month(year: int, month: int) -> date:
    """Calculates the 2nd Saturday for a given month and year."""
    first_day = date(year, month, 1)
    # first_day.weekday(): 0=Mon, 5=Sat
    days_to_first_sat = (5 - first_day.weekday()) % 7
    first_sat = first_day + timedelta(days=days_to_first_sat)
    second_sat = first_sat + timedelta(days=7)
    return second_sat

def is_date_second_saturday(d: date) -> bool:
    if d.weekday() != 5:  # Not Saturday
        return False
    # If it's a Saturday, check if it's the 2nd Saturday of its month
    second_sat = get_second_saturday_for_month(d.year, d.month)
    return d == second_sat

def ensure_initial_holidays_seeded(db: Session, year: int = 2026):
    """Auto-seeds institutional holidays and 2nd Saturdays for the academic year if empty."""
    count = db.query(AcademicHoliday).filter(AcademicHoliday.academic_year == str(year)).count()
    if count > 0:
        return

    # Standard Academic & National Holidays for 2026
    default_holidays = [
        {"name": "Republic Day", "date": date(year, 1, 26), "holiday_type": "NATIONAL_HOLIDAY", "description": "National Holiday"},
        {"name": "Maha Shivaratri", "date": date(year, 2, 16), "holiday_type": "FESTIVAL", "description": "Institutional Holiday"},
        {"name": "Holi Festival", "date": date(year, 3, 4), "holiday_type": "FESTIVAL", "description": "Festival of Colors"},
        {"name": "Good Friday", "date": date(year, 4, 3), "holiday_type": "FESTIVAL", "description": "Institutional Holiday"},
        {"name": "Eid-ul-Fitr", "date": date(year, 3, 20), "holiday_type": "FESTIVAL", "description": "Festival Holiday"},
        {"name": "Dr. B.R. Ambedkar Jayanti", "date": date(year, 4, 14), "holiday_type": "NATIONAL_HOLIDAY", "description": "Ambedkar Jayanti"},
        {"name": "Summer Semester Recess", "date": date(year, 5, 15), "holiday_type": "SEMESTER_BREAK", "description": "Academic Recess"},
        {"name": "Independence Day", "date": date(year, 8, 15), "holiday_type": "NATIONAL_HOLIDAY", "description": "National Flag Hoisting & Celebrations"},
        {"name": "Ganesh Chaturthi", "date": date(year, 9, 14), "holiday_type": "FESTIVAL", "description": "Festival Holiday"},
        {"name": "Mahatma Gandhi Jayanti", "date": date(year, 10, 2), "holiday_type": "NATIONAL_HOLIDAY", "description": "National Holiday"},
        {"name": "Dussehra / Vijaya Dashami", "date": date(year, 10, 20), "holiday_type": "FESTIVAL", "description": "Festival Holiday"},
        {"name": "Diwali Festival of Lights", "date": date(year, 11, 8), "holiday_type": "FESTIVAL", "description": "Deepavali Institutional Holiday"},
        {"name": "Christmas Day", "date": date(year, 12, 25), "holiday_type": "FESTIVAL", "description": "Christmas Celebration"},
    ]

    # Add 2nd Saturdays for all 12 months
    for month in range(1, 13):
        sat_date = get_second_saturday_for_month(year, month)
        default_holidays.append({
            "name": f"Second Saturday ({sat_date.strftime('%B')})",
            "date": sat_date,
            "holiday_type": "SECOND_SATURDAY",
            "description": "Monthly Institutional Non-Working Day"
        })

    for h in default_holidays:
        existing = db.query(AcademicHoliday).filter(AcademicHoliday.date == h["date"]).first()
        if not existing:
            db.add(AcademicHoliday(
                name=h["name"],
                date=h["date"],
                holiday_type=h["holiday_type"],
                academic_year=str(year),
                description=h["description"],
                is_recurring=True
            ))
    db.commit()

@router.get("/holidays", response_model=List[AcademicHolidayOut])
def list_academic_holidays(
    academic_year: str = "2026",
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    ensure_initial_holidays_seeded(db, int(academic_year) if academic_year.isdigit() else 2026)
    holidays = db.query(AcademicHoliday).filter(
        AcademicHoliday.academic_year == academic_year
    ).order_by(AcademicHoliday.date.asc()).all()
    return holidays

@router.get("/check-date", response_model=CheckDateOut)
def check_date_working_status(
    target_date: date = Query(..., description="Target date to evaluate"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    ensure_initial_holidays_seeded(db, target_date.year)
    
    # Check if Sunday
    is_sun = target_date.weekday() == 6
    is_sec_sat = is_date_second_saturday(target_date)

    holiday = db.query(AcademicHoliday).filter(AcademicHoliday.date == target_date).first()

    is_hol = (holiday is not None) or is_sec_sat or is_sun
    hol_name = holiday.name if holiday else ("Second Saturday (Non-Working)" if is_sec_sat else ("Sunday (Weekly Off)" if is_sun else None))
    hol_type = holiday.holiday_type if holiday else ("SECOND_SATURDAY" if is_sec_sat else ("WEEKLY_OFF" if is_sun else None))

    is_work = not (is_sun or is_sec_sat or (holiday is not None and holiday.holiday_type != "ACADEMIC_EVENT"))

    day_name = target_date.strftime("%A")

    return CheckDateOut(
        date=target_date,
        day_name=day_name,
        is_holiday=is_hol,
        holiday_name=hol_name,
        holiday_type=hol_type,
        is_second_saturday=is_sec_sat,
        is_sunday=is_sun,
        is_working_day=is_work
    )

@router.post("/holidays", response_model=AcademicHolidayOut)
def add_academic_holiday(
    payload: AcademicHolidayCreate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    existing = db.query(AcademicHoliday).filter(AcademicHoliday.date == payload.date).first()
    if existing:
        existing.name = payload.name
        existing.holiday_type = payload.holiday_type
        existing.academic_year = payload.academic_year
        existing.description = payload.description
        existing.is_recurring = payload.is_recurring
        db.commit()
        db.refresh(existing)
        return existing

    new_h = AcademicHoliday(
        name=payload.name,
        date=payload.date,
        holiday_type=payload.holiday_type,
        academic_year=payload.academic_year,
        description=payload.description,
        is_recurring=payload.is_recurring
    )
    db.add(new_h)
    db.commit()
    db.refresh(new_h)
    return new_h

@router.delete("/holidays/{holiday_id}")
def delete_academic_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    h = db.query(AcademicHoliday).filter(AcademicHoliday.id == holiday_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holiday not found.")
    db.delete(h)
    db.commit()
    return {"success": True, "message": "Academic holiday deleted successfully."}
