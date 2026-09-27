import time
import json
import csv
import io
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.connection import get_db, async_session
from app.database.models import PacketRecord, FileProcessingRecord
from app.processing.pipeline import pipeline
from app.services.c2_service import c2_service
from app.crypto.aes_gcm import AESGCMProcessor
from app.crypto.ecdsa_signer import ecdsa_processor
from app.crypto.hasher import SHA256Hasher
from app.crypto.key_manager import key_manager
from app.services.audit_service import audit_service
from app.services.ws_manager import ws_manager
from app.core.logging import logger

router = APIRouter()

def normalize_and_seal_telemetry(raw_item: Dict[str, Any], sequence_offset: int = 0) -> Dict[str, Any]:
    """
    Takes a raw telemetry dictionary (from JSON, CSV, JSONL, or REST)
    and converts/seals it into a verifiable cryptographic packet frame.
    Supports flexible field names, strings from CSV, and ISO-8601 or numeric Unix timestamps.
    """
    # Check if already pre-packaged cryptographic frame
    if all(k in raw_item for k in ("iv", "tag", "ciphertext", "signature", "payload_hash")):
        if "allow_custom_ingest" not in raw_item:
            raw_item["allow_custom_ingest"] = True
        return raw_item

    # 1. Device ID / Source
    device_id = str(
        raw_item.get("device_id")
        or raw_item.get("source")
        or raw_item.get("node_id")
        or raw_item.get("deviceId")
        or raw_item.get("id")
        or ""
    ).strip()
    if not device_id:
        raise ValueError("Device ID / Source is required")
    if len(device_id) > 64:
        raise ValueError(f"Device ID '{device_id}' exceeds maximum length (64 chars)")

    # 2. Latitude [-90, 90] (defaults to 0.0 if not provided in raw frame)
    lat_val = raw_item.get("latitude") if "latitude" in raw_item else (raw_item.get("lat") or raw_item.get("Latitude"))
    if lat_val is not None and str(lat_val).strip() != "":
        try:
            latitude = float(lat_val)
            if not (-90.0 <= latitude <= 90.0):
                raise ValueError()
        except Exception:
            raise ValueError("Latitude must be a numeric value between -90.0 and 90.0")
    else:
        latitude = 0.0

    # 3. Longitude [-180, 180] (defaults to 0.0 if not provided in raw frame)
    lon_val = raw_item.get("longitude") if "longitude" in raw_item else (raw_item.get("lon") or raw_item.get("lng") or raw_item.get("Longitude"))
    if lon_val is not None and str(lon_val).strip() != "":
        try:
            longitude = float(lon_val)
            if not (-180.0 <= longitude <= 180.0):
                raise ValueError()
        except Exception:
            raise ValueError("Longitude must be a numeric value between -180.0 and 180.0")
    else:
        longitude = 0.0

    # 4. Altitude [-500, 50000]
    alt_val = raw_item.get("altitude") if "altitude" in raw_item else (raw_item.get("altitude_m") or raw_item.get("alt") or raw_item.get("Altitude") or 0.0)
    try:
        altitude = float(alt_val) if alt_val != "" and alt_val is not None else 0.0
        if not (-500.0 <= altitude <= 50000.0):
            raise ValueError()
    except Exception:
        raise ValueError("Altitude must be a numeric value between -500.0 and 50000.0")

    # 5. Speed [0, 3000]
    spd_val = raw_item.get("speed") if "speed" in raw_item else (raw_item.get("speed_mps") or raw_item.get("spd") or raw_item.get("Speed") or 0.0)
    try:
        speed = float(spd_val) if spd_val != "" and spd_val is not None else 0.0
        if not (0.0 <= speed <= 3000.0):
            raise ValueError()
    except Exception:
        raise ValueError("Speed must be a numeric value between 0.0 and 3000.0")

    # 6. Heading [0, 360]
    hdg_val = raw_item.get("heading") if "heading" in raw_item else (raw_item.get("heading_deg") or raw_item.get("hdg") or raw_item.get("Heading") or 0.0)
    try:
        heading = float(hdg_val) if hdg_val != "" and hdg_val is not None else 0.0
        if not (0.0 <= heading <= 360.0):
            raise ValueError()
    except Exception:
        raise ValueError("Heading must be a numeric value between 0.0 and 360.0")

    # 7. Timestamp
    ts_val = raw_item.get("timestamp") if "timestamp" in raw_item else (raw_item.get("ts") or raw_item.get("time") or raw_item.get("Timestamp"))
    if ts_val is not None and str(ts_val).strip() != "":
        try:
            timestamp = float(ts_val)
        except ValueError:
            ts_str = str(ts_val).strip()
            # Handle ISO-8601 strings
            if ts_str.endswith("Z"):
                ts_str = ts_str[:-1] + "+00:00"
            try:
                timestamp = datetime.fromisoformat(ts_str).timestamp()
            except Exception:
                timestamp = time.time()
    else:
        timestamp = time.time()

    # Optional battery & flight mode
    bat_val = raw_item.get("battery_pct") if "battery_pct" in raw_item else (raw_item.get("battery") or raw_item.get("Battery") or 100.0)
    try:
        battery_pct = max(0.0, min(100.0, float(bat_val))) if bat_val != "" and bat_val is not None else 100.0
    except (ValueError, TypeError):
        battery_pct = 100.0

    flight_mode = str(raw_item.get("flight_mode") or raw_item.get("flightMode") or "AUTONOMOUS_NAV").strip() or "AUTONOMOUS_NAV"
    packet_type = str(raw_item.get("packet_type") or raw_item.get("packetType") or "Imported Telemetry").strip()

    # Build and seal fresh packet frame
    now_ms = int(time.time() * 1000)
    seq = (now_ms % 1000000) + sequence_offset
    packet_id = f"PKT-IMP-{seq}"
    active_key = key_manager.get_key_bytes()
    active_key_id = key_manager.active_key_id
    pkt_timestamp = time.time()

    telemetry_payload = {
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "altitude_m": round(altitude, 2),
        "speed_mps": round(speed, 2),
        "heading_deg": round(heading, 2),
        "battery_pct": round(battery_pct, 1),
        "flight_mode": flight_mode,
        "link_quality": 100,
        "recorded_timestamp": timestamp
    }

    plaintext_bytes = json.dumps(telemetry_payload, sort_keys=True).encode('utf-8')
    payload_hash = SHA256Hasher.digest(plaintext_bytes)

    associated_data = f"{packet_id}:{device_id}".encode('utf-8')
    ciphertext, iv, tag = AESGCMProcessor.encrypt(
        key=active_key,
        plaintext=plaintext_bytes,
        associated_data=associated_data
    )

    signed_data = f"{packet_id}:{seq}:{device_id}:{pkt_timestamp:.3f}:{payload_hash}".encode('utf-8')
    signature = ecdsa_processor.sign(device_id, signed_data)

    return {
        "packet_id": packet_id,
        "sequence_num": seq,
        "source": device_id,
        "timestamp": pkt_timestamp,
        "packet_type": packet_type,
        "key_id": active_key_id,
        "iv": iv.hex(),
        "tag": tag.hex(),
        "ciphertext": ciphertext.hex(),
        "signature": signature.hex(),
        "payload_hash": payload_hash,
        "simulated": False,
        "allow_custom_ingest": True
    }


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
    Accepts single raw or pre-packaged cryptographic telemetry records.
    """
    if "packet_type" not in raw_packet:
        raw_packet["packet_type"] = "Custom Telemetry"
    try:
        sealed_packet = normalize_and_seal_telemetry(raw_packet)
    except ValueError as val_err:
        raise HTTPException(status_code=422, detail=f"Validation Error: {str(val_err)}")

    source = sealed_packet.get("source", "UNKNOWN")
    packet_id = sealed_packet.get("packet_id", "UNKNOWN")

    await audit_service.log_security_event(
        event_type="CUSTOM_TELEMETRY_INGESTED",
        severity="INFO",
        source=source,
        packet_id=packet_id,
        description=f"Custom telemetry packet {packet_id} submitted for tactical node {source}"
    )

    # Process through full multi-stage pipeline
    result = await pipeline.process_packet(sealed_packet)
    return result

@router.post("/import")
async def import_telemetry_batch(
    request: Request,
    file: Optional[UploadFile] = File(None),
    operator_id: str = Query("OPERATOR-PRIMARY")
):
    """
    Comprehensive JSON / CSV / JSONL Telemetry Batch Import Endpoint.
    Accepts:
    1. File upload (.json, .csv, .jsonl via multipart/form-data)
    2. Direct JSON payload (single record or array of records in request body)
    
    Parses, validates, cryptographically seals each record, and executes all 10 stages
    of the security verification pipeline. Persists packets, updates dashboard, and logs audit events.
    """
    raw_records: List[Dict[str, Any]] = []
    filename = "direct_import.json"
    file_type = "JSON"

    if file is not None:
        filename = file.filename or "uploaded_batch.json"
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "json"
        file_type = ext.upper()
        if ext not in ["json", "csv", "jsonl"]:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '.{ext}'. Supported formats: .json, .csv, .jsonl"
            )

        content_bytes = await file.read()
        if not content_bytes or len(content_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if len(content_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds maximum permitted tactical limit (10MB).")

        text = content_bytes.decode('utf-8', errors='replace')

        if ext == "json":
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    raw_records = parsed
                elif isinstance(parsed, dict):
                    if "packets" in parsed and isinstance(parsed["packets"], list):
                        raw_records = parsed["packets"]
                    else:
                        raw_records = [parsed]
                else:
                    raise ValueError("JSON must contain an object or array of objects")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid JSON file format: {str(e)}")

        elif ext == "jsonl":
            for line_no, line in enumerate(text.splitlines(), start=1):
                line = line.strip()
                if line:
                    try:
                        raw_records.append(json.loads(line))
                    except Exception as e:
                        logger.warning(f"Skipping malformed JSONL line {line_no}: {e}")

        elif ext == "csv":
            try:
                reader = csv.DictReader(io.StringIO(text))
                for row in reader:
                    raw_records.append(dict(row))
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid CSV file format: {str(e)}")

    else:
        # Check JSON body
        try:
            body = await request.json()
            if isinstance(body, list):
                raw_records = body
            elif isinstance(body, dict):
                if "packets" in body and isinstance(body["packets"], list):
                    raw_records = body["packets"]
                else:
                    raw_records = [body]
        except Exception:
            raise HTTPException(status_code=400, detail="No file or valid JSON body provided.")

    if not raw_records:
        raise HTTPException(status_code=400, detail="No telemetry records found in import payload.")

    # Process all records through the 10-stage pipeline
    total_count = len(raw_records)
    processed_count = 0
    accepted_count = 0
    blocked_count = 0
    rejected_count = 0
    failed_count = 0
    results: List[Dict[str, Any]] = []

    for idx, raw_item in enumerate(raw_records):
        try:
            sealed_packet = normalize_and_seal_telemetry(raw_item, sequence_offset=idx)
            res = await pipeline.process_packet(sealed_packet)
            processed_count += 1
            action = res.get("action", "UNKNOWN")
            if action == "ACCEPTED":
                accepted_count += 1
            elif action in ["BLOCKED", "FILTERED"]:
                blocked_count += 1
            else:
                rejected_count += 1

            results.append({
                "record_index": idx + 1,
                "packet_id": res.get("packet_id"),
                "source": res.get("source"),
                "classification": res.get("classification"),
                "action": action,
                "trust_score": res.get("trust_score"),
                "auth_status": res.get("auth_status"),
                "freshness_status": res.get("freshness_status"),
                "sig_status": res.get("sig_status"),
                "integrity_status": res.get("integrity_status")
            })
        except Exception as ex:
            failed_count += 1
            results.append({
                "record_index": idx + 1,
                "error": str(ex),
                "action": "FAILED"
            })
            logger.error(f"Error processing import record #{idx + 1}: {ex}")

    # Record in FileProcessingRecord if file was imported
    file_hash = SHA256Hasher.digest(json.dumps(raw_records[:5], sort_keys=True).encode('utf-8'))
    now = datetime.now(timezone.utc)
    try:
        async with async_session() as session:
            f_rec = FileProcessingRecord(
                filename=filename,
                file_hash=f"{file_hash[:24]}_{int(time.time())}",
                file_type=file_type,
                record_count=processed_count,
                status="PROCESSED" if processed_count > 0 else "MALFORMED",
                error_message=f"{failed_count} record(s) failed" if failed_count > 0 else None,
                processed_at=now
            )
            session.add(f_rec)
            await session.commit()
    except Exception as e:
        logger.warning(f"Note recording file status: {e}")

    # Log to audit history
    await audit_service.log_security_event(
        event_type="TELEMETRY_BATCH_IMPORTED",
        severity="INFO" if failed_count == 0 else "WARNING",
        source=operator_id,
        description=f"Imported {filename}: {processed_count}/{total_count} records processed ({accepted_count} accepted, {blocked_count} threats blocked, {failed_count} failed)",
        details={
            "filename": filename,
            "total_records": total_count,
            "processed_count": processed_count,
            "accepted_count": accepted_count,
            "blocked_count": blocked_count,
            "failed_count": failed_count,
            "file_type": file_type
        }
    )

    try:
        await ws_manager.broadcast("file_processed", {
            "filename": filename,
            "record_count": processed_count,
            "status": "PROCESSED",
            "processed_at": now.isoformat()
        })
    except Exception:
        pass

    return {
        "status": "COMPLETED",
        "filename": filename,
        "file_type": file_type,
        "total_records": total_count,
        "processed_count": processed_count,
        "accepted_count": accepted_count,
        "blocked_count": blocked_count,
        "rejected_count": rejected_count,
        "failed_count": failed_count,
        "results": results,
        "message": f"Successfully processed {processed_count} of {total_count} records ({accepted_count} accepted, {blocked_count} threats blocked, {failed_count} failed)."
    }

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
