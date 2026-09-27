from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.connection import get_db
from app.database.models import PacketRecord
from app.processing.pipeline import pipeline
from app.services.c2_service import c2_service

router = APIRouter()

@router.get("/packets")
async def get_packets(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    source: Optional[str] = None,
    classification: Optional[str] = None,
    action: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns list of processed tactical telemetry packets with optional filtering.
    """
    query = select(PacketRecord).order_by(desc(PacketRecord.id))
    if source:
        query = query.where(PacketRecord.source == source)
    if classification:
        query = query.where(PacketRecord.classification == classification)
    if action:
        query = query.where(PacketRecord.action == action)
        
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    packets = result.scalars().all()
    
    return [
        {
            "id": p.id,
            "packet_id": p.packet_id,
            "sequence_num": p.sequence_num,
            "source": p.source,
            "timestamp": p.timestamp,
            "packet_type": p.packet_type,
            "key_id": p.key_id,
            "iv_hex": p.iv_hex,
            "tag_hex": p.tag_hex,
            "ciphertext_preview": p.ciphertext_preview,
            "signature_hex": p.signature_hex,
            "payload_hash": p.payload_hash,
            "auth_status": p.auth_status,
            "freshness_status": p.freshness_status,
            "sig_status": p.sig_status,
            "integrity_status": p.integrity_status,
            "classification": p.classification,
            "trust_score": p.trust_score,
            "trust_details": p.trust_details,
            "action": p.action,
            "latency_ms": p.latency_ms,
            "decrypted_payload": p.decrypted_payload,
            "simulated": p.simulated,
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in packets
    ]

@router.get("/packets/{packet_id}")
async def get_packet_details(packet_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns complete cryptographic and verification details for a single packet.
    """
    result = await db.execute(
        select(PacketRecord).where(PacketRecord.packet_id == packet_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Packet not found")
        
    return {
        "id": p.id,
        "packet_id": p.packet_id,
        "sequence_num": p.sequence_num,
        "source": p.source,
        "timestamp": p.timestamp,
        "packet_type": p.packet_type,
        "key_id": p.key_id,
        "iv_hex": p.iv_hex,
        "tag_hex": p.tag_hex,
        "ciphertext_preview": p.ciphertext_preview,
        "signature_hex": p.signature_hex,
        "payload_hash": p.payload_hash,
        "auth_status": p.auth_status,
        "freshness_status": p.freshness_status,
        "sig_status": p.sig_status,
        "integrity_status": p.integrity_status,
        "classification": p.classification,
        "trust_score": p.trust_score,
        "trust_details": p.trust_details,
        "action": p.action,
        "latency_ms": p.latency_ms,
        "decrypted_payload": p.decrypted_payload,
        "simulated": p.simulated,
        "created_at": p.created_at.isoformat() if p.created_at else None
    }

@router.post("/ingest")
async def ingest_packet(raw_packet: Dict[str, Any]):
    """
    Direct REST API ingestion endpoint for live / authorized tactical telemetry feeds.
    Passes packet directly through the multi-stage security pipeline.
    """
    result = await pipeline.process_packet(raw_packet)
    return result

@router.get("/c2-stream")
async def get_c2_stream():
    """
    Returns stream of packets successfully verified and forwarded to Trusted C2.
    """
    return {
        "status": c2_service.status,
        "forwarded_count": c2_service.forwarded_count,
        "recent_packets": c2_service.get_recent_c2_packets(50)
    }
