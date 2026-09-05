from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.schemas import AIChatRequest, AIChatResponse
from app.api.deps import get_current_user
from app.ai.client import query_nemotron_ai

router = APIRouter()

@router.post("/chat", response_model=AIChatResponse)
def ai_assistant_chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Interacts with NVIDIA Nemotron 3 30B Omni Flash via controlled backend tools.
    All facts and scheduling rules are strictly resolved through the backend.
    """
    result = query_nemotron_ai(
        db=db,
        user_message=payload.message,
        actor_name=current_user.full_name
    )
    return AIChatResponse(
        reply=result["reply"],
        tool_calls=result.get("tool_calls", []),
        facts_grounded=result.get("facts_grounded", True),
        actions_taken=result.get("actions_taken", [])
    )

@router.get("/suggested-queries")
def get_suggested_queries():
    return [
        {"query": "Show today's dashboard summary and operational state", "category": "Overview"},
        {"query": "Which faculty members have reached their weekly substitution limit?", "category": "Workload"},
        {"query": "Are there any unallocated classes today?", "category": "Alerts"},
        {"query": "Show all recorded absences for today", "category": "Absences"},
        {"query": "List all active faculty in Computer Science & Engineering", "category": "Faculty"}
    ]
