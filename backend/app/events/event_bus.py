import asyncio
import uuid
from typing import Dict, Any, Optional, Set, Callable, Awaitable
from backend.app.models.schemas import OfficeEvent, EventType
from backend.app.database.repository import Repository

class EventBus:
    def __init__(self):
        self._listeners: Set[Callable[[OfficeEvent], Awaitable[None]]] = set()

    def subscribe(self, callback: Callable[[OfficeEvent], Awaitable[None]]):
        self._listeners.add(callback)

    def unsubscribe(self, callback: Callable[[OfficeEvent], Awaitable[None]]):
        self._listeners.discard(callback)

    async def emit(
        self,
        event_type: EventType,
        agent_id: Optional[str] = None,
        task_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> OfficeEvent:
        event = OfficeEvent(
            id=str(uuid.uuid4()),
            type=event_type,
            agent_id=agent_id,
            task_id=task_id,
            metadata=metadata or {}
        )
        
        # 1. Persist event to SQLite
        try:
            Repository.save_event(event)
        except Exception as e:
            print(f"[EventBus] Error persisting event: {e}")
            
        # 2. Broadcast to all active subscribers (e.g. WebSockets)
        if self._listeners:
            tasks = [asyncio.create_task(listener(event)) for listener in self._listeners]
            await asyncio.gather(*tasks, return_exceptions=True)
            
        return event

# Global singleton event bus
event_bus = EventBus()
