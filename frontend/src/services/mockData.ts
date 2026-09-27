import { DashboardStats, PipelineStage, Packet, ThreatEvent, SecurityLog, KeyMetadata } from '../types/telemetry';

export const INITIAL_KEY: KeyMetadata = {
  key_id: 'KEY-TACTICAL-2026-NIST-P256',
  algorithm: 'AES-256-GCM',
  signature_algorithm: 'ECDSA NIST P-256 (secp256r1)',
  status: 'ACTIVE',
  purpose: 'Tactical Datalink Authenticated Encryption & Integrity Verification',
  rotation_status: 'SYNCHRONIZED',
  created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  last_sync: new Date(Date.now() - 60000).toISOString(),
  next_rotation: new Date(Date.now() + 3600000 * 20).toISOString(),
  rotation_seconds_remaining: 72000,
  masked_key: '7b21e8d4a980cbf173...4a09',
  environment_note: 'Hardware Security Module (HSM) FIPS 140-3 Level 3 Emulated'
};

export const INITIAL_STAGES: PipelineStage[] = [
  { id: 1, name: 'Telemetry Input', status: 'ACTIVE', detail: 'UDP & WebSocket Stream Ingestion' },
  { id: 2, name: 'Signal Ingestion', status: 'PASS', detail: 'Signal Format & Header Verification' },
  { id: 3, name: 'Preprocessing', status: 'PASS', detail: 'Frame Extraction & Normalization' },
  { id: 4, name: 'Nonce/Freshness', status: 'PASS', detail: 'Sliding Window & Replay Protection' },
  { id: 5, name: 'AES-256-GCM', status: 'PASS', detail: 'Hardware Accelerated Decryption' },
  { id: 6, name: 'ECDSA', status: 'PASS', detail: 'NIST P-256 Signature Verification' },
  { id: 7, name: 'Integrity', status: 'PASS', detail: 'SHA-256 Hash Matching' },
  { id: 8, name: 'Adaptive Filter', status: 'PASS', detail: 'Anomaly & Threat Scoring Filter' },
  { id: 9, name: 'Trust Score', status: 'PASS', detail: 'Bayesian Trust Index Assessment' },
  { id: 10, name: 'C2 Output', status: 'CONNECTED', detail: 'Secure C2 Forwarding Stream' },
];

export const INITIAL_PACKETS: Packet[] = [
  {
    id: 1,
    packet_id: 'PKT-ALPHA-98214',
    sequence_num: 1042,
    source: 'UAV-ALPHA-01',
    timestamp: Date.now() / 1000 - 1.2,
    packet_type: 'TELEMETRY_POSITION',
    key_id: 'KEY-TACTICAL-2026-NIST-P256',
    auth_status: 'VERIFIED',
    freshness_status: 'PASS',
    sig_status: 'VERIFIED',
    integrity_status: 'PASS',
    classification: 'AUTHENTIC',
    trust_score: 98.4,
    trust_details: {
      score: 98.4,
      auth_ok: true,
      sig_ok: true,
      fresh_ok: true,
      replay_ok: true,
      integrity_ok: true,
      source_ok: true,
      is_suspicious: false,
      breakdown: { auth_points: 25, sig_points: 25, fresh_points: 20, replay_points: 10, integrity_points: 10, source_points: 8.4 }
    },
    action: 'ACCEPTED',
    latency_ms: 18.4,
    decrypted_payload: {
      latitude: 34.0522,
      longitude: -118.2437,
      altitude_m: 1450.8,
      speed_mps: 42.5,
      heading_deg: 184.2,
      battery_pct: 88.5,
      flight_mode: 'AUTONOMOUS_PATROL',
      link_quality: 99.2
    },
    simulated: true,
    created_at: new Date(Date.now() - 1200).toISOString()
  },
  {
    id: 2,
    packet_id: 'PKT-BRAVO-88392',
    sequence_num: 914,
    source: 'UAV-BRAVO-02',
    timestamp: Date.now() / 1000 - 45.0,
    packet_type: 'TELEMETRY_POSITION',
    key_id: 'KEY-TACTICAL-2026-NIST-P256',
    auth_status: 'FAILED',
    freshness_status: 'FAIL',
    sig_status: 'INVALID',
    integrity_status: 'FAIL',
    classification: 'TAMPERED',
    trust_score: 12.0,
    trust_details: {
      score: 12.0,
      auth_ok: false,
      sig_ok: false,
      fresh_ok: false,
      replay_ok: true,
      integrity_ok: false,
      source_ok: true,
      is_suspicious: true,
      breakdown: { auth_points: 0, sig_points: 0, fresh_points: 0, replay_points: 10, integrity_points: 0, source_points: 2.0 }
    },
    action: 'BLOCKED',
    latency_ms: 14.1,
    simulated: true,
    created_at: new Date(Date.now() - 45000).toISOString()
  },
  {
    id: 3,
    packet_id: 'PKT-SIERRA-77142',
    sequence_num: 611,
    source: 'UGV-SIERRA-03',
    timestamp: Date.now() / 1000 - 3.8,
    packet_type: 'GROUND_TELEMETRY',
    key_id: 'KEY-TACTICAL-2026-NIST-P256',
    auth_status: 'VERIFIED',
    freshness_status: 'PASS',
    sig_status: 'VERIFIED',
    integrity_status: 'PASS',
    classification: 'AUTHENTIC',
    trust_score: 95.8,
    trust_details: {
      score: 95.8,
      auth_ok: true,
      sig_ok: true,
      fresh_ok: true,
      replay_ok: true,
      integrity_ok: true,
      source_ok: true,
      is_suspicious: false,
      breakdown: { auth_points: 25, sig_points: 25, fresh_points: 20, replay_points: 10, integrity_points: 10, source_points: 5.8 }
    },
    action: 'ACCEPTED',
    latency_ms: 22.1,
    decrypted_payload: {
      latitude: 34.0489,
      longitude: -118.2511,
      altitude_m: 112.4,
      speed_mps: 8.2,
      heading_deg: 92.0,
      battery_pct: 94.1,
      flight_mode: 'GROUND_RECON',
      link_quality: 97.4
    },
    simulated: true,
    created_at: new Date(Date.now() - 3800).toISOString()
  },
  {
    id: 4,
    packet_id: 'PKT-BASE-66120',
    sequence_num: 504,
    source: 'BASE-RELAY-04',
    timestamp: Date.now() / 1000 - 180.0,
    packet_type: 'RELAY_HEARTBEAT',
    key_id: 'KEY-TACTICAL-2026-NIST-P256',
    auth_status: 'VERIFIED',
    freshness_status: 'FAIL',
    sig_status: 'VERIFIED',
    integrity_status: 'PASS',
    classification: 'REPLAYED',
    trust_score: 41.5,
    trust_details: {
      score: 41.5,
      auth_ok: true,
      sig_ok: true,
      fresh_ok: false,
      replay_ok: false,
      integrity_ok: true,
      source_ok: true,
      is_suspicious: true,
      breakdown: { auth_points: 25, sig_points: 25, fresh_points: 0, replay_points: 0, integrity_points: 10, source_points: 1.5 }
    },
    action: 'BLOCKED',
    latency_ms: 12.0,
    simulated: true,
    created_at: new Date(Date.now() - 180000).toISOString()
  }
];

