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
import {
  INITIAL_STATS,
  INITIAL_STAGES,
  INITIAL_PACKETS,
  INITIAL_THREATS,
  INITIAL_KEY,
  INITIAL_LOGS
} from './mockData';

const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '/api/v1';
  }
  return 'http://localhost:8000/api/v1';
};

const API_BASE = getApiBase();

export const api = {
  // Dashboard & Pipeline
  async getStats(): Promise<DashboardStats> {
    try {
      const res = await fetch(${API_BASE}/dashboard/stats);
      if (res.ok) return await res.json();
    } catch (e) {
      // Fallback for Vercel/cloud demo mode when standalone
    }
    return INITIAL_STATS;
  },

  async getPipeline(): Promise<{ stages: PipelineStage[] }> {
    try {
      const res = await fetch(${API_BASE}/dashboard/pipeline);
      if (res.ok) return await res.json();
    } catch (e) {}
    return { stages: INITIAL_STAGES };
  },

  // Telemetry
  async getPackets(params: { limit?: number; offset?: number; source?: string; classification?: string; action?: string } = {}): Promise<Packet[]> {
    try {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.offset) query.set('offset', params.offset.toString());
      if (params.source) query.set('source', params.source);
      if (params.classification) query.set('classification', params.classification);
      if (params.action) query.set('action', params.action);

      const res = await fetch(${API_BASE}/telemetry/packets?);
      if (res.ok) return await res.json();
    } catch (e) {}
    return INITIAL_PACKETS;
  },

  async getPacketDetails(packetId: string): Promise<Packet> {
    try {
      const res = await fetch(${API_BASE}/telemetry/packets/);
      if (res.ok) return await res.json();
    } catch (e) {}
    const found = INITIAL_PACKETS.find(p => p.packet_id === packetId);
    return found || INITIAL_PACKETS[0];
  },

  async ingestPacket(rawPacket: any): Promise<any> {
    try {
      const res = await fetch(${API_BASE}/telemetry/ingest, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawPacket)
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { status: 'ACCEPTED', packet_id: 'PKT-CLIENT-SIM-' + Date.now().toString().slice(-5) };
  },

  async getC2Stream(): Promise<any> {
    try {
      const res = await fetch(${API_BASE}/telemetry/c2-stream);
      if (res.ok) return await res.json();
    } catch (e) {}
    return { stream: INITIAL_PACKETS.filter(p => p.action === 'ACCEPTED') };
  },

  // Threat Detection
  async getThreats(params: { limit?: number; severity?: string; action?: string } = {}): Promise<ThreatEvent[]> {
    try {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.severity) query.set('severity', params.severity);
      if (params.action) query.set('action', params.action);

      const res = await fetch(${API_BASE}/threats?);
      if (res.ok) return await res.json();
    } catch (e) {}
    return INITIAL_THREATS;
  },

  // Key Management
  async getActiveKey(): Promise<KeyMetadata> {
    try {
      const res = await fetch(${API_BASE}/keys/active);
      if (res.ok) return await res.json();
    } catch (e) {}
    return INITIAL_KEY;
  },

  async resyncKey(operatorId: string = 'OPERATOR-PRIMARY'): Promise<KeyMetadata> {
    try {
      const res = await fetch(${API_BASE}/keys/resync?operator_id=, {
        method: 'POST'
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { ...INITIAL_KEY, key_id: 'KEY-TACTICAL-' + Date.now().toString().slice(-4) };
  },

  // Operator Controls
  async pauseStream(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    try {
      const res = await fetch(${API_BASE}/operator/pause?operator_id=, {
        method: 'POST'
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { status: 'PAUSED', operator_id: operatorId };
  },

  async resumeStream(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    try {
      const res = await fetch(${API_BASE}/operator/resume?operator_id=, {
        method: 'POST'
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { status: 'ACTIVE', operator_id: operatorId };
  },

  async applyOverride(freshnessWindow: number, operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    try {
      const res = await fetch(${API_BASE}/operator/override?freshness_window=&operator_id=, {
        method: 'POST'
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { status: 'OVERRIDE_APPLIED', freshness_window: freshnessWindow };
  },

  async getSimulatorConfig(): Promise<SimulatorConfig> {
    try {
      const res = await fetch(${API_BASE}/operator/simulator);
      if (res.ok) return await res.json();
    } catch (e) {}
    return {
      enabled: true,
      rate_hz: 1.0,
      attack_ratio: 0.25,
      sources: ['UAV-ALPHA-01', 'UAV-BRAVO-02', 'UGV-SIERRA-03', 'BASE-RELAY-04']
    };
  },

  async setSimulatorConfig(config: SimulatorConfig): Promise<any> {
    try {
      const res = await fetch(${API_BASE}/operator/simulator, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { status: 'UPDATED', config };
  },

  async getOperatorActions(): Promise<any[]> {
    try {
      const res = await fetch(${API_BASE}/operator/actions);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [
      { id: 1, action: 'KEY_ROTATION', operator: 'OPERATOR-PRIMARY', timestamp: new Date().toISOString() }
    ];
  },

  // Archive & Audit
  async getSecurityLogs(params: { limit?: number; offset?: number; severity?: string; source?: string; search?: string } = {}): Promise<SecurityLog[]> {
    try {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.offset) query.set('offset', params.offset.toString());
      if (params.severity) query.set('severity', params.severity);
      if (params.source) query.set('source', params.source);
      if (params.search) query.set('search', params.search);

      const res = await fetch(${API_BASE}/archive/logs?);
      if (res.ok) return await res.json();
    } catch (e) {}
    return INITIAL_LOGS;
  },

  getLogExportUrl(format: 'csv' | 'json'): string {
    return ${API_BASE}/archive/logs/export?format=;
  },

  async getProcessedFiles(): Promise<ProcessedFile[]> {
    try {
      const res = await fetch(${API_BASE}/archive/files);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  }
};
