from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.connection import get_db, set_system_state
from app.database.models import OperatorActionRecord
from app.processing.pipeline import pipeline
from app.processing.freshness import freshness_verifier
from app.ingestion.simulator import simulator
from app.services.audit_service import audit_service
from app.services.ws_manager import ws_manager
from app.schemas.telemetry import SimulatorConfig
from app.core.config import settings

router = APIRouter()

class OverrideRequest(BaseModel):
    freshness_window: float
    operator_id: str = "OPERATOR-PRIMARY"
    passcode: Optional[str] = None

@router.get("/status")
async def get_operator_status():
    """Returns current operator control status and configuration."""
    return {
        "freshness_window": freshness_verifier.max_drift_seconds,
        "stream_status": "PAUSED" if pipeline.stream_paused else "ACTIVE",
        "authorized_operators": settings.AUTHORIZED_OPERATORS,
        "cache_entries": len(freshness_verifier._nonce_cache)
    }

@router.post("/pause")
async def pause_stream(operator_id: str = "OPERATOR-PRIMARY"):
    """Pauses telemetry stream processing."""
    await pipeline.pause_stream()
    await audit_service.log_stream_state(
        operator_id=operator_id,
        state="PAUSED",
        details={"status": "PAUSED"}
    )
    await audit_service.log_operator_action(
        action="STREAM_PAUSED",
        operator_id=operator_id,
        confirmed=True,
        details={"status": "PAUSED"}
    )
    await ws_manager.broadcast("system_status_changed", {"stream_status": "PAUSED"})
    return {"status": "PAUSED", "stream_status": "PAUSED", "message": "Telemetry stream paused by operator"}

@router.post("/resume")
async def resume_stream(operator_id: str = "OPERATOR-PRIMARY"):
    """Resumes telemetry stream processing."""
    await pipeline.resume_stream()
    await audit_service.log_stream_state(
        operator_id=operator_id,
        state="ACTIVE",
        details={"status": "ACTIVE"}
    )
    await audit_service.log_operator_action(
        action="STREAM_RESUMED",
        operator_id=operator_id,
        confirmed=True,
        details={"status": "ACTIVE"}
    )
    await ws_manager.broadcast("system_status_changed", {"stream_status": "ACTIVE"})
    return {"status": "ACTIVE", "stream_status": "ACTIVE", "message": "Telemetry stream resumed by operator"}

@router.post("/override")
async def security_override(
    request: Request,
    freshness_window: Optional[float] = Query(None),
    operator_id: Optional[str] = Query(None),
    passcode: Optional[str] = Query(None),
    x_operator_passcode: Optional[str] = Header(None, alias="X-Operator-Passcode")
):
    """
    Operator Security Override.
    Adjusts dynamic freshness verification window with strict server-side authorization
    and persistent database state.
    """
    body_data = {}
    try:
        body_data = await request.json()
    except Exception:
        body_data = {}

    raw_window = body_data.get("freshness_window", freshness_window)
    if raw_window is None:
        raw_window = 5.0
    try:
        eff_window = float(raw_window)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid freshness_window parameter.")

    eff_operator = str(body_data.get("operator_id", operator_id) or "OPERATOR-PRIMARY")
    eff_passcode = str(body_data.get("passcode", passcode) or x_operator_passcode or "")

    # 1. Boundary & range validation (1.0s to 60.0s)
    if eff_window < 1.0 or eff_window > 60.0:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid freshness window: {eff_window:.1f}s. Permitted tactical range is 1.0s to 60.0s."
        )

    # 2. Authorization & passcode validation
    is_authorized_op = eff_operator in settings.AUTHORIZED_OPERATORS
    is_valid_passcode = (eff_passcode == settings.OPERATOR_OVERRIDE_PASSCODE)

    if not is_authorized_op or not is_valid_passcode:
        reason = "Unrecognized operator ID" if not is_authorized_op else "Invalid tactical override passcode"
        await audit_service.log_authorization_failure(
            operator_id=eff_operator,
            attempted_action=f"SECURITY_OVERRIDE_FRESHNESS_WINDOW ({eff_window:.1f}s)",
            details={
                "reason": reason,
                "attempted_window": eff_window,
                "operator_id": eff_operator
            }
        )
        raise HTTPException(
            status_code=403,
            detail=f"Operator authorization failed: {reason}. Valid authorization passcode required."
        )

    # 3. Apply to verifier and persist state
    freshness_verifier.set_max_drift(eff_window)
    await set_system_state("freshness_window", str(eff_window))

    # 4. Audit logging
    await audit_service.log_operator_action(
        action=f"SECURITY_OVERRIDE_FRESHNESS_WINDOW ({eff_window:.1f}s)",
        operator_id=eff_operator,
        confirmed=True,
        status="EXECUTED",
        details={"new_freshness_window_seconds": eff_window}
    )

    # 5. Broadcast to connected WebSocket clients
    await ws_manager.broadcast("override_applied", {
        "freshness_window": eff_window,
        "operator_id": eff_operator
    })

    return {
        "status": "OVERRIDE_APPLIED",
        "freshness_window_seconds": eff_window,
        "operator_id": eff_operator,
        "message": f"Freshness tolerance window successfully updated to {eff_window:.1f}s"
    }