export const INITIAL_THREATS: ThreatEvent[] = [
  {
    id: 1,
    timestamp: new Date(Date.now() - 45000).toISOString(),
    packet_id: 'PKT-BRAVO-88392',
    source: 'UAV-BRAVO-02',
    event: 'CRYPTOGRAPHIC_SIGNATURE_TAMPER_DETECTED',
    severity: 'CRITICAL',
    action: 'BLOCKED',
    details: {
      reason: 'ECDSA signature verification failed against NIST P-256 public key',
      auth_tag: 'INVALID_GCM_TAG',
      trust_penalty: -88
    }
  },
  {
    id: 2,
    timestamp: new Date(Date.now() - 180000).toISOString(),
    packet_id: 'PKT-BASE-66120',
    source: 'BASE-RELAY-04',
    event: 'REPLAY_ATTACK_DETECTED',
    severity: 'HIGH',
    action: 'BLOCKED',
    details: {
      reason: 'Packet timestamp outside sliding freshness threshold (Delta: 175.0s > 5.0s)',
      nonce_status: 'DUPLICATE_NONCE',
      trust_penalty: -50
    }
  }
];

export const INITIAL_LOGS: SecurityLog[] = [
  {
    id: 1,
    timestamp: new Date().toISOString(),
    event_type: 'SYSTEM_STARTUP',
    severity: 'INFO',
    description: 'SecureLink Tactical Datalink System initialized and ready.'
  },
  {
    id: 2,
    timestamp: new Date(Date.now() - 45000).toISOString(),
    event_type: 'TAMPER_ALERT',
    severity: 'CRITICAL',
    source: 'UAV-BRAVO-02',
    packet_id: 'PKT-BRAVO-88392',
    description: 'Intercepted and dropped forged telemetry vector with corrupted ECDSA signature.'
  },
  {
    id: 3,
    timestamp: new Date(Date.now() - 180000).toISOString(),
    event_type: 'REPLAY_FILTER',
    severity: 'WARNING',
    source: 'BASE-RELAY-04',
    packet_id: 'PKT-BASE-66120',
    description: 'Stale telemetry packet discarded by sliding freshness evaluation.'
  }
];

export const INITIAL_STATS: DashboardStats = {
  authenticated_packets: 48,
  packet_rate: 1.2,
  packet_latency: 18.5,
  replay_filtered: 6,
  system_security_status: 'ONLINE',
  trust_score: 96.5,
  stream_status: 'ACTIVE',
  active_key_id: 'KEY-TACTICAL-2026-NIST-P256',
  simulator_active: true,
  adaptive_filter: {
    is_active: true,
    evaluated: 54,
    accepted: 48,
    rejected: 0,
    blocked: 6,
    replay: 4,
    tampered: 2,
    filtered: 0,
    filtered_sources: []
  },
  c2_output: {
    status: 'ACTIVE',
    forwarded: 48,
    blocked: 6,
    rejected: 0,
    recent_count: 10
  }
};
