from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class TelemetryPayload(BaseModel):
    latitude: float = Field(..., description="Tactical coordinate latitude")
    longitude: float = Field(..., description="Tactical coordinate longitude")
    altitude_m: float = Field(..., description="Altitude in meters AGL/MSL")
    speed_mps: float = Field(..., description="Ground speed in m/s")
    heading_deg: float = Field(..., description="Heading in degrees")
    battery_pct: float = Field(..., description="Power bus battery percentage")
    pitch_deg: float = 0.0
    roll_deg: float = 0.0
    link_quality: int = 98

class RawPacketIn(BaseModel):
    packet_id: str
    sequence_num: int
    source: str
    timestamp: float
    packet_type: str = "Telemetry"
    key_id: str = "SK-ALPHA-042"
    iv: str               # hex-encoded 12-byte IV
    tag: str              # hex-encoded 16-byte GCM auth tag
    ciphertext: str       # hex-encoded ciphertext
    signature: str        # hex-encoded ECDSA signature
    payload_hash: str     # hex-encoded SHA-256 digest of original plaintext
    simulated: bool = False

class TrustDetails(BaseModel):
    auth_ok: bool
    sig_ok: bool
    fresh_ok: bool
    replay_ok: bool
    integrity_ok: bool
    source_ok: bool
    score: int
    breakdown: Dict[str, int]

class PacketResponse(BaseModel):
    packet_id: str
    sequence_num: int
    source: str
    timestamp: float
    packet_type: str
    key_id: str
    iv_hex: Optional[str] = None
    tag_hex: Optional[str] = None
    ciphertext_preview: Optional[str] = None
    signature_hex: Optional[str] = None
    payload_hash: Optional[str] = None
    
    auth_status: str
    freshness_status: str
    sig_status: str
    integrity_status: str
    
    classification: str
    trust_score: int
    trust_details: Optional[Dict[str, Any]] = None
    action: str
    latency_ms: float
    decrypted_payload: Optional[Dict[str, Any]] = None
    simulated: bool
    created_at: str

class ThreatEvent(BaseModel):
    id: Optional[int] = None
    timestamp: str
    packet_id: str
    source: str
    event: str
    severity: str
    action: str
    details: Optional[Dict[str, Any]] = None

class SecurityLog(BaseModel):
    id: Optional[int] = None
    timestamp: str
    event_type: str
    severity: str
    source: Optional[str] = None
    packet_id: Optional[str] = None
    description: str
    details: Optional[Dict[str, Any]] = None

class OperatorAction(BaseModel):
    action: str
    confirmed: bool = True
    operator_id: str = "OPERATOR-PRIMARY"
    parameters: Optional[Dict[str, Any]] = None

class SimulatorConfig(BaseModel):
    enabled: bool
    rate_hz: float = 1.0
    attack_ratio: float = 0.25
    sources: List[str] = ["UAV-ALPHA-01", "UAV-BRAVO-02", "UGV-SIERRA-03", "BASE-RELAY-04"]

class DashboardStats(BaseModel):
    authenticated_packets: int
    packet_rate: float
    packet_latency: float
    replay_filtered: int
    system_security_status: str
    average_trust_score: float
    stream_status: str
    active_key_id: str
    
    # Adaptive filter stats
    filter_evaluated: int
    filter_accepted: int
    filter_rejected: int
    filter_blocked: int
    replay_detected: int
    tampered_detected: int
    
    # C2 Stats
    c2_forwarded: int
    c2_status: str