@router.post("/cache/clear")
async def clear_replay_cache(
    request: Request,
    operator_id: Optional[str] = Query(None),
    passcode: Optional[str] = Query(None),
    x_operator_passcode: Optional[str] = Header(None, alias="X-Operator-Passcode")
):
    """
    Operator Command: Flush Replay Nonce Cache.
    Requires server-side authorization passcode and authorized operator ID.
    """
    body_data = {}
    try:
        body_data = await request.json()
    except Exception:
        body_data = {}

    eff_operator = str(body_data.get("operator_id", operator_id) or "OPERATOR-PRIMARY")
    eff_passcode = str(body_data.get("passcode", passcode) or x_operator_passcode or "")

    is_authorized_op = eff_operator in settings.AUTHORIZED_OPERATORS
    is_valid_passcode = (eff_passcode == settings.OPERATOR_OVERRIDE_PASSCODE)

    if not is_authorized_op or not is_valid_passcode:
        reason = "Unrecognized operator ID" if not is_authorized_op else "Invalid tactical override passcode"
        await audit_service.log_authorization_failure(
            operator_id=eff_operator,
            attempted_action="FLUSH_REPLAY_CACHE",
            details={"reason": reason, "operator_id": eff_operator}
        )
        raise HTTPException(
            status_code=403,
            detail=f"Operator authorization failed: {reason}. Valid authorization passcode required."
        )

    cleared_count = len(freshness_verifier._nonce_cache)
    freshness_verifier._nonce_cache.clear()

    await audit_service.log_operator_action(
        action=f"FLUSH_REPLAY_CACHE ({cleared_count} nonces cleared)",
        operator_id=eff_operator,
        confirmed=True,
        status="EXECUTED",
        details={"cleared_count": cleared_count}
    )

    await ws_manager.broadcast("cache_cleared", {
        "operator_id": eff_operator,
        "cleared_count": cleared_count
    })

    return {
        "status": "CACHE_CLEARED",
        "cleared_count": cleared_count,
        "operator_id": eff_operator,
        "message": f"Successfully flushed {cleared_count} nonce(s) from replay cache."
    }

@router.get("/simulator")
async def get_simulator_status():
    """Returns current Simulated Demonstration Mode configuration."""
    return {
        "enabled": simulator.enabled,
        "rate_hz": simulator.rate_hz,
        "attack_ratio": simulator.attack_ratio,
        "sources": simulator.sources
    }

@router.post("/simulator")
async def set_simulator_status(config: SimulatorConfig):
    """Configures and starts/stops Simulated Demonstration Mode."""
    simulator.set_config(
        enabled=config.enabled,
        rate_hz=config.rate_hz,
        attack_ratio=config.attack_ratio,
        sources=config.sources
    )
    await audit_service.log_operator_action(
        action=f"SIMULATOR_{'ENABLED' if config.enabled else 'DISABLED'}",
        confirmed=True,
        details={"rate_hz": config.rate_hz, "attack_ratio": config.attack_ratio}
    )
    await ws_manager.broadcast("system_status_changed", {
        "simulator_active": config.enabled,
        "rate_hz": config.rate_hz
    })
    return {
        "status": "UPDATED",
        "enabled": simulator.enabled,
        "rate_hz": simulator.rate_hz,
        "attack_ratio": simulator.attack_ratio
    }

@router.get("/actions")
async def get_operator_actions(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Returns operator action audit trail."""
    result = await db.execute(
        select(OperatorActionRecord).order_by(desc(OperatorActionRecord.id)).limit(limit)
    )
    actions = result.scalars().all()
    return [
        {
            "id": a.id,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
            "operator_id": a.operator_id,
            "action": a.action,
            "confirmed": a.confirmed,
            "status": a.status,
            "details": a.details
        }
        for a in actions
    ]
