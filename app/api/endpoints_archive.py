from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.connection import get_db
from app.database.models import SecurityLogRecord, FileProcessingRecord
from app.services.audit_service import audit_service

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

from pydantic import BaseModel, Field
from typing import List, Optional
import time
from datetime import datetime, timezone
from app.database.models import PacketRecord
from app.services.ws_manager import ws_manager
from sqlalchemy import func

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

