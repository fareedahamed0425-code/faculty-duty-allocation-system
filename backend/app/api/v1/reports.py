from datetime import date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.schemas import DashboardStats, WorkloadReportItem
from app.api.deps import get_current_user
from app.services.report_service import (
    get_dashboard_stats, get_workload_report, get_department_workload_summary
)

router = APIRouter()

@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return get_dashboard_stats(db, target_date)

@router.get("/workload", response_model=List[WorkloadReportItem])
def get_workload(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return get_workload_report(db, target_date)

@router.get("/departments")
def get_department_stats(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return get_department_workload_summary(db, target_date)
