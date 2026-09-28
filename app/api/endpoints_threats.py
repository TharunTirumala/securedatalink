from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database.connection import get_db
from app.database.models import ThreatEventRecord
from app.processing.adaptive_filter import adaptive_filter

router = APIRouter()

@router.get("")
async def get_threat_events(
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[str] = None,
    action: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns detected threat events with severity and action indicators.
    """
    query = select(ThreatEventRecord).order_by(desc(ThreatEventRecord.id))
    if severity:
        query = query.where(ThreatEventRecord.severity == severity)
    if action:
        query = query.where(ThreatEventRecord.action == action)
        
    query = query.limit(limit)
    result = await db.execute(query)
    threats = result.scalars().all()
    
    return [
        {
            "id": t.id,
            "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            "packet_id": t.packet_id,
            "source": t.source,
            "event": t.event,
            "severity": t.severity,
            "action": t.action,
            "details": t.details
        }
        for t in threats
    ]

@router.get("/filter-stats")
async def get_adaptive_filter_stats():
    """
    Returns current counters from the Adaptive Verification & Filtering module.
    """
    return adaptive_filter.get_stats()
