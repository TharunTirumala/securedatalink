import json
import asyncio
from typing import List, Dict, Any
from fastapi import WebSocket
from app.core.logging import logger

class WebSocketManager:
    """
    Manages live WebSocket connections and dispatches real-time security events
    to connected tactical dashboards.
    """
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active clients: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Active clients: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        """Broadcasts a structured event message to all connected clients."""
        if not self.active_connections:
            return

        message = json.dumps({
            "event": event_type,
            "data": data
        })

        disconnected = []
        async with self._lock:
            for connection in self.active_connections:
                try:
                    await connection.send_text(message)
                except Exception:
                    disconnected.append(connection)

            for dead_conn in disconnected:
                if dead_conn in self.active_connections:
                    self.active_connections.remove(dead_conn)

ws_manager = WebSocketManager()
