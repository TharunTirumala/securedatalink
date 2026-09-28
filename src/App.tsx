import React, { useState, useEffect, useCallback } from 'react';
import {
  DashboardStats,
  PipelineStage,
  Packet,
  ThreatEvent,
  KeyMetadata
} from './types/telemetry';
import { api } from './services/api';
import { wsClient } from './services/websocket';
import { TopNav } from './components/layout/TopNav';
import { LeftSidebar } from './components/layout/LeftSidebar';

import { DashboardPage } from './pages/DashboardPage';
import { LiveTelemetryPage } from './pages/LiveTelemetryPage';
import { PacketVerificationPage } from './pages/PacketVerificationPage';
import { ThreatDetectionPage } from './pages/ThreatDetectionPage';
import { SecurityLogsPage } from './pages/SecurityLogsPage';
import { KeyManagementPage } from './pages/KeyManagementPage';
import { DataArchivePage } from './pages/DataArchivePage';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'online' | 'offline'>('connecting');
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [keyMetadata, setKeyMetadata] = useState<KeyMetadata | null>(null);

  // Initial Data Hydration
  const loadInitialData = useCallback(async () => {
    try {
      const [statsData, pipelineData, packetsData, threatsData, keyData] = await Promise.all([
        api.getStats(),
        api.getPipeline(),
        api.getPackets({ limit: 100 }),
        api.getThreats({ limit: 50 }),
        api.getActiveKey(),
      ]);

      setConnectionState('online');

      if (statsData) {
        setStats(statsData);
        if (statsData.stream_status) {
          wsClient.setPaused(statsData.stream_status === 'PAUSED');
        }
      }
      if (pipelineData && pipelineData.stages) {
        setPipelineStages(pipelineData.stages);
      }
      if (packetsData && Array.isArray(packetsData)) {
        setPackets((prev) => {
          if (packetsData.length === 0 && (!statsData || statsData.total_packets === 0)) {
            return [];
          }
          if (packetsData.length === 0 && prev.length > 0) {
            return prev;
          }
          const map = new Map<string, Packet>();
          prev.forEach((p) => map.set(p.packet_id, p));
          packetsData.forEach((p) => map.set(p.packet_id, p));
          const merged = Array.from(map.values()).sort((a, b) => {
            const idA = a.id ?? 0;
            const idB = b.id ?? 0;
            if (idA !== 0 && idB !== 0 && idA !== idB) {
              return idB - idA;
            }
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            if (timeB !== timeA) {
              return timeB - timeA;
            }
            const seqA = a.sequence_num || 0;
            const seqB = b.sequence_num || 0;
            return seqB - seqA;
          });
          return merged.slice(0, 200);
        });
      }
      if (threatsData && Array.isArray(threatsData)) {
        setThreats(threatsData);
      }
      if (keyData) {
        setKeyMetadata(keyData);
      }
    } catch (e) {
      console.warn('Error hydrating application data from tactical backend:', e);
      if (!wsClient.isConnected) {
        setConnectionState('offline');
      }
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Polling synchronization: fallback when offline, or low-frequency (30s) heartbeat when online
  useEffect(() => {
    if (connectionState === 'offline') {
      const interval = setInterval(() => {
        loadInitialData();
      }, 5000);
      return () => clearInterval(interval);
    }

    const heartbeat = setInterval(() => {
      loadInitialData();
    }, 30000);
    return () => clearInterval(heartbeat);
  }, [connectionState, loadInitialData]);

  // WebSocket Subscription for Real-Time Event Dispatching
  useEffect(() => {
    const unsubConn = wsClient.on('connection_change', (data) => {
      if (data.connected) {
        setConnectionState('online');
        loadInitialData();
      } else {
        setConnectionState('offline');
      }
    });

    const unsubPacket = wsClient.on('packet_processed', (newPacket: Packet) => {
      setPackets((prev) => {
        if (prev.some((p) => p.packet_id === newPacket.packet_id)) {
          return prev.map((p) => (p.packet_id === newPacket.packet_id ? newPacket : p));
        }
        return [newPacket, ...prev.slice(0, 199)];
      });
      // Update stats totals
      setStats((prev) => {
        if (!prev) return prev;
        const isAuth = newPacket.action === 'ACCEPTED';
        const isDrop = newPacket.action === 'BLOCKED' || newPacket.action === 'REJECTED' || newPacket.action === 'FILTERED';
        const prevTotal = prev.total_packets ?? 0;
        return {
          ...prev,
          total_packets: prevTotal + 1,
          authenticated_packets: prev.authenticated_packets + (isAuth ? 1 : 0),
          replay_filtered: prev.replay_filtered + (isDrop ? 1 : 0),
          adaptive_filter: {
            ...prev.adaptive_filter,
            evaluated: (prev.adaptive_filter?.evaluated ?? 0) + 1,
            accepted: (prev.adaptive_filter?.accepted ?? 0) + (isAuth ? 1 : 0),
            blocked: (prev.adaptive_filter?.blocked ?? 0) + (newPacket.action === 'BLOCKED' ? 1 : 0),
            replay: (prev.adaptive_filter?.replay ?? 0) + (newPacket.classification === 'REPLAYED' ? 1 : 0),
            tampered: (prev.adaptive_filter?.tampered ?? 0) + (newPacket.classification === 'TAMPERED' ? 1 : 0),
          }
        };
      });
    });

    const unsubThreat = wsClient.on('threat_detected', (newThreat: ThreatEvent) => {
      setThreats((prev) => [newThreat, ...prev.slice(0, 99)]);
    });

    const unsubKey = wsClient.on('key_status_changed', (newKey: KeyMetadata) => {
      setKeyMetadata(newKey);
    });

    const unsubStatus = wsClient.on('system_status_changed', (statusData: any) => {
      if (statusData.stream_status) {
        setStats((prev) => (prev ? { ...prev, stream_status: statusData.stream_status } : prev));
      }
      if (statusData.simulator_active !== undefined) {
        setStats((prev) => (prev ? { ...prev, simulator_active: statusData.simulator_active } : prev));
      }
      if (statusData.demo_state) {
        setStats((prev) => (prev ? { ...prev, demo_state: statusData.demo_state } : prev));
      }
    });

    const unsubFile = wsClient.on('file_processed', () => {
      loadInitialData();
    });

    const unsubArchived = wsClient.on('data_archived', () => {
      loadInitialData();
    });

    const unsubRestored = wsClient.on('data_restored', () => {
      loadInitialData();
    });

    return () => {
      unsubConn();
      unsubPacket();
      unsubThreat();
      unsubKey();
      unsubStatus();
      unsubFile();
      unsubArchived();
      unsubRestored();
    };
  }, [loadInitialData]);

  const handleNavigate = (tab: string, packetId?: string) => {
    setActiveTab(tab);
    if (packetId) {
      setSelectedPacketId(packetId);
    }
  };

  const handleManualRetry = () => {
    setConnectionState('connecting');
    wsClient.connect();
    loadInitialData();
  };

  return (
    <div className="flex w-full h-full min-h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <LeftSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        threatCount={threats.length}
        connectionState={connectionState}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 w-full h-full overflow-hidden">
        {/* Top Header */}
        <TopNav
          connectionState={connectionState}
          systemStatus={stats?.system_security_status || (connectionState === 'online' ? 'ONLINE' : 'OFFLINE')}
          activeKeyId={keyMetadata?.key_id || null}
          streamStatus={stats?.stream_status || (connectionState === 'online' ? 'STANDBY' : 'STOPPED')}
        />

        {/* Offline Warning Banner */}
        {connectionState === 'offline' && (
          <div className="bg-rose-600 text-white px-6 py-2.5 flex items-center justify-between text-xs font-semibold shadow-inner">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
              <span>DISCONNECTED FROM TACTICAL LINK SERVER — Live stream unavailable. Attempting reconnection...</span>
            </div>
            <button
              type="button"
              onClick={handleManualRetry}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Now</span>
            </button>
          </div>
        )}

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          {activeTab === 'dashboard' && (
            <DashboardPage
              stats={stats}
              pipelineStages={pipelineStages}
              packets={packets}
              threats={threats}
              keyMetadata={keyMetadata}
              onRefreshData={loadInitialData}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'telemetry' && (
            <LiveTelemetryPage
              packets={packets}
              onRefreshData={loadInitialData}
            />
          )}

          {activeTab === 'verification' && (
            <PacketVerificationPage
              packets={packets}
              onRefreshData={loadInitialData}
              initialPacketId={selectedPacketId}
            />
          )}

          {activeTab === 'threats' && (
            <ThreatDetectionPage threats={threats} />
          )}

          {activeTab === 'logs' && (
            <SecurityLogsPage />
          )}

          {activeTab === 'keys' && (
            <KeyManagementPage
              keyMetadata={keyMetadata}
              onRefreshData={loadInitialData}
            />
          )}

          {activeTab === 'archive' && (
            <DataArchivePage />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
