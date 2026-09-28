import json
import asyncio
from typing import List, Dict, Any
from fastapi import WebSocket
from app.core.logging import logger

class WebSocketManager:
    """
    Manages live WebSocket connections and dispatches real-time security events
    to connected tactical dashboards using non-blocking concurrent delivery.
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
        """
        Broadcasts a structured event message to all connected clients concurrently
        without holding the connection lock during transmission.
        """
        async with self._lock:
            if not self.active_connections:
                return
            targets = list(self.active_connections)

        message = json.dumps({
            "event": event_type,
            "data": data
        })

        async def _safe_send(ws: WebSocket) -> WebSocket | None:
            try:
                await ws.send_text(message)
                return None
            except Exception:
                return ws

        # Transmit concurrently across all connected clients
        results = await asyncio.gather(*[_safe_send(ws) for ws in targets], return_exceptions=True)
        dead_connections = [res for res in results if isinstance(res, WebSocket)]

        if dead_connections:
            async with self._lock:
                for dead_conn in dead_connections:
                    if dead_conn in self.active_connections:
                        self.active_connections.remove(dead_conn)

ws_manager = WebSocketManager()
