from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import SystemRule, AuditLog
from app.schemas.schemas import SystemRuleOut, SystemRuleUpdate
from app.api.deps import get_current_user, require_admin

router = APIRouter()

@router.get("", response_model=List[SystemRuleOut])
def list_system_rules(db: Session = Depends(get_db)):
    return db.query(SystemRule).order_by(SystemRule.id.asc()).all()

@router.patch("/{rule_id}", response_model=SystemRuleOut)
def update_system_rule(
    rule_id: int,
    payload: SystemRuleUpdate,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    rule = db.query(SystemRule).filter(SystemRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="System rule not found.")

    old_val = rule.rule_value
    rule.rule_value = payload.rule_value
    if payload.is_active is not None:
        rule.is_active = payload.is_active
    rule.updated_by = admin_user.full_name

    audit = AuditLog(
        event_type="SYSTEM_RULE_UPDATED",
        actor_name=admin_user.full_name,
        target_type="SYSTEM_RULE",
        target_id=rule.id,
        details={
            "rule_key": rule.rule_key,
            "old_value": old_val,
            "new_value": payload.rule_value
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(rule)
    return rule
