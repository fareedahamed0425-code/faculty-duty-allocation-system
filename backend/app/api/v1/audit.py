from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import AuditLog
from app.schemas.schemas import AuditLogOut
from app.api.deps import get_current_user, require_admin

router = APIRouter()

@router.get("", response_model=List[AuditLogOut])
def list_audit_logs(
    event_type: Optional[str] = None,
    requirement_id: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    query = db.query(AuditLog)
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    if requirement_id:
        query = query.filter(AuditLog.requirement_id == requirement_id)
    if search:
        s = f"%{search}%"
        query = query.filter((AuditLog.event_type.ilike(s)) | (AuditLog.actor_name.ilike(s)))

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return logs
