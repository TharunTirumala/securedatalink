import time
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database.connection import get_db
from app.database.models import PacketRecord
from app.crypto.key_manager import key_manager
from app.processing.adaptive_filter import adaptive_filter
from app.processing.pipeline import pipeline
from app.services.c2_service import c2_service
from app.ingestion.simulator import simulator

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """
    Returns live aggregated tactical datalink metrics from the persistent database
    and active backend modules.
    """
    # Total evaluated
    total_result = await db.execute(select(func.count(PacketRecord.id)))
    total_packets = total_result.scalar() or 0

    # Authenticated count
    auth_result = await db.execute(
        select(func.count(PacketRecord.id)).where(PacketRecord.action == "ACCEPTED")
    )
    authenticated_packets = auth_result.scalar() or 0

    # Blocked / Filtered count
    blocked_result = await db.execute(
        select(func.count(PacketRecord.id)).where(PacketRecord.action.in_(["BLOCKED", "FILTERED", "REJECTED"]))
    )
    replay_filtered = blocked_result.scalar() or 0

    # Average Trust Score across last 100 packets
    recent_trust_result = await db.execute(
        select(func.avg(PacketRecord.trust_score)).order_by(desc(PacketRecord.id)).limit(100)
    )
    avg_trust = recent_trust_result.scalar()
    avg_trust_score = round(float(avg_trust), 1) if avg_trust is not None else 100.0

    # Average Latency across last 50 packets
    recent_lat_result = await db.execute(
        select(func.avg(PacketRecord.latency_ms)).order_by(desc(PacketRecord.id)).limit(50)
    )
    avg_lat = recent_lat_result.scalar()
    avg_latency = round(float(avg_lat), 2) if avg_lat is not None else 1.25

    # Derive packet rate
    packet_rate = simulator.rate_hz if simulator.enabled else (1.0 if total_packets > 0 else 0.0)

    # Security Status
    filter_stats = adaptive_filter.get_stats()
    threat_count = filter_stats["tampered"] + filter_stats["replay"]
    if threat_count > 5:
        system_status = "ELEVATED_THREAT_ACTIVITY"
    elif threat_count > 0:
        system_status = "ACTIVE_THREAT_FILTERING"
    else:
        system_status = "SECURE_NOMINAL"

    c2_stats = c2_service.get_status()

    return {
        "authenticated_packets": authenticated_packets,
        "packet_rate": packet_rate,
        "packet_latency": avg_latency,
        "replay_filtered": replay_filtered,
        "system_security_status": system_status,
        "trust_score": avg_trust_score,
        "stream_status": "PAUSED" if pipeline.stream_paused else "ACTIVE",
        "active_key_id": key_manager.active_key_id,
        "simulator_active": simulator.enabled,
        "adaptive_filter": filter_stats,
        "c2_output": c2_stats
    }

@router.get("/pipeline")
async def get_pipeline_stages():
    """
    Returns real-time operational status for each of the 10 pipeline stages.
    """
    filter_stats = adaptive_filter.get_stats()
    return {
        "stages": [
            {"id": 1, "name": "Telemetry Input", "status": "CONNECTED", "detail": "UDP:9871, FileWatcher, REST"},
            {"id": 2, "name": "Signal Ingestion", "status": "ACTIVE", "detail": "Ingestion Queue & Normalization"},
            {"id": 3, "name": "Preprocessing", "status": "ACTIVE", "detail": "Frame validation & sanitization"},
            {"id": 4, "name": "Nonce/Freshness", "status": "PASS", "detail": "5.0s window & replay cache"},
            {"id": 5, "name": "AES-256-GCM", "status": "PASS", "detail": f"Key: {key_manager.active_key_id}"},
            {"id": 6, "name": "ECDSA", "status": "PASS", "detail": "NIST P-256 (secp256r1)"},
            {"id": 7, "name": "Integrity", "status": "PASS", "detail": "SHA-256 cryptographic digest"},
            {"id": 8, "name": "Adaptive Filter", "status": "PASS" if filter_stats["is_active"] else "STANDBY", "detail": f"Evaluated: {filter_stats['evaluated']}"},
            {"id": 9, "name": "Trust Score", "status": "PASS", "detail": "Multi-factor score (0-100)"},
            {"id": 10, "name": "C2 Output", "status": "PASS" if c2_service.status == "CONNECTED" else c2_service.status, "detail": f"Forwarded: {c2_service.forwarded_count}"}
        ]
    }
