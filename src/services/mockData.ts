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
  { id: 1, name: 'Telemetry Input', status: 'STANDBY', detail: 'UDP:9871, FileWatcher, REST' },
  { id: 2, name: 'Signal Ingestion', status: 'STANDBY', detail: 'Ingestion Queue & Normalization' },
  { id: 3, name: 'Preprocessing', status: 'STANDBY', detail: 'Frame validation & sanitization' },
  { id: 4, name: 'Nonce/Freshness', status: 'STANDBY', detail: '5.0s window & replay cache' },
  { id: 5, name: 'AES-256-GCM', status: 'STANDBY', detail: 'Key: SK-ALPHA-042' },
  { id: 6, name: 'ECDSA', status: 'STANDBY', detail: 'NIST P-256 (secp256r1)' },
  { id: 7, name: 'Integrity', status: 'STANDBY', detail: 'SHA-256 cryptographic digest' },
  { id: 8, name: 'Adaptive Filter', status: 'STANDBY', detail: 'Anomaly & Threat Filter' },
  { id: 9, name: 'Trust Score', status: 'STANDBY', detail: 'Multi-factor score (0-100)' },
  { id: 10, name: 'C2 Output', status: 'STANDBY', detail: 'Forwarding Stream' },
];

export const INITIAL_PACKETS: Packet[] = [];

export const INITIAL_THREATS: ThreatEvent[] = [];

export const INITIAL_LOGS: SecurityLog[] = [];

export const INITIAL_STATS: DashboardStats = {
  total_packets: 0,
  authenticated_packets: 0,
  packet_rate: 0.0,
  packet_latency: 0.0,
  replay_filtered: 0,
  system_security_status: 'STANDBY',
  trust_score: 100.0,
  stream_status: 'STOPPED',
  demo_state: 'STOPPED',
  active_key_id: 'SK-ALPHA-042',
  simulator_active: false,
  adaptive_filter: {
    is_active: false,
    evaluated: 0,
    accepted: 0,
    rejected: 0,
    blocked: 0,
    replay: 0,
    tampered: 0,
    filtered: 0,
    filtered_sources: []
  },
  c2_output: {
    status: 'STANDBY',
    forwarded: 0,
    blocked: 0,
    rejected: 0,
    recent_count: 0
  }
};
