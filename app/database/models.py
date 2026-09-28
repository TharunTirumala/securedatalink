from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from app.database.connection import Base

def utcnow():
    return datetime.now(timezone.utc)

class PacketRecord(Base):
    __tablename__ = "packets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    packet_id = Column(String(64), unique=True, index=True, nullable=False)
    sequence_num = Column(Integer, index=True)
    source = Column(String(64), index=True, nullable=False)
    timestamp = Column(Float, nullable=False)
    packet_type = Column(String(32), default="Telemetry")
    
    # Cryptographic fields
    key_id = Column(String(32), default="SK-ALPHA-042")
    iv_hex = Column(String(32))
    tag_hex = Column(String(32))
    ciphertext_preview = Column(String(128))
    signature_hex = Column(Text)
    payload_hash = Column(String(64))
    decrypted_payload = Column(JSON, nullable=True)
    
    # Verification statuses
    auth_status = Column(String(32))       # VERIFIED, FAILED, SKIPPED
    freshness_status = Column(String(32))  # PASS, FAIL
    sig_status = Column(String(32))        # VERIFIED, INVALID, SKIPPED
    integrity_status = Column(String(32))  # PASS, FAIL
    
    # Outcomes
    classification = Column(String(32), index=True) # AUTHENTIC, REPLAYED, TAMPERED, etc.
    trust_score = Column(Integer)                   # 0 - 100
    trust_details = Column(JSON, nullable=True)     # breakdown of checks
    action = Column(String(32), index=True)         # ACCEPTED, BLOCKED, REJECTED, FILTERED
    reason = Column(String(256), nullable=True)     # Cryptographic evaluation decision reason
    latency_ms = Column(Float, default=0.0)
    simulated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow, index=True)
    
    # Archival fields
    is_archived = Column(Boolean, default=False, index=True)
    archived_at = Column(DateTime, nullable=True, index=True)
    archived_by = Column(String(64), nullable=True)
    archive_batch_id = Column(String(64), nullable=True)


class SecurityLogRecord(Base):
    __tablename__ = "security_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    event_type = Column(String(64), index=True, nullable=False)
    severity = Column(String(16), index=True, nullable=False) # INFO, WARNING, CRITICAL
    source = Column(String(64), index=True)
    packet_id = Column(String(64), index=True, nullable=True)
    description = Column(String(256), nullable=False)
    details = Column(JSON, nullable=True)

class ThreatEventRecord(Base):
    __tablename__ = "threat_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    packet_id = Column(String(64), index=True, nullable=False)
    source = Column(String(64), index=True, nullable=False)
    event = Column(String(128), nullable=False)
    severity = Column(String(16), index=True, nullable=False) # HIGH, CRITICAL, MEDIUM
    action = Column(String(32), nullable=False)               # BLOCKED, REJECTED, FILTERED
    details = Column(JSON, nullable=True)

class OperatorActionRecord(Base):
    __tablename__ = "operator_actions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    operator_id = Column(String(64), default="OPERATOR-PRIMARY")
    action = Column(String(64), nullable=False)
    confirmed = Column(Boolean, default=True)
    status = Column(String(32), default="EXECUTED")
    details = Column(JSON, nullable=True)

class FileProcessingRecord(Base):
    __tablename__ = "file_processing"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename = Column(String(256), nullable=False)
    file_hash = Column(String(64), unique=True, index=True, nullable=False)
    file_type = Column(String(16), nullable=False)
    record_count = Column(Integer, default=0)
    status = Column(String(32), default="PROCESSED") # PROCESSED, ERROR, MALFORMED
    error_message = Column(Text, nullable=True)
    processed_at = Column(DateTime, default=utcnow, index=True)

class SystemStateRecord(Base):
    __tablename__ = "system_state"

    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

