import {
  DashboardStats,
  PipelineStage,
  Packet,
  ThreatEvent,
  SecurityLog,
  KeyMetadata,
  SimulatorConfig,
  ProcessedFile
} from '../types/telemetry';

const API_BASE = 'http://localhost:8000/api/v1';

export const api = {
  // Dashboard & Pipeline
  async getStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  async getPipeline(): Promise<{ stages: PipelineStage[] }> {
    const res = await fetch(`${API_BASE}/dashboard/pipeline`);
    if (!res.ok) throw new Error('Failed to fetch pipeline stages');
    return res.json();
  },

  // Telemetry
  async getPackets(params: { limit?: number; offset?: number; source?: string; classification?: string; action?: string } = {}): Promise<Packet[]> {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());
    if (params.source) query.set('source', params.source);
    if (params.classification) query.set('classification', params.classification);
    if (params.action) query.set('action', params.action);

    const res = await fetch(`${API_BASE}/telemetry/packets?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch telemetry packets');
    return res.json();
  },

  async getPacketDetails(packetId: string): Promise<Packet> {
    const res = await fetch(`${API_BASE}/telemetry/packets/${encodeURIComponent(packetId)}`);
    if (!res.ok) throw new Error(`Failed to fetch packet ${packetId}`);
    return res.json();
  },

  async ingestPacket(rawPacket: any): Promise<any> {
    const res = await fetch(`${API_BASE}/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawPacket)
    });
    if (!res.ok) throw new Error('Failed to ingest telemetry packet');
    return res.json();
  },

  async getC2Stream(): Promise<any> {
    const res = await fetch(`${API_BASE}/telemetry/c2-stream`);
    if (!res.ok) throw new Error('Failed to fetch C2 stream');
    return res.json();
  },

  // Threat Detection
  async getThreats(params: { limit?: number; severity?: string; action?: string } = {}): Promise<ThreatEvent[]> {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.severity) query.set('severity', params.severity);
    if (params.action) query.set('action', params.action);

    const res = await fetch(`${API_BASE}/threats?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch threat events');
    return res.json();
  },

  // Key Management
  async getActiveKey(): Promise<KeyMetadata> {
    const res = await fetch(`${API_BASE}/keys/active`);
    if (!res.ok) throw new Error('Failed to fetch active key metadata');
    return res.json();
  },

  async resyncKey(operatorId: string = 'OPERATOR-PRIMARY'): Promise<KeyMetadata> {
    const res = await fetch(`${API_BASE}/keys/resync?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to re-sync cryptographic key');
    return res.json();
  },

  // Operator Controls
  async pauseStream(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/operator/pause?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to pause stream');
    return res.json();
  },

  async resumeStream(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/operator/resume?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to resume stream');
    return res.json();
  },

  async applyOverride(freshnessWindow: number, operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/operator/override?freshness_window=${freshnessWindow}&operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to apply security override');
    return res.json();
  },

  async getSimulatorConfig(): Promise<SimulatorConfig> {
    const res = await fetch(`${API_BASE}/operator/simulator`);
    if (!res.ok) throw new Error('Failed to fetch simulator configuration');
    return res.json();
  },

  async setSimulatorConfig(config: SimulatorConfig): Promise<any> {
    const res = await fetch(`${API_BASE}/operator/simulator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to update simulator configuration');
    return res.json();
  },

  async getOperatorActions(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/operator/actions`);
    if (!res.ok) throw new Error('Failed to fetch operator actions');
    return res.json();
  },

  // Archive & Audit
  async getSecurityLogs(params: { limit?: number; offset?: number; severity?: string; source?: string; search?: string } = {}): Promise<SecurityLog[]> {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());
    if (params.severity) query.set('severity', params.severity);
    if (params.source) query.set('source', params.source);
    if (params.search) query.set('search', params.search);

    const res = await fetch(`${API_BASE}/archive/logs?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch security logs');
    return res.json();
  },

  getLogExportUrl(format: 'csv' | 'json'): string {
    return `${API_BASE}/archive/logs/export?format=${format}`;
  },

  async getProcessedFiles(): Promise<ProcessedFile[]> {
    const res = await fetch(`${API_BASE}/archive/files`);
    if (!res.ok) throw new Error('Failed to fetch processed files history');
    return res.json();
  }
};
