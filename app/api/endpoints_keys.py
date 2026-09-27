from fastapi import APIRouter
from app.crypto.key_manager import key_manager
from app.services.audit_service import audit_service
from app.services.ws_manager import ws_manager

router = APIRouter()

@router.get("/active")
async def get_active_key_metadata():
    """
    Returns SAFE cryptographic metadata for the active AES-256 session key.
    The secret key is masked and never exposed to the frontend or API consumers.
    """
    return key_manager.get_safe_metadata()

@router.post("/resync")
async def resync_session_key(operator_id: str = "OPERATOR-PRIMARY"):
    """
    Dynamic Re-keying Command.
    Rotates the active session key, updates key metadata, logs operator action,
    and broadcasts the updated key status to all connected dashboards via WebSocket.
    """
    metadata = key_manager.resync_key(operator_id=operator_id)
    
    await audit_service.log_operator_action(
        action=f"KEY_RESYNC_EXECUTED (New Key: {metadata['key_id']})",
        operator_id=operator_id,
        confirmed=True,
        status="SUCCESS",
        details=metadata
    )
    
    await ws_manager.broadcast("key_status_changed", metadata)
    return metadata
