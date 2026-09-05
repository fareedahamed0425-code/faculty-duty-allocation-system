import json
import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import Notification
from app.schemas.schemas import NotificationOut
from app.api.deps import get_current_user
from app.services.notification_service import broadcaster

router = APIRouter()

@router.get("", response_model=List[NotificationOut])
def list_my_notifications(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(30).all()
    return notifs

@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.is_read = True
    db.commit()
    return {"success": True}

@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"success": True}

@router.get("/stream")
async def sse_event_stream(request: Request):
    """
    Server-Sent Events endpoint for real-time dashboard updates and notifications.
    """
    queue = await broadcaster.subscribe()

    async def event_generator():
        try:
            # Send initial connection heartbeat
            yield f"data: {json.dumps({'event': 'CONNECTED', 'message': 'SSE Connected'})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"data: {json.dumps(message)}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive ping
                    yield f": keepalive\n\n"
        finally:
            await broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
