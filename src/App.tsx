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

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [wsConnected, setWsConnected] = useState(wsClient.isConnected);
  
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
          // Merge authoritative backend packets with any live WebSocket packets
          const map = new Map<string, Packet>();
          packetsData.forEach((p) => map.set(p.packet_id, p));
          prev.forEach((p) => {
            if (!map.has(p.packet_id)) {
              map.set(p.packet_id, p);
            }
          });
          const merged = Array.from(map.values()).sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return timeB - timeA;
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
      console.error('Error hydrating application data:', e);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Periodic polling synchronization to ensure real-time consistency
  useEffect(() => {
    const interval = setInterval(() => {
      if (!wsConnected || stats?.demo_state === 'RUNNING') {
        loadInitialData();
      }
    }, wsConnected ? 4000 : 2500);

    return () => clearInterval(interval);
  }, [wsConnected, stats?.demo_state, loadInitialData]);

  // WebSocket Subscription for Real-Time Event Dispatching
  useEffect(() => {
    const unsubConn = wsClient.on('connection_change', (data) => {
      setWsConnected(data.connected);
      if (data.connected) {
        loadInitialData();
      }
    });

    const unsubPacket = wsClient.on('packet_processed', (newPacket: Packet) => {
      setPackets((prev) => {
        if (prev.some(p => p.packet_id === newPacket.packet_id)) {
          return prev.map(p => p.packet_id === newPacket.packet_id ? newPacket : p);
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
        setStats((prev) => prev ? { ...prev, stream_status: statusData.stream_status } : prev);
      }
      if (statusData.simulator_active !== undefined) {
        setStats((prev) => prev ? { ...prev, simulator_active: statusData.simulator_active } : prev);
      }
      if (statusData.demo_state) {
        setStats((prev) => prev ? { ...prev, demo_state: statusData.demo_state } : prev);
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

  return (
    <div className="flex w-full h-full min-h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <LeftSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        threatCount={threats.length}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 w-full h-full overflow-hidden">
        {/* Top Header */}
        <TopNav
          wsConnected={wsConnected}
          systemStatus={stats?.system_security_status || 'ONLINE'}
          activeKeyId={keyMetadata?.key_id || 'SK-ALPHA-042'}
          streamStatus={stats?.stream_status || 'ACTIVE'}
        />

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
              onNavigate={setActiveTab}
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
