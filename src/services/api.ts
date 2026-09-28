import {
  DashboardStats,
  PipelineStage,
  Packet,
  ArchivedPacket,
  ThreatEvent,
  SecurityLog,
  KeyMetadata,
  SimulatorConfig,
  ProcessedFile,
  ImportResult
} from '../types/telemetry';

export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const OPERATOR_TOKEN = 'TAC-OP-TOKEN-9871';

function qs(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      search.set(key, String(val));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Operator-Token', OPERATOR_TOKEN);

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let detail = `Request failed (HTTP ${res.status})`;
    let errData: any = null;
    try {
      errData = await res.json();
      if (errData && errData.detail) {
        detail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // Non-JSON response
    }
    throw new ApiError(detail, res.status, errData);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return await res.json();
  }
  return null as unknown as T;
}

export const api = {
  // Dashboard & Pipeline
  async getStats(): Promise<DashboardStats> {
    return request<DashboardStats>('/dashboard/stats');
  },

  async getPipeline(): Promise<{ stages: PipelineStage[] }> {
    return request<{ stages: PipelineStage[] }>('/dashboard/pipeline');
  },

  // Telemetry
  async getPackets(params: { limit?: number; offset?: number; source?: string; classification?: string; action?: string } = {}): Promise<Packet[]> {
    return request<Packet[]>(`/telemetry/packets${qs(params)}`);
  },

  async importTelemetryFile(file: File, operatorId: string = 'OPERATOR-PRIMARY'): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return request<ImportResult>(`/telemetry/import${qs({ operator_id: operatorId })}`, {
      method: 'POST',
      body: formData,
    });
  },

  async importTelemetryData(data: any, operatorId: string = 'OPERATOR-PRIMARY'): Promise<ImportResult> {
    return request<ImportResult>(`/telemetry/import${qs({ operator_id: operatorId })}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getC2Stream(): Promise<any> {
    return request<any>('/telemetry/c2-stream');
  },

  // Threat Detection
  async getThreats(params: { limit?: number; severity?: string; action?: string } = {}): Promise<ThreatEvent[]> {
    return request<ThreatEvent[]>(`/threats${qs(params)}`);
  },

  // Key Management
  async getActiveKey(): Promise<KeyMetadata> {
    return request<KeyMetadata>('/keys/active');
  },

  async resyncKey(operatorId: string = 'OPERATOR-PRIMARY'): Promise<KeyMetadata> {
    return request<KeyMetadata>(`/keys/resync${qs({ operator_id: operatorId })}`, {
      method: 'POST',
    });
  },

  // Operator Controls
  async getOperatorStatus(): Promise<{
    freshness_window: number;
    stream_status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
    demo_state?: string;
    authorized_operators: string[];
    cache_entries?: number;
  }> {
    return request('/operator/status');
  },

  async startDemo(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    return request(`/operator/start${qs({ operator_id: operatorId })}`, {
      method: 'POST',
    });
  },

  async stopDemo(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    return request(`/operator/stop${qs({ operator_id: operatorId })}`, {
      method: 'POST',
    });
  },

  async pauseStream(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    return request(`/operator/pause${qs({ operator_id: operatorId })}`, {
      method: 'POST',
    });
  },

  async resumeStream(operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    return request(`/operator/resume${qs({ operator_id: operatorId })}`, {
      method: 'POST',
    });
  },

  async getSimulatorConfig(): Promise<SimulatorConfig> {
    return request<SimulatorConfig>('/operator/simulator');
  },

  async setSimulatorConfig(config: SimulatorConfig): Promise<any> {
    return request('/operator/simulator', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  // Archive & Audit
  async getSecurityLogs(params: { limit?: number; offset?: number; severity?: string; source?: string; search?: string } = {}): Promise<SecurityLog[]> {
    return request<SecurityLog[]>(`/archive/logs${qs(params)}`);
  },

  getLogExportUrl(format: 'csv' | 'json'): string {
    return `${API_BASE}/archive/logs/export?format=${format}`;
  },

  async getProcessedFiles(): Promise<ProcessedFile[]> {
    return request<ProcessedFile[]>('/archive/files');
  },

  async archivePackets(params: { packet_ids?: string[]; archive_all_active?: boolean; operator_id?: string; reason?: string } = {}): Promise<any> {
    return request('/archive/packets', {
      method: 'POST',
      body: JSON.stringify({
        packet_ids: params.packet_ids,
        archive_all_active: params.archive_all_active ?? false,
        operator_id: params.operator_id ?? 'OPERATOR-PRIMARY',
        reason: params.reason ?? 'Tactical telemetry archival',
      }),
    });
  },

  async getArchivedPackets(params: { limit?: number; offset?: number; search?: string; source?: string } = {}): Promise<ArchivedPacket[]> {
    return request<ArchivedPacket[]>(`/archive/packets${qs(params)}`);
  },

  getArchivedPacketsExportUrl(format: 'csv' | 'json'): string {
    return `${API_BASE}/archive/packets/export?format=${format}`;
  },

  async restorePacket(packetId: string, operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    return request('/archive/restore', {
      method: 'POST',
      body: JSON.stringify({
        packet_id: packetId,
        operator_id: operatorId,
      }),
    });
  },

  async getArchiveStats(): Promise<{ active_packets: number; archived_packets: number; total_files: number; last_archived_at: string | null }> {
    return request('/archive/stats');
  },

  async uploadTelemetryFile(file: File, operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/archive/files/upload${qs({ operator_id: operatorId })}`, {
      method: 'POST',
      body: formData,
    });
  },

  async ingestSampleFile(sampleType: 'authentic' | 'tampered', operatorId: string = 'OPERATOR-PRIMARY'): Promise<any> {
    return request(`/archive/files/sample${qs({ sample_type: sampleType, operator_id: operatorId })}`, {
      method: 'POST',
    });
  },
};
