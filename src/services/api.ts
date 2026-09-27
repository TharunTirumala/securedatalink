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
      const res = await fetch(`${API_BASE}/dashboard/stats`);
      if (res.ok) return await res.json();
    } catch (e) {
      // Fallback for Vercel/cloud demo mode when standalone
    }
    return INITIAL_STATS;
  },

  async getPipeline(): Promise<{ stages: PipelineStage[] }> {
    try {
      const res = await fetch(`${API_BASE}/dashboard/pipeline`);
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

      const res = await fetch(`${API_BASE}/telemetry/packets?${query.toString()}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  async getPacketDetails(packetId: string): Promise<Packet | null> {
    try {
      const res = await fetch(`${API_BASE}/telemetry/packets/${encodeURIComponent(packetId)}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  async ingestPacket(rawPacket: any): Promise<any> {
    const res = await fetch(`${API_BASE}/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawPacket)
    });
    if (!res.ok) {
      let errMsg = `Ingestion failed (HTTP ${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.detail) {
          errMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch (_) {}
      throw new Error(errMsg);
    }
    return await res.json();
  },

  async importTelemetryFile(file: File, operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/telemetry/import?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      let errMsg = `File import failed (HTTP ${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.detail) {
          errMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch (_) {}
      throw new Error(errMsg);
    }
    return await res.json();
  },

  async importTelemetryData(data: any, operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/telemetry/import?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      let errMsg = `Data import failed (HTTP ${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.detail) {
          errMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch (_) {}
      throw new Error(errMsg);
    }
    return await res.json();
  },

  async getC2Stream(): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/telemetry/c2-stream`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return { status: 'STANDBY', forwarded_count: 0, recent_packets: [] };
  },

  // Threat Detection
  async getThreats(params: { limit?: number; severity?: string; action?: string } = {}): Promise<ThreatEvent[]> {
    try {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.severity) query.set('severity', params.severity);
      if (params.action) query.set('action', params.action);

      const res = await fetch(`${API_BASE}/threats?${query.toString()}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  // Key Management
  async getActiveKey(): Promise<KeyMetadata> {
    try {
      const res = await fetch(`${API_BASE}/keys/active`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return INITIAL_KEY;
  },

  async resyncKey(operatorId: string = 'OPERATOR-PRIMARY'): Promise<KeyMetadata> {
    const res = await fetch(`${API_BASE}/keys/resync?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST'
    });
    if (!res.ok) {
      throw new Error(`Key resynchronization failed (HTTP ${res.status})`);
    }
    return await res.json();
  },

  // Operator Controls
  async getOperatorStatus(): Promise<{ freshness_window: number; stream_status: string; demo_state?: string; authorized_operators: string[]; cache_entries?: number }> {
    try {
      const res = await fetch(`${API_BASE}/operator/status`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return { freshness_window: 5.0, stream_status: 'STOPPED', demo_state: 'STOPPED', authorized_operators: ['OPERATOR-PRIMARY'], cache_entries: 0 };
  },

  async startDemo(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/operator/start?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST'
    });
    if (!res.ok) {
      throw new Error(`Start demo command rejected (HTTP ${res.status})`);
    }
    return await res.json();
  },

  async stopDemo(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/operator/stop?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST'
    });
    if (!res.ok) {
      throw new Error(`Stop demo command rejected (HTTP ${res.status})`);
    }
    return await res.json();
  },

  async pauseStream(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/operator/pause?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST'
    });
    if (!res.ok) {
      throw new Error(`Stream pause command rejected (HTTP ${res.status})`);
    }
    return await res.json();
  },

  async resumeStream(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/operator/resume?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST'
    });
    if (!res.ok) {
      throw new Error(`Stream resume command rejected (HTTP ${res.status})`);
    }
    return await res.json();
  },

  async getSimulatorConfig(): Promise<SimulatorConfig> {
    try {
      const res = await fetch(`${API_BASE}/operator/simulator`);
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
      const res = await fetch(`${API_BASE}/operator/simulator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { status: 'UPDATED', config };
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

      const res = await fetch(`${API_BASE}/archive/logs?${query.toString()}`);
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return await res.json();
      }
    } catch (e) {}
    return [];
  },

  getLogExportUrl(format: 'csv' | 'json'): string {
    return `${API_BASE}/archive/logs/export?format=${format}`;
  },

  async getProcessedFiles(): Promise<ProcessedFile[]> {
    try {
      const res = await fetch(`${API_BASE}/archive/files`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  async archivePackets(params: { packet_ids?: string[]; archive_all_active?: boolean; operator_id?: string; reason?: string } = {}): Promise<any> {
    const res = await fetch(`${API_BASE}/archive/packets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packet_ids: params.packet_ids,
        archive_all_active: params.archive_all_active ?? false,
        operator_id: params.operator_id ?? 'OPERATOR-PRIMARY',
        reason: params.reason ?? 'Tactical telemetry archival'
      })
    });
    if (!res.ok) {
      let msg = `Failed to archive data (HTTP ${res.status})`;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const err = await res.json();
          if (err.detail) msg = err.detail;
        }
      } catch {}
      throw new Error(msg);
    }
    return await res.json();
  },

  async getArchivedPackets(params: { limit?: number; offset?: number; search?: string; source?: string } = {}): Promise<Packet[]> {
    try {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.offset) query.set('offset', params.offset.toString());
      if (params.source) query.set('source', params.source);
      if (params.search) query.set('search', params.search);

      const res = await fetch(`${API_BASE}/archive/packets?${query.toString()}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  async restorePacket(packetId: string, operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/archive/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packet_id: packetId,
        operator_id: operatorId
      })
    });
    if (!res.ok) {
      let msg = `Failed to restore packet (HTTP ${res.status})`;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const err = await res.json();
          if (err.detail) msg = err.detail;
        }
      } catch {}
      throw new Error(msg);
    }
    return await res.json();
  },

  async getArchiveStats(): Promise<{ active_packets: number; archived_packets: number; total_files: number; last_archived_at: string | null }> {
    try {
      const res = await fetch(`${API_BASE}/archive/stats`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return { active_packets: 0, archived_packets: 0, total_files: 0, last_archived_at: null };
  },

  async uploadTelemetryFile(file: File, operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/archive/files/upload?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      let msg = `File ingestion failed (HTTP ${res.status})`;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const err = await res.json();
          if (err.detail) msg = err.detail;
        }
      } catch {}
      throw new Error(msg);
    }
    return await res.json();
  },

  async ingestSampleFile(sampleType: 'authentic' | 'tampered', operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/archive/files/sample?sample_type=${sampleType}&operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST'
    });
    if (!res.ok) {
      let msg = `Sample file ingestion failed (HTTP ${res.status})`;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const err = await res.json();
          if (err.detail) msg = err.detail;
        }
      } catch {}
      throw new Error(msg);
    }
    return await res.json();
  },

  async verifyAndArchiveTelemetry(rawPacket: any, operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const res = await fetch(`${API_BASE}/archive/verify-and-archive?operator_id=${encodeURIComponent(operatorId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawPacket)
    });
    if (!res.ok) {
      let msg = `Telemetry verification rejected (HTTP ${res.status})`;
      try {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const err = await res.json();
          if (err.detail) msg = err.detail;
        }
      } catch {}
      throw new Error(msg);
    }
    return await res.json();
  }
};
