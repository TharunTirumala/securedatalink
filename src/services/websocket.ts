import { Packet, ThreatEvent } from '../types/telemetry';

type EventCallback = (data: any) => void;

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && window.location.hostname !== 'localhost') {
    return 'wss://' + window.location.host + '/ws';
  }
  return 'ws://localhost:8000/ws';
};

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = getWsUrl();
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnecting: boolean = false;
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private simulationInterval: any = null;
  private failCount: number = 0;
  private isPaused: boolean = false;
  public isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // In pure HTTPS environments without backend, gracefully start internal simulation
    if (window.location.protocol === 'https:' && !import.meta.env.VITE_WS_URL) {
      this.startInternalSimulation();
      return;
    }

    this.isConnecting = true;
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.failCount = 0;
        this.stopInternalSimulation();
        console.log('[SecureLink WS] Connected to live tactical event stream');
        this.emit('connection_change', { connected: true });

        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send('ping');
          }
        }, 15000);
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event && parsed.data) {
            if (parsed.event === 'system_status_changed' && parsed.data.stream_status) {
              this.isPaused = (parsed.data.stream_status === 'PAUSED');
            }
            this.emit(parsed.event, parsed.data);
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.isConnecting = false;
        clearInterval(this.pingInterval);
        this.emit('connection_change', { connected: false });
        this.failCount++;
        if (this.failCount >= 2) {
          // Fallback to internal simulation on cloud demo
          this.startInternalSimulation();
        } else {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        if (this.ws) {
          try { this.ws.close(); } catch (e) {}
        }
      };
    } catch (e) {
      this.isConnecting = false;
      this.startInternalSimulation();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.connect();
      }, 4000);
    }
  }

  private startInternalSimulation() {
    if (this.simulationInterval) return;
    this.isConnected = true;
    this.emit('connection_change', { connected: true });

    let seq = 2000;
    const sources = ['UAV-ALPHA-01', 'UAV-BRAVO-02', 'UGV-SIERRA-03', 'BASE-RELAY-04'];
    
    this.simulationInterval = setInterval(() => {
      if (this.isPaused) return;
      seq++;
      const source = sources[Math.floor(Math.random() * sources.length)];
      const isTampered = Math.random() < 0.15;
      const isReplay = !isTampered && Math.random() < 0.10;
      const isOk = !isTampered && !isReplay;

      const action = isOk ? 'ACCEPTED' : 'BLOCKED';
      const classification = isTampered ? 'TAMPERED' : (isReplay ? 'REPLAYED' : 'AUTHENTIC');
      const trustScore = isOk ? 95 + Math.random() * 5 : (isTampered ? 12 + Math.random() * 8 : 40 + Math.random() * 5);

      const packet: Packet = {
        packet_id: 'PKT-' + source.split('-')[1] + '-' + (Math.floor(10000 + Math.random() * 90000)),
        sequence_num: seq,
        source: source,
        timestamp: Date.now() / 1000,
        packet_type: 'TELEMETRY_POSITION',
        key_id: 'KEY-TACTICAL-2026-NIST-P256',
        auth_status: isTampered ? 'FAILED' : 'VERIFIED',
        freshness_status: isReplay ? 'FAIL' : 'PASS',
        sig_status: isTampered ? 'INVALID' : 'VERIFIED',
        integrity_status: isTampered ? 'FAIL' : 'PASS',
        classification: classification,
        trust_score: Math.round(trustScore * 10) / 10,
        action: action,
        latency_ms: Math.round(15 + Math.random() * 20),
        decrypted_payload: isOk ? {
          latitude: 34.0522 + (Math.random() - 0.5) * 0.05,
          longitude: -118.2437 + (Math.random() - 0.5) * 0.05,
          altitude_m: Math.round(1400 + Math.random() * 300),
          speed_mps: Math.round(40 + Math.random() * 15),
          heading_deg: Math.round(Math.random() * 360),
          battery_pct: Math.round(85 + Math.random() * 14),
          flight_mode: 'AUTONOMOUS_PATROL',
          link_quality: 98
        } : undefined,
        simulated: true,
        created_at: new Date().toISOString()
      };

      this.emit('packet_processed', packet);

      if (!isOk) {
        const threat: ThreatEvent = {
          timestamp: new Date().toISOString(),
          packet_id: packet.packet_id,
          source: source,
          event: isTampered ? 'CRYPTOGRAPHIC_SIGNATURE_TAMPER_DETECTED' : 'REPLAY_ATTACK_DETECTED',
          severity: isTampered ? 'CRITICAL' : 'HIGH',
          action: 'BLOCKED',
          details: {
            reason: isTampered ? 'Invalid ECDSA signature' : 'Stale timestamp delta exceeded freshness threshold'
          }
        };
        this.emit('threat_detected', threat);
      }
    }, 2500);
  }

  private stopInternalSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  public on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off(event: string, callback: EventCallback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  public emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('Error in WebSocket listener for ' + event + ':', e);
        }
      });
    }
  }
}

export const wsClient = new WebSocketClient();
