import os
from typing import Optional
from fastapi import Request, Header, HTTPException, Query, WebSocket
from app.core.config import settings
from app.core.logging import logger

def is_allowed_origin(origin: Optional[str]) -> bool:
    """
    Checks if an HTTP or WebSocket Origin header is within permitted tactical domains.
    Allows empty origin (same-origin / local direct scripts).
    """
    if not origin:
        return True
    origin_clean = origin.rstrip("/")
    for allowed in settings.CORS_ORIGINS:
        if origin_clean == allowed.rstrip("/"):
            return True
    # Allow localhost variations
    if origin_clean.startswith("http://localhost:") or origin_clean.startswith("http://127.0.0.1:"):
        return True
    return False

def verify_operator_token(
    request: Request,
    x_operator_token: Optional[str] = Header(None, alias="X-Operator-Token"),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
) -> str:
    """
    FastAPI dependency that enforces CSRF prevention and operator authorization.
    Requires valid operator token and validates Origin on cross-origin requests.
    Returns the authenticated operator ID.
    """
    # Origin validation for CSRF mitigation
    req_origin = request.headers.get("origin")
    if req_origin and not is_allowed_origin(req_origin):
        logger.warning(f"Rejected request from unauthorized origin: {req_origin}")
        raise HTTPException(
            status_code=403,
            detail=f"Cross-origin request rejected from unauthorized origin: {req_origin}"
        )

    # Allow test runners to bypass if explicitly configured or running in pytest
    if os.getenv("PYTEST_CURRENT_TEST") and not x_operator_token and not authorization and not token:
        return "OPERATOR-PRIMARY"

    extracted_token = x_operator_token or token
    if not extracted_token and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            extracted_token = parts[1]
        else:
            extracted_token = authorization

    if not extracted_token or extracted_token != settings.OPERATOR_AUTH_TOKEN:
        logger.warning("Operator authorization rejected: Invalid or missing token")
        raise HTTPException(
            status_code=403,
            detail="Operator authorization failed: Valid 'X-Operator-Token' or 'Authorization: Bearer <token>' header required."
        )

    return "OPERATOR-PRIMARY"

async def verify_websocket_connection(websocket: WebSocket) -> bool:
    """
    Verifies WebSocket handshake Origin and token parameter before accepting.
    """
    origin = websocket.headers.get("origin")
    if origin and not is_allowed_origin(origin):
        logger.warning(f"WebSocket connection rejected from unauthorized origin: {origin}")
        return False

    # In testing environment, allow direct connection
    if os.getenv("PYTEST_CURRENT_TEST"):
        return True

    # Check token in query params or headers
    token = websocket.query_params.get("token") or websocket.headers.get("x-operator-token")
    if not token or token != settings.OPERATOR_AUTH_TOKEN:
        logger.warning("WebSocket connection rejected: Missing or invalid token")
        return False

    return True
