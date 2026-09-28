export type Classification =
  | 'AUTHENTIC'
  | 'REPLAYED'
  | 'TAMPERED'
  | 'INVALID SIGNATURE'
  | 'INTEGRITY FAILURE'
  | 'INVALID FORMAT'
  | 'FILTERED';

export type Action = 'ACCEPTED' | 'BLOCKED' | 'REJECTED' | 'FILTERED';

export type Severity = 'CRITICAL' | 'HIGH' | 'WARNING' | 'MEDIUM' | 'LOW' | 'INFO';

export type VerificationStatus = 'VERIFIED' | 'FAILED' | 'SKIPPED' | 'PASS' | 'FAIL' | 'INVALID';

export interface TelemetryData {
  latitude: number;
  longitude: number;
  altitude_m: number;
  speed_mps: number;
  heading_deg: number;
  battery_pct: number;
  pitch_deg?: number;
  roll_deg?: number;
  link_quality?: number;
  flight_mode?: string;
  raw?: string;
}

export interface TrustDetails {
  score: number;
  auth_ok: boolean;
  sig_ok: boolean;
  fresh_ok: boolean;
  replay_ok: boolean;
  integrity_ok: boolean;
  source_ok: boolean;
  is_suspicious: boolean;
  breakdown: {
    auth_points: number;
    sig_points: number;
    fresh_points: number;
    replay_points: number;
    integrity_points: number;
    source_points: number;
  };
}

export interface Packet {
  id?: number;
  packet_id: string;
  sequence_num: number;
  source: string;
  timestamp: number;
  packet_type: string;
  key_id: string;
  iv_hex?: string;
  tag_hex?: string;
  ciphertext_preview?: string;
  signature_hex?: string;
  payload_hash?: string;
  auth_status: 'VERIFIED' | 'FAILED' | 'SKIPPED';
  freshness_status: 'PASS' | 'FAIL';
  sig_status: 'VERIFIED' | 'INVALID' | 'SKIPPED';
  integrity_status: 'PASS' | 'FAIL';
  classification: Classification;
  trust_score: number;
  trust_details?: TrustDetails;
  action: Action;
  reason?: string;
  latency_ms: number;
  decrypted_payload?: TelemetryData;
  simulated: boolean;
  created_at: string;
}

export interface ArchivedPacket extends Packet {
  archived_at: string;
  archive_batch_id?: string;
}

export interface ThreatEvent {
  id?: number;
  timestamp: string;
  packet_id: string;
  source: string;
  event: string;
  severity: Severity;
  action: Action;
  details?: Record<string, any>;
}

export interface SecurityLog {
  id?: number;
  timestamp: string;
  event_type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  source?: string;
  packet_id?: string;
  description: string;
  details?: Record<string, any>;
}

export interface DashboardStats {
  total_packets?: number;
  authenticated_packets: number;
  packet_rate: number;
  packet_latency: number;
  replay_filtered: number;
  system_security_status: string;
  trust_score: number;
  stream_status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  demo_state?: 'STOPPED' | 'RUNNING' | 'PAUSED';
  active_key_id: string;
  simulator_active: boolean;
  adaptive_filter: {
    is_active: boolean;
    evaluated: number;
    accepted: number;
    rejected: number;
    blocked: number;
    replay: number;
    tampered: number;
    filtered: number;
    filtered_sources: string[];
  };
  c2_output: {
    status: string;
    forwarded: number;
    blocked: number;
    rejected: number;
    recent_count: number;
  };
}

export interface PipelineStage {
  id: number;
  name: string;
  status: 'ACTIVE' | 'PASS' | 'VERIFIED' | 'CONNECTED' | 'STANDBY' | 'FAILED';
  detail: string;
}

export interface KeyMetadata {
  key_id: string;
  algorithm: string;
  signature_algorithm: string;
  status: string;
  purpose: string;
  rotation_status: string;
  created_at: string;
  last_sync: string;
  next_rotation: string;
  rotation_seconds_remaining: number;
  masked_key: string;
  environment_note: string;
}

export interface SimulatorConfig {
  enabled: boolean;
  rate_hz: number;
  attack_ratio: number;
  sources: string[];
}

export interface ProcessedFile {
  id: number;
  filename: string;
  file_hash: string;
  file_type: string;
  record_count: number;
  status: string;
  error_message?: string;
  processed_at: string;
}

export interface ImportResult {
  status: string;
  message?: string;
  file_id?: number;
  record_count?: number;
  imported?: number;
  failed?: number;
  errors?: string[];
  [key: string]: any;
}

export interface WsEvents {
  connection_change: { connected: boolean };
  packet_processed: Packet;
  threat_detected: ThreatEvent;
  key_status_changed: KeyMetadata;
  system_status_changed: {
    stream_status?: 'ACTIVE' | 'PAUSED' | 'STOPPED';
    demo_state?: 'STOPPED' | 'RUNNING' | 'PAUSED';
    [key: string]: any;
  };
  security_log_added: SecurityLog;
  file_processed: { filename?: string; file_id?: number; record_count?: number };
  data_archived: { count?: number; batch_id?: string };
  data_restored: { packet_id?: string };
  [key: string]: any;
}
