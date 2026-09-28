import { Packet, WsEvents } from '../types/telemetry';

type EventCallback = (data: any) => void;

const getWsUrl = () => {
  let base: string;
  if (import.meta.env.VITE_WS_URL) {
    base = import.meta.env.VITE_WS_URL;
  } else if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running on standard dev port with Vite proxy, use relative ws path
    base = `${proto}//${window.location.host}/ws`;
  } else {
    base = 'ws://localhost:8000/ws';
  }
  const token = 'TAC-OP-TOKEN-9871';
  const delimiter = base.includes('?') ? '&' : '?';
  return `${base}${delimiter}token=${encodeURIComponent(token)}`;
};

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = getWsUrl();
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnecting: boolean = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts: number = 0;
  private lastMessageTime: number = 0;
  private isPaused: boolean = typeof window !== 'undefined' && localStorage.getItem('securelink_stream_paused') === 'true';
  private packetBuffer: Packet[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  public isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  public get paused(): boolean {
    return this.isPaused;
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('securelink_stream_paused', paused ? 'true' : 'false');
      } catch {}
    }
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.isConnecting || (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING))) {
      return;
    }

    this.isConnecting = true;
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastMessageTime = Date.now();
        console.log('[SecureLink WS] Connected to live tactical event stream');
        this.emit('connection_change', { connected: true });

        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

          // Check if connection has been silent for > 30 seconds (half-open socket)
          if (Date.now() - this.lastMessageTime > 30000) {
            console.warn('[SecureLink WS] Socket silent for > 30s. Terminating half-open connection.');
            try {
              this.ws.close();
            } catch {}
            return;
          }

          this.ws.send('ping');
        }, 15000);
      };

      this.ws.onmessage = (event) => {
        this.lastMessageTime = Date.now();
        if (event.data === 'pong') return;

        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event && parsed.data !== undefined) {
            if (parsed.event === 'system_status_changed' && parsed.data?.stream_status) {
              this.isPaused = (parsed.data.stream_status === 'PAUSED');
            }

            if (parsed.event === 'packet_processed') {
              this.queuePacket(parsed.data as Packet);
            } else {
              this.emit(parsed.event, parsed.data);
            }
          }
        } catch {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.isConnecting = false;
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
        this.emit('connection_change', { connected: false });
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        if (this.ws) {
          try {
            this.ws.close();
          } catch {}
        }
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private queuePacket(packet: Packet) {
    this.packetBuffer.push(packet);
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        const packets = this.packetBuffer.splice(0);
        for (const pkt of packets) {
          this.emit('packet_processed', pkt);
        }
      }, 50);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;

    // Exponential backoff: 1s, 2s, 4s, 8s, up to 30s with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }

  public on<K extends keyof WsEvents>(event: K, callback: (data: WsEvents[K]) => void): () => void;
  public on(event: string, callback: EventCallback): () => void;
  public on(event: string, callback: EventCallback): () => void {
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
          console.error(`Error in WebSocket listener for ${event}:`, e);
        }
      });
    }
  }
}

export const wsClient = new WebSocketClient();

// Vite HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    wsClient.disconnect();
  });
}
