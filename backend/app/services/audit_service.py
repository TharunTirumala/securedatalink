import csv
import io
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import select, desc
from app.database.connection import async_session
from app.database.models import SecurityLogRecord, ThreatEventRecord, OperatorActionRecord
from app.core.logging import logger

class AuditService:
    """
    Persistent audit logging and compliance export service.
    """
    
    @staticmethod
    async def log_security_event(
        event_type: str,
        severity: str,
        description: str,
        source: Optional[str] = None,
        packet_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> SecurityLogRecord:
        async with async_session() as session:
            record = SecurityLogRecord(
                timestamp=datetime.now(timezone.utc),
                event_type=event_type,
                severity=severity,
                source=source,
                packet_id=packet_id,
                description=description,
                details=details
            )
            session.add(record)
            await session.commit()
            await session.refresh(record)
            return record

    @staticmethod
    async def log_threat_event(
        packet_id: str,
        source: str,
        event: str,
        severity: str,
        action: str,
        details: Optional[Dict[str, Any]] = None
    ) -> ThreatEventRecord:
        async with async_session() as session:
            threat = ThreatEventRecord(
                timestamp=datetime.now(timezone.utc),
                packet_id=packet_id,
                source=source,
                event=event,
                severity=severity,
                action=action,
                details=details
            )
            session.add(threat)
            
            # Also write corresponding security audit log entry
            audit_log = SecurityLogRecord(
                timestamp=datetime.now(timezone.utc),
                event_type=f"THREAT_{action}",
                severity=severity,
                source=source,
                packet_id=packet_id,
                description=f"{event} - Action: {action}",
                details=details
            )
            session.add(audit_log)
            await session.commit()
            await session.refresh(threat)
            return threat

    @staticmethod
    async def log_operator_action(
        action: str,
        operator_id: str = "OPERATOR-PRIMARY",
        confirmed: bool = True,
        status: str = "EXECUTED",
        details: Optional[Dict[str, Any]] = None
    ) -> OperatorActionRecord:
        async with async_session() as session:
            record = OperatorActionRecord(
                timestamp=datetime.now(timezone.utc),
                operator_id=operator_id,
                action=action,
                confirmed=confirmed,
                status=status,
                details=details
            )
            session.add(record)
            
            # Write audit trail
            audit = SecurityLogRecord(
                timestamp=datetime.now(timezone.utc),
                event_type="OPERATOR_CONTROL",
                severity="WARNING" if "OVERRIDE" in action or "RESYNC" in action else "INFO",
                source=operator_id,
                description=f"Operator action executed: {action}",
                details=details
            )
            session.add(audit)
            await session.commit()
            await session.refresh(record)
            return record

    @staticmethod
    async def export_logs_csv() -> str:
        """Generates downloadable CSV content of all security logs."""
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
                    r.id,
                    r.timestamp.isoformat() if r.timestamp else "",
                    r.event_type,
                    r.severity,
                    r.source or "",
                    r.packet_id or "",
                    r.description,
                    json.dumps(r.details) if r.details else ""
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
