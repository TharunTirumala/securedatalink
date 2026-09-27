import time
import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.connection import get_db
from app.database.models import PacketRecord
from app.processing.pipeline import pipeline
from app.services.c2_service import c2_service
from app.crypto.aes_gcm import AESGCMProcessor
from app.crypto.ecdsa_signer import ecdsa_processor
from app.crypto.hasher import SHA256Hasher
from app.crypto.key_manager import key_manager
from app.services.audit_service import audit_service


router = APIRouter()

@router.get("/packets")
async def get_packets(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    source: Optional[str] = None,
    classification: Optional[str] = None,
    action: Optional[str] = None,
    include_archived: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns list of processed tactical telemetry packets with optional filtering.
    Archived packets are separated by default.
    """
    query = select(PacketRecord).order_by(desc(PacketRecord.id))
    if not include_archived:
        query = query.where(PacketRecord.is_archived == False)
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
            "is_archived": bool(p.is_archived),
            "archived_at": p.archived_at.isoformat() if p.archived_at else None,
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
    Accepts both pre-packaged cryptographic frames and raw custom telemetry.
    Raw telemetry is strictly validated, cryptographically sealed (AES-256-GCM + ECDSA + SHA-256),
    and passed directly through the 10-stage security pipeline.
    """
    # Check if this is already an encrypted/cryptographic frame
    is_crypto_frame = all(k in raw_packet for k in ("iv", "tag", "ciphertext", "signature", "payload_hash"))
    
    if not is_crypto_frame:
        # Validate raw telemetry parameters
        # 1. Device ID / Source
        device_id = str(raw_packet.get("device_id") or raw_packet.get("source") or "").strip()
        if not device_id:
            raise HTTPException(status_code=422, detail="Validation Error: Device ID / Source is required")
        if len(device_id) > 64:
            raise HTTPException(status_code=422, detail="Validation Error: Device ID must not exceed 64 characters")

        # 2. Latitude [-90, 90]
        if "latitude" not in raw_packet or raw_packet["latitude"] is None:
            raise HTTPException(status_code=422, detail="Validation Error: Latitude is required")
        try:
            latitude = float(raw_packet["latitude"])
            if not (-90.0 <= latitude <= 90.0):
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Validation Error: Latitude must be a numeric value between -90.0 and 90.0 degrees")

        # 3. Longitude [-180, 180]
        if "longitude" not in raw_packet or raw_packet["longitude"] is None:
            raise HTTPException(status_code=422, detail="Validation Error: Longitude is required")
        try:
            longitude = float(raw_packet["longitude"])
            if not (-180.0 <= longitude <= 180.0):
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Validation Error: Longitude must be a numeric value between -180.0 and 180.0 degrees")

        # 4. Altitude [-500, 50000]
        alt_raw = raw_packet.get("altitude", raw_packet.get("altitude_m", 0.0))
        try:
            altitude = float(alt_raw)
            if not (-500.0 <= altitude <= 50000.0):
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Validation Error: Altitude must be between -500.0 and 50,000.0 meters")

        # 5. Speed [0, 3000]
        speed_raw = raw_packet.get("speed", raw_packet.get("speed_mps", 0.0))
        try:
            speed = float(speed_raw)
            if not (0.0 <= speed <= 3000.0):
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Validation Error: Speed must be between 0.0 and 3,000.0 m/s")

        # 6. Heading [0, 360]
        heading_raw = raw_packet.get("heading", raw_packet.get("heading_deg", 0.0))
        try:
            heading = float(heading_raw)
            if not (0.0 <= heading <= 360.0):
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Validation Error: Heading must be between 0.0 and 360.0 degrees")

        # 7. Timestamp (> 0)
        ts_raw = raw_packet.get("timestamp")
        try:
            timestamp = float(ts_raw) if ts_raw is not None else time.time()
            if timestamp <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Validation Error: Timestamp must be a valid positive Unix timestamp")

        # Optional battery & flight mode
        battery_raw = raw_packet.get("battery_pct", raw_packet.get("battery", 100.0))
        try:
            battery_pct = max(0.0, min(100.0, float(battery_raw)))
        except (ValueError, TypeError):
            battery_pct = 100.0

        flight_mode = str(raw_packet.get("flight_mode", "MANUAL_COMMAND")).strip() or "MANUAL_COMMAND"

        # Build cryptographic tactical payload
        seq = int(time.time() * 1000) % 1000000
        packet_id = f"PKT-CUST-{seq}"
        active_key = key_manager.get_key_bytes()
        active_key_id = key_manager.active_key_id

        telemetry_payload = {
            "latitude": round(latitude, 6),
            "longitude": round(longitude, 6),
            "altitude_m": round(altitude, 2),
            "speed_mps": round(speed, 2),
            "heading_deg": round(heading, 2),
            "battery_pct": round(battery_pct, 1),
            "flight_mode": flight_mode,
            "link_quality": 100
        }

        plaintext_bytes = json.dumps(telemetry_payload, sort_keys=True).encode('utf-8')
        payload_hash = SHA256Hasher.digest(plaintext_bytes)

        associated_data = f"{packet_id}:{device_id}".encode('utf-8')
        ciphertext, iv, tag = AESGCMProcessor.encrypt(
            key=active_key,
            plaintext=plaintext_bytes,
            associated_data=associated_data
        )

        signed_data = f"{packet_id}:{seq}:{device_id}:{timestamp:.3f}:{payload_hash}".encode('utf-8')
        signature = ecdsa_processor.sign(device_id, signed_data)

        raw_packet = {
            "packet_id": packet_id,
            "sequence_num": seq,
            "source": device_id,
            "timestamp": timestamp,
            "packet_type": "Custom Telemetry",
            "key_id": active_key_id,
            "iv": iv.hex(),
            "tag": tag.hex(),
            "ciphertext": ciphertext.hex(),
            "signature": signature.hex(),
            "payload_hash": payload_hash,
            "simulated": False,
            "allow_custom_ingest": True
        }

        await audit_service.log_security_event(
            event_type="CUSTOM_TELEMETRY_INGESTED",
            severity="INFO",
            source=device_id,
            packet_id=packet_id,
            description=f"Custom telemetry packet {packet_id} submitted for tactical node {device_id}"
        )

    # Process through full multi-stage pipeline
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
