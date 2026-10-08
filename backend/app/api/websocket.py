import json
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect
from backend.app.models.schemas import OfficeEvent
from backend.app.events.event_bus import event_bus

class WebSocketManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast_event(self, event: OfficeEvent):
        if not self.active_connections:
            return
            
        data = event.model_dump_json()
        dead_connections = set()
        
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception:
                dead_connections.add(connection)
                
        for dead in dead_connections:
            self.active_connections.discard(dead)

ws_manager = WebSocketManager()

# Hook into event_bus so all emitted events are automatically sent to all WebSockets
event_bus.subscribe(ws_manager.broadcast_event)
