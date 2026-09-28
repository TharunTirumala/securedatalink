import csv
import io
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.connection import async_session
from app.database.models import SecurityLogRecord, ThreatEventRecord, OperatorActionRecord
from app.services.ws_manager import ws_manager

def sanitize_log_data(data: Any) -> Any:
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if any(secret_term in k.lower() for secret_term in ("secret", "key_bytes", "passcode", "password", "token", "auth_tag")):
                sanitized[k] = "••••••••"
            else:
                sanitized[k] = sanitize_log_data(v)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_log_data(item) for item in data]
    return data

def sanitize_csv_cell(val: Any) -> str:
    """Mitigates CSV formula injection (DDE) by escaping leading formula characters."""
    if val is None:
        return ""
    s = str(val)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s

class AuditService:
    """
    Persistent audit logging and compliance export service with CSV formula injection mitigation
    and zero secret exposure.
    """
    
    @staticmethod
    async def log_security_event(
        event_type: str,
        severity: str,
        description: str,
        source: Optional[str] = None,
        packet_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        session: Optional[AsyncSession] = None
    ) -> SecurityLogRecord:
        clean_details = sanitize_log_data(details) if details else None
        record = SecurityLogRecord(
            timestamp=datetime.now(timezone.utc),
            event_type=event_type,
            severity=severity,
            source=source,
            packet_id=packet_id,
            description=description,
            details=clean_details
        )

        async def _persist(s: AsyncSession):
            s.add(record)
            await s.commit()
            await s.refresh(record)

        if session:
            await _persist(session)
        else:
            async with async_session() as s:
                await _persist(s)
            
        try:
            await ws_manager.broadcast("security_log_added", {
                "id": record.id,
                "timestamp": record.timestamp.isoformat() if record.timestamp else None,
                "event_type": record.event_type,
                "severity": record.severity,
                "source": record.source,
                "packet_id": record.packet_id,
                "description": record.description,
                "details": record.details
            })
        except Exception:
            pass
            
        return record

    @staticmethod
    async def log_threat_event(
        packet_id: str,
        source: str,
        event: str,
        severity: str,
        action: str,
        details: Optional[Dict[str, Any]] = None,
        session: Optional[AsyncSession] = None
    ) -> ThreatEventRecord:
        clean_details = sanitize_log_data(details) if details else None
        now = datetime.now(timezone.utc)
        threat = ThreatEventRecord(
            timestamp=now,
            packet_id=packet_id,
            source=source,
            event=event,
            severity=severity,
            action=action,
            details=clean_details
        )
        audit_log = SecurityLogRecord(
            timestamp=now,
            event_type=f"THREAT_{action}",
            severity=severity,
            source=source,
            packet_id=packet_id,
            description=f"{event} - Action: {action}",
            details=clean_details
        )

        async def _persist(s: AsyncSession):
            s.add(threat)
            s.add(audit_log)
            await s.commit()
            await s.refresh(threat)
            await s.refresh(audit_log)

        if session:
            await _persist(session)
        else:
            async with async_session() as s:
                await _persist(s)
        
        try:
            await ws_manager.broadcast("security_log_added", {
                "id": audit_log.id,
                "timestamp": audit_log.timestamp.isoformat() if audit_log.timestamp else None,
                "event_type": audit_log.event_type,
                "severity": audit_log.severity,
                "source": audit_log.source,
                "packet_id": audit_log.packet_id,
                "description": audit_log.description,
                "details": audit_log.details
            })
        except Exception:
            pass
            
        return threat

    @staticmethod
    async def log_operator_action(
        action: str,
        operator_id: str = "OPERATOR-PRIMARY",
        confirmed: bool = True,
        status: str = "EXECUTED",
        details: Optional[Dict[str, Any]] = None
    ) -> OperatorActionRecord:
        clean_details = sanitize_log_data(details) if details else None
        async with async_session() as session:
            record = OperatorActionRecord(
                timestamp=datetime.now(timezone.utc),
                operator_id=operator_id,
                action=action,
                confirmed=confirmed,
                status=status,
                details=clean_details
            )
            session.add(record)
            
            # Write audit trail
            severity = "WARNING" if "OVERRIDE" in action or "RESYNC" in action else "INFO"
            audit = SecurityLogRecord(
                timestamp=datetime.now(timezone.utc),
                event_type="OPERATOR_CONTROL",
                severity=severity,
                source=operator_id,
                description=f"Operator action executed: {action}",
                details=clean_details
            )
            session.add(audit)
            await session.commit()
            await session.refresh(record)
            await session.refresh(audit)
            
            try:
                await ws_manager.broadcast("security_log_added", {
                    "id": audit.id,
                    "timestamp": audit.timestamp.isoformat() if audit.timestamp else None,
                    "event_type": audit.event_type,
                    "severity": audit.severity,
                    "source": audit.source,
                    "packet_id": audit.packet_id,
                    "description": audit.description,
                    "details": audit.details
                })
            except Exception:
                pass
                
            return record

    @classmethod
    async def log_archive_action(
        cls,
        operator_id: str,
        count: int,
        batch_id: str,
        packet_ids: Optional[List[str]] = None
    ) -> SecurityLogRecord:
        """Records data archival in the security audit trail."""
        return await cls.log_security_event(
            event_type="DATA_ARCHIVE",
            severity="INFO",
            source=operator_id,
            description=f"Archived {count} packet(s) to persistent vault [Batch: {batch_id}]",
            details={
                "batch_id": batch_id,
                "archived_count": count,
                "sample_packet_ids": packet_ids[:5] if packet_ids else []
            }
        )

    @classmethod
    async def log_restore_action(
        cls,
        operator_id: str,
        packet_id: str
    ) -> SecurityLogRecord:
        """Records data restoration from the archive vault."""
        return await cls.log_security_event(
            event_type="DATA_RESTORE",
            severity="INFO",
            source=operator_id,
            packet_id=packet_id,
            description=f"Restored packet {packet_id} from vault to active telemetry buffer",
            details={"packet_id": packet_id, "action": "RESTORED"}
        )

    @classmethod
    async def log_authorization_failure(
        cls,
        operator_id: str,
        attempted_action: str,
        details: Optional[Dict[str, Any]] = None
    ) -> SecurityLogRecord:
        """Records an authorization or permission failure."""
        return await cls.log_security_event(
            event_type="AUTHORIZATION_FAILURE",
            severity="CRITICAL",
            source=operator_id,
            description=f"Unauthorized request rejected: {attempted_action} (Attempted by: {operator_id})",
            details=details
        )

    @classmethod
    async def log_stream_state(
        cls,
        operator_id: str,
        state: str,
        details: Optional[Dict[str, Any]] = None
    ) -> SecurityLogRecord:
        """Records a stream pause/resume state transition."""
        return await cls.log_security_event(
            event_type="STREAM_STATE_CHANGE",
            severity="WARNING" if state == "PAUSED" else "INFO",
            source=operator_id,
            description=f"Tactical telemetry stream transitioned to {state} by {operator_id}",
            details=details
        )

    @staticmethod
    async def export_logs_csv() -> str:
        """Generates downloadable CSV content of all security logs with formula injection protection."""
        async with async_session() as session:
            result = await session.execute(
                select(SecurityLogRecord).order_by(desc(SecurityLogRecord.timestamp)).limit(1000)
            )
            records = result.scalars().all()
            
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["ID", "Timestamp (UTC)", "Event Type", "Severity", "Source", "Packet ID", "Description", "Details"])
            for r in records:
                writer.writerow([
                    sanitize_csv_cell(r.id),
                    sanitize_csv_cell(r.timestamp.isoformat() if r.timestamp else ""),
                    sanitize_csv_cell(r.event_type),
                    sanitize_csv_cell(r.severity),
                    sanitize_csv_cell(r.source or ""),
                    sanitize_csv_cell(r.packet_id or ""),
                    sanitize_csv_cell(r.description),
                    sanitize_csv_cell(json.dumps(r.details) if r.details else "")
                ])
            return output.getvalue()

    @staticmethod
    async def export_logs_json() -> List[Dict[str, Any]]:
        """Returns JSON export of security logs."""
        async with async_session() as session:
            result = await session.execute(
                select(SecurityLogRecord).order_by(desc(SecurityLogRecord.timestamp)).limit(1000)
            )
            records = result.scalars().all()
            return [
                {
                    "id": r.id,
                    "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                    "event_type": r.event_type,
                    "severity": r.severity,
                    "source": r.source,
                    "packet_id": r.packet_id,
                    "description": r.description,
                    "details": r.details
                }
                for r in records
            ]

audit_service = AuditService()
