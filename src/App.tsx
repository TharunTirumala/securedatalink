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
import { OperatorOverridePage } from './pages/OperatorOverridePage';
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
        api.getStats().catch(() => null),
        api.getPipeline().catch(() => ({ stages: [] })),
        api.getPackets({ limit: 50 }).catch(() => []),
        api.getThreats({ limit: 30 }).catch(() => []),
        api.getActiveKey().catch(() => null),
      ]);

      if (statsData) {
        setStats(statsData);
        if (statsData.stream_status) {
          wsClient.setPaused(statsData.stream_status === 'PAUSED');
        }
      }
      if (pipelineData) setPipelineStages(pipelineData.stages);
      if (packetsData) setPackets(packetsData);
      if (threatsData) setThreats(threatsData);
      if (keyData) setKeyMetadata(keyData);
    } catch (e) {
      console.error('Error hydrating application data:', e);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // WebSocket Subscription for Real-Time Event Dispatching
  useEffect(() => {
    const unsubConn = wsClient.on('connection_change', (data) => {
      setWsConnected(data.connected);
      if (data.connected) {
        // Re-sync on reconnect
        loadInitialData();
      }
    });

    const unsubPacket = wsClient.on('packet_processed', (newPacket: Packet) => {
      setPackets((prev) => [newPacket, ...prev.slice(0, 199)]);
      // Update quick counters
      setStats((prev) => {
        if (!prev) return prev;
        const isAuth = newPacket.action === 'ACCEPTED';
        const isDrop = newPacket.action === 'BLOCKED' || newPacket.action === 'REJECTED';
        return {
          ...prev,
          authenticated_packets: prev.authenticated_packets + (isAuth ? 1 : 0),
          replay_filtered: prev.replay_filtered + (isDrop ? 1 : 0),
          adaptive_filter: {
            ...prev.adaptive_filter,
            evaluated: prev.adaptive_filter.evaluated + 1,
            accepted: prev.adaptive_filter.accepted + (isAuth ? 1 : 0),
            blocked: prev.adaptive_filter.blocked + (newPacket.action === 'BLOCKED' ? 1 : 0),
            replay: prev.adaptive_filter.replay + (newPacket.classification === 'REPLAYED' ? 1 : 0),
            tampered: prev.adaptive_filter.tampered + (newPacket.classification === 'TAMPERED' ? 1 : 0),
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
    });

    const unsubFile = wsClient.on('file_processed', () => {
      loadInitialData();
    });

    return () => {
      unsubConn();
      unsubPacket();
      unsubThreat();
      unsubKey();
      unsubStatus();
      unsubFile();
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
            <LiveTelemetryPage packets={packets} />
          )}

          {activeTab === 'verification' && (
            <PacketVerificationPage packets={packets} />
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

          {activeTab === 'override' && (
            <OperatorOverridePage />
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
