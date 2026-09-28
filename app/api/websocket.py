from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.ws_manager import ws_manager
from app.core.security import verify_websocket_connection
from app.core.logging import logger

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Verify Origin and authentication token before accepting
    is_valid = await verify_websocket_connection(websocket)
    if not is_valid:
        await websocket.close(code=4003, reason="Unauthorized origin or missing token")
        return

    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; can receive client heartbeats/pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"event": "pong"}')
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection error: {e}")
        await ws_manager.disconnect(websocket)
