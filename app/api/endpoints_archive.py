from typing import Optional, List, Dict, Any
from pathlib import Path
import json
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, Response, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.core.config import settings
from app.core.logging import logger
from app.crypto.hasher import SHA256Hasher
from app.database.connection import get_db
from app.database.models import SecurityLogRecord, FileProcessingRecord, PacketRecord
from app.services.audit_service import audit_service
from app.services.ws_manager import ws_manager
from app.processing.pipeline import pipeline
from app.api.endpoints_telemetry import normalize_and_seal_telemetry

router = APIRouter()

@router.get("/logs")
async def get_security_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    severity: Optional[str] = None,
    source: Optional[str] = None,
    packet_id: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Searchable, filterable persistent security audit logs.
    """
    query = select(SecurityLogRecord).order_by(desc(SecurityLogRecord.id))
    
    if severity:
        query = query.where(SecurityLogRecord.severity == severity)
    if source:
        query = query.where(SecurityLogRecord.source == source)
    if packet_id:
        query = query.where(SecurityLogRecord.packet_id == packet_id)
    if search:
        query = query.where(SecurityLogRecord.description.ilike(f"%{search}%"))
        
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return [
        {
            "id": l.id,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
            "event_type": l.event_type,
            "severity": l.severity,
            "source": l.source,
            "packet_id": l.packet_id,
            "description": l.description,
            "details": l.details
        }
        for l in logs
    ]

@router.get("/logs/export")
async def export_security_logs(format: str = Query("csv", pattern="^(csv|json)$")):
    """
    Exports persistent security logs as a downloadable CSV or JSON file.
    """
    if format == "csv":
        csv_content = await audit_service.export_logs_csv()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=securelink_audit_log.csv"}
        )
    else:
        json_content = await audit_service.export_logs_json()
        import json
        return Response(
            content=json.dumps(json_content, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=securelink_audit_log.json"}
        )

@router.get("/files")
async def get_processed_files(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """
    Returns history of files ingested from data/incoming.
    """
    result = await db.execute(
        select(FileProcessingRecord).order_by(desc(FileProcessingRecord.id)).limit(limit)
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "file_hash": r.file_hash,
            "file_type": r.file_type,
            "record_count": r.record_count,
            "status": r.status,
            "error_message": r.error_message,
            "processed_at": r.processed_at.isoformat() if r.processed_at else None
        }
        for r in records
    ]

@router.post("/files/upload")
async def upload_telemetry_file(
    file: UploadFile = File(...),
    operator_id: str = Query("OPERATOR-PRIMARY"),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads and processes a tactical telemetry batch file (.json, .jsonl, .csv).
    Validates format, checks duplicate hash, executes security pipeline per record,
    stores FileProcessingRecord, and logs audit trail.
    """
    filename = file.filename or "unknown_upload"
    ext = Path(filename).suffix.lower()
    
    if ext not in [".json", ".jsonl", ".csv"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Only .json, .jsonl, and .csv are supported."
        )

    content_bytes = await file.read()
    if not content_bytes or len(content_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(content_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum permitted tactical limit (10MB).")

    file_hash = SHA256Hasher.digest(content_bytes)
    file_type = ext.replace(".", "").upper()

    # 1. Duplicate check
    existing = await db.execute(
        select(FileProcessingRecord).where(FileProcessingRecord.file_hash == file_hash)
    )
    if existing.scalar_one_or_none():
        await audit_service.log_security_event(
            event_type="FILE_INGESTION_DUPLICATE_REJECTED",
            severity="WARNING",
            source=operator_id,
            description=f"Duplicate file ingestion rejected: {filename} (hash {file_hash[:16]}...)",
            details={"filename": filename, "file_hash": file_hash}
        )
        raise HTTPException(
            status_code=409,
            detail=f"Duplicate file: {filename} with hash {file_hash[:16]}... has already been processed."
        )

    # 2. Parse records
    from app.ingestion.file_watcher import file_watcher
    records, parse_err = file_watcher._parse_records(content_bytes, ext)
    if parse_err:
        rec = FileProcessingRecord(
            filename=filename,
            file_hash=file_hash,
            file_type=file_type,
            record_count=0,
            status="MALFORMED",
            error_message=parse_err,
            processed_at=datetime.now(timezone.utc)
        )
        db.add(rec)
        await db.commit()
        await audit_service.log_security_event(
            event_type="FILE_INGESTION_FAILED",
            severity="CRITICAL",
            source=operator_id,
            description=f"Malformed file rejected: {filename} - {parse_err}",
            details={"filename": filename, "error": parse_err}
        )
        raise HTTPException(
            status_code=400,
            detail=f"Malformed file content: {parse_err}"
        )

    if not records:
        raise HTTPException(status_code=400, detail="File contained no valid telemetry packet records.")

    # 3. Process records through security pipeline
    from app.api.endpoints_telemetry import normalize_and_seal_telemetry
    processed_count = 0
    accepted_count = 0
    blocked_count = 0
    for idx, record in enumerate(records):
        try:
            sealed_record = normalize_and_seal_telemetry(record, sequence_offset=idx)
            res = await pipeline.process_packet(sealed_record)
            processed_count += 1
            if res.get("action") == "ACCEPTED":
                accepted_count += 1
            else:
                blocked_count += 1
        except Exception as ex:
            logger.error(f"Error processing packet from uploaded file {filename}: {ex}")

    # 4. Save processed file record
    now = datetime.now(timezone.utc)
    rec = FileProcessingRecord(
        filename=filename,
        file_hash=file_hash,
        file_type=file_type,
        record_count=processed_count,
        status="PROCESSED",
        error_message=None,
        processed_at=now
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)

    # 5. Save copy to processed dir if possible
    try:
        ts = now.strftime("%Y%m%d_%H%M%S")
        dest = settings.PROCESSED_DIR / f"{ts}_{filename}"
        dest.write_bytes(content_bytes)
    except Exception:
        pass

    # 6. Audit logging
    await audit_service.log_security_event(
        event_type="FILE_INGESTION_COMPLETED",
        severity="INFO",
        source=operator_id,
        description=f"File {filename} ingested: {processed_count} packets processed ({accepted_count} accepted, {blocked_count} blocked)",
        details={
            "filename": filename,
            "file_hash": file_hash,
            "record_count": processed_count,
            "accepted_count": accepted_count,
            "blocked_count": blocked_count,
            "file_type": file_type
        }
    )

    # 7. WebSocket broadcast
    try:
        await ws_manager.broadcast("file_processed", {
            "id": rec.id,
            "filename": filename,
            "file_hash": file_hash,
            "record_count": processed_count,
            "status": "PROCESSED",
            "processed_at": now.isoformat()
        })
    except Exception:
        pass

    return {
        "status": "PROCESSED",
        "id": rec.id,
        "filename": filename,
        "file_hash": file_hash,
        "file_type": file_type,
        "record_count": processed_count,
        "accepted_count": accepted_count,
        "blocked_count": blocked_count,
        "message": f"Successfully ingested {filename} ({processed_count} records processed: {accepted_count} authentic, {blocked_count} threats filtered)."
    }

@router.post("/files/sample")
async def ingest_sample_file(
    sample_type: str = Query("authentic", pattern="^(authentic|tampered)$"),
    operator_id: str = Query("OPERATOR-PRIMARY"),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingests one of the sample telemetry files stored in data/samples.
    """
    from app.ingestion.file_watcher import file_watcher
    sample_filename = f"telemetry_{sample_type}_1790441130.json"
    sample_path = settings.SAMPLES_DIR / sample_filename
    
    if not sample_path.exists():
        if sample_type == "authentic":
            sample_records = [
                {
                    "packet_id": f"PKT-SMP-AUTH-{int(time.time()*1000)%100000}",
                    "sequence_num": 1050,
                    "source": "UAV-ALPHA-01",
                    "timestamp": time.time(),
                    "packet_type": "TELEMETRY_POSITION",
                    "payload": {"latitude": 34.0522, "longitude": -118.2437, "altitude_m": 1500}
                }
            ]
        else:
            sample_records = [
                {
                    "packet_id": f"PKT-SMP-TAMP-{int(time.time()*1000)%100000}",
                    "sequence_num": 1051,
                    "source": "UAV-BRAVO-02",
                    "timestamp": time.time() - 100.0,
                    "packet_type": "TELEMETRY_POSITION",
                    "payload": {"latitude": 0.0, "longitude": 0.0, "altitude_m": 0}
                }
            ]
        content_bytes = json.dumps(sample_records, indent=2).encode('utf-8')
    else:
        raw = json.loads(sample_path.read_text(encoding='utf-8'))
        records = raw if isinstance(raw, list) else (raw.get("packets", [raw]))
        ts = int(time.time() * 1000) % 100000
        for i, r in enumerate(records):
            r["packet_id"] = f"PKT-SMP-{sample_type.upper()[:4]}-{ts}-{i}"
            r["timestamp"] = time.time() if sample_type == "authentic" else (time.time() - 30.0)
        content_bytes = json.dumps(records, indent=2).encode('utf-8')

    file_hash = SHA256Hasher.digest(content_bytes)
    filename = f"sample_{sample_type}_{int(time.time())}.json"
    
    records, _ = file_watcher._parse_records(content_bytes, ".json")
    processed_count = 0
    accepted_count = 0
    blocked_count = 0
    for idx, r in enumerate(records):
        sealed_r = normalize_and_seal_telemetry(r, sequence_offset=idx)
        res = await pipeline.process_packet(sealed_r)
        processed_count += 1
        if res.get("action") == "ACCEPTED":
            accepted_count += 1
        else:
            blocked_count += 1

    now = datetime.now(timezone.utc)
    rec = FileProcessingRecord(
        filename=filename,
        file_hash=file_hash,
        file_type="JSON",
        record_count=processed_count,
        status="PROCESSED",
        error_message=None,
        processed_at=now
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)

    await audit_service.log_security_event(
        event_type="FILE_INGESTION_COMPLETED",
        severity="INFO",
        source=operator_id,
        description=f"Sample file {filename} ingested: {processed_count} packets processed ({accepted_count} accepted, {blocked_count} blocked)",
        details={"filename": filename, "file_hash": file_hash, "record_count": processed_count}
    )

    try:
        await ws_manager.broadcast("file_processed", {
            "id": rec.id,
            "filename": filename,
            "file_hash": file_hash,
            "record_count": processed_count,
            "status": "PROCESSED",
            "processed_at": now.isoformat()
        })
    except Exception:
        pass

    return {
        "status": "PROCESSED",
        "id": rec.id,
        "filename": filename,
        "file_hash": file_hash,
        "record_count": processed_count,
        "accepted_count": accepted_count,
        "blocked_count": blocked_count,
        "message": f"Successfully ingested {filename} with {processed_count} records."
    }

@router.post("/verify-and-archive")
async def verify_and_archive_telemetry(
    raw_packet: Dict[str, Any],
    operator_id: str = Query("OPERATOR-PRIMARY"),
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a raw telemetry frame for verification and immediate persistent archival.
    Enforces business rules: only AUTHENTIC & ACCEPTED packets are archived as verified.
    If verification fails, rejects archival as verified and logs an audit event.
    """
    result = await pipeline.process_packet(raw_packet)
    action = result.get("action")
    classification = result.get("classification")
    packet_id = result.get("packet_id")

    if action != "ACCEPTED" or classification != "AUTHENTIC":
        await audit_service.log_security_event(
            event_type="VERIFICATION_FAILURE_ARCHIVE_REJECTED",
            severity="WARNING",
            source=operator_id,
            packet_id=packet_id,
            description=f"Rejected verified archival for packet {packet_id}: Classification {classification}, Action {action}",
            details={
                "packet_id": packet_id,
                "classification": classification,
                "action": action,
                "trust_score": result.get("trust_score"),
                "auth_status": result.get("auth_status"),
                "sig_status": result.get("sig_status"),
                "freshness_status": result.get("freshness_status"),
                "integrity_status": result.get("integrity_status")
            }
        )
        raise HTTPException(
            status_code=422,
            detail=f"Telemetry verification failed ({classification} - {action}). Packet cannot be archived as verified telemetry."
        )

    pkt_rec = await db.execute(
        select(PacketRecord).where(PacketRecord.packet_id == packet_id)
    )
    p = pkt_rec.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    batch_id = f"BATCH-VERIF-{int(time.time() * 1000)}"

    if p:
        p.is_archived = True
        p.archived_at = now
        p.archived_by = operator_id
        p.archive_batch_id = batch_id
        await db.commit()

    await audit_service.log_archive_action(
        operator_id=operator_id,
        count=1,
        batch_id=batch_id,
        packet_ids=[packet_id]
    )

    try:
        await ws_manager.broadcast("data_archived", {
            "batch_id": batch_id,
            "count": 1,
            "operator_id": operator_id,
            "timestamp": now.isoformat()
        })
    except Exception:
        pass

    return {
        "status": "VERIFIED_AND_ARCHIVED",
        "packet_id": packet_id,
        "classification": classification,
        "trust_score": result.get("trust_score"),
        "batch_id": batch_id,
        "message": f"Packet {packet_id} verified authentic (Trust: {result.get('trust_score')}) and archived to vault."
    }

class ArchiveRequest(BaseModel):
    packet_ids: Optional[List[str]] = None
    archive_all_active: bool = False
    operator_id: str = "OPERATOR-PRIMARY"
    reason: Optional[str] = "Tactical data archival"

class RestoreRequest(BaseModel):
    packet_id: str
    operator_id: str = "OPERATOR-PRIMARY"

@router.post("/packets")
async def archive_packets(req: ArchiveRequest, db: AsyncSession = Depends(get_db)):
    """
    Archives active telemetry packets to the persistent data vault.
    Separates active buffer from archived data, prevents accidental duplicates,
    and logs the action to the security audit trail.
    """
    if not req.packet_ids and not req.archive_all_active:
        return Response(
            content='{"detail": "Either packet_ids or archive_all_active must be specified."}',
            status_code=400,
            media_type="application/json"
        )

    # 1. Fetch packets to archive
    if req.packet_ids:
        query = select(PacketRecord).where(PacketRecord.packet_id.in_(req.packet_ids))
    else:
        query = select(PacketRecord).where(PacketRecord.is_archived == False).limit(500)

    result = await db.execute(query)
    found_packets = result.scalars().all()

    if not found_packets:
        return {
            "status": "NOOP",
            "message": "No matching active packets found to archive.",
            "archived_count": 0
        }

    # 2. Filter out any already archived packets to prevent duplicate operations
    unarchived = [p for p in found_packets if not p.is_archived]
    if not unarchived:
        return {
            "status": "ALREADY_ARCHIVED",
            "message": "All specified packets have already been archived.",
            "archived_count": 0,
            "already_archived_count": len(found_packets)
        }

    # 3. Perform atomic archival
    batch_id = f"BATCH-ARCH-{int(time.time() * 1000)}"
    now = datetime.now(timezone.utc)
    archived_ids = []

    for p in unarchived:
        p.is_archived = True
        p.archived_at = now
        p.archived_by = req.operator_id
        p.archive_batch_id = batch_id
        archived_ids.append(p.packet_id)

    await db.commit()

    # 4. Security audit logging
    await audit_service.log_archive_action(
        operator_id=req.operator_id,
        count=len(unarchived),
        batch_id=batch_id,
        packet_ids=archived_ids
    )

    # 5. Broadcast live WebSocket event
    try:
        await ws_manager.broadcast("data_archived", {
            "batch_id": batch_id,
            "count": len(unarchived),
            "operator_id": req.operator_id,
            "timestamp": now.isoformat()
        })
    except Exception:
        pass

    return {
        "status": "SUCCESS",
        "message": f"Successfully archived {len(unarchived)} packet(s) to vault.",
        "batch_id": batch_id,
        "archived_count": len(unarchived),
        "archived_packet_ids": archived_ids
    }

@router.get("/packets")
async def get_archived_packets(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns paginated archived packets from the vault.
    """
    query = select(PacketRecord).where(PacketRecord.is_archived == True).order_by(desc(PacketRecord.archived_at))

    if source:
        query = query.where(PacketRecord.source == source)
    if search:
        query = query.where(PacketRecord.packet_id.ilike(f"%{search}%"))

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    records = result.scalars().all()

    return [
        {
            "id": p.id,
            "packet_id": p.packet_id,
            "sequence_num": p.sequence_num,
            "source": p.source,
            "timestamp": p.timestamp,
            "packet_type": p.packet_type,
            "key_id": p.key_id,
            "classification": p.classification,
            "trust_score": p.trust_score,
            "action": p.action,
            "decrypted_payload": p.decrypted_payload,
            "is_archived": True,
            "archived_at": p.archived_at.isoformat() if p.archived_at else None,
            "archived_by": p.archived_by,
            "archive_batch_id": p.archive_batch_id,
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in records
    ]

@router.post("/restore")
async def restore_packet(req: RestoreRequest, db: AsyncSession = Depends(get_db)):
    """
    Restores an archived packet back to the active telemetry buffer.
    """
    result = await db.execute(
        select(PacketRecord).where(PacketRecord.packet_id == req.packet_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        return Response(content='{"detail": "Packet not found."}', status_code=404, media_type="application/json")
    if not p.is_archived:
        return {"status": "ALREADY_ACTIVE", "message": "Packet is already active.", "packet_id": p.packet_id}

    p.is_archived = False
    p.archived_at = None
    p.archived_by = None
    p.archive_batch_id = None
    await db.commit()

    await audit_service.log_restore_action(operator_id=req.operator_id, packet_id=req.packet_id)

    try:
        await ws_manager.broadcast("data_restored", {
            "packet_id": req.packet_id,
            "operator_id": req.operator_id
        })
    except Exception:
        pass

    return {
        "status": "RESTORED",
        "message": f"Packet {req.packet_id} restored to active telemetry buffer.",
        "packet_id": req.packet_id
    }

@router.get("/stats")
async def get_archive_stats(db: AsyncSession = Depends(get_db)):
    """
    Returns summary statistics comparing active vs archived records.
    """
    active_count = await db.scalar(
        select(func.count(PacketRecord.id)).where(PacketRecord.is_archived == False)
    )
    archived_count = await db.scalar(
        select(func.count(PacketRecord.id)).where(PacketRecord.is_archived == True)
    )
    total_files = await db.scalar(
        select(func.count(FileProcessingRecord.id))
    )
    last_archived = await db.scalar(
        select(func.max(PacketRecord.archived_at)).where(PacketRecord.is_archived == True)
    )

    return {
        "active_packets": active_count or 0,
        "archived_packets": archived_count or 0,
        "total_files": total_files or 0,
        "last_archived_at": last_archived.isoformat() if last_archived else None
    }

