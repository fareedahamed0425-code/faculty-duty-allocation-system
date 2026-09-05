import asyncio
import json
from typing import Dict, Any, List, Set
from datetime import datetime

class NotificationBroadcaster:
    """
    In-memory SSE event bus for real-time dashboard and faculty notifications.
    """
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self._subscribers.add(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue):
        if q in self._subscribers:
            self._subscribers.remove(q)

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        message = {
            "event": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        for q in list(self._subscribers):
            try:
                await q.put(message)
            except Exception:
                self._subscribers.discard(q)

broadcaster = NotificationBroadcaster()
