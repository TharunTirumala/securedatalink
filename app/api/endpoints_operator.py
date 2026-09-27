from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.connection import get_db
from app.database.models import OperatorActionRecord
from app.processing.pipeline import pipeline
from app.processing.freshness import freshness_verifier
from app.ingestion.simulator import simulator
from app.services.audit_service import audit_service
from app.services.ws_manager import ws_manager
from app.schemas.telemetry import SimulatorConfig

router = APIRouter()

@router.post("/pause")
async def pause_stream(operator_id: str = "OPERATOR-PRIMARY"):
    """Pauses telemetry stream processing."""
    pipeline.pause_stream()
    await audit_service.log_operator_action(
        action="STREAM_PAUSED",
        operator_id=operator_id,
        confirmed=True,
        details={"status": "PAUSED"}
    )
    await ws_manager.broadcast("system_status_changed", {"stream_status": "PAUSED"})
    return {"status": "PAUSED", "message": "Telemetry stream paused by operator"}

@router.post("/resume")
async def resume_stream(operator_id: str = "OPERATOR-PRIMARY"):
    """Resumes telemetry stream processing."""
    pipeline.resume_stream()
    await audit_service.log_operator_action(
        action="STREAM_RESUMED",
        operator_id=operator_id,
        confirmed=True,
        details={"status": "ACTIVE"}
    )
    await ws_manager.broadcast("system_status_changed", {"stream_status": "ACTIVE"})
    return {"status": "ACTIVE", "message": "Telemetry stream resumed by operator"}

@router.post("/override")
async def security_override(
    freshness_window: float = 5.0,
    operator_id: str = "OPERATOR-PRIMARY"
):
    """
    Operator Security Override.
    Adjusts dynamic freshness verification window with mandatory audit logging.
    """
    freshness_verifier.set_max_drift(freshness_window)
    await audit_service.log_operator_action(
        action=f"SECURITY_OVERRIDE_FRESHNESS_WINDOW ({freshness_window}s)",
        operator_id=operator_id,
        confirmed=True,
        details={"new_freshness_window_seconds": freshness_window}
    )
    return {
        "status": "OVERRIDE_APPLIED",
        "freshness_window_seconds": freshness_window,
        "message": f"Freshness window updated to {freshness_window}s"
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
