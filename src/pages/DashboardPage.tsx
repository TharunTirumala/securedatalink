import React, { useState, useEffect } from 'react';
import {
  DashboardStats,
  PipelineStage,
  Packet,
  ThreatEvent,
  KeyMetadata,
  SimulatorConfig
} from '../types/telemetry';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { PipelineVisualizer } from '../components/dashboard/PipelineVisualizer';
import { RealTimeTelemetryFeed } from '../components/dashboard/RealTimeTelemetryFeed';
import { SecurityAlertsPanel } from '../components/dashboard/SecurityAlertsPanel';
import { TrustedC2Panel } from '../components/dashboard/TrustedC2Panel';
import { SimplePacketDetailModal } from '../components/dashboard/SimplePacketDetailModal';
import { CustomTelemetryModal } from '../components/dashboard/CustomTelemetryModal';
import { Play, Pause, Send } from 'lucide-react';

interface DashboardPageProps {
  stats: DashboardStats | null;
  pipelineStages: PipelineStage[];
  packets: Packet[];
  threats: ThreatEvent[];
  keyMetadata: KeyMetadata | null;
  onRefreshData: () => void;
  onNavigate?: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  stats,
  pipelineStages,
  packets,
  threats,
  onRefreshData,
  onNavigate
}) => {
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [isCustomTelemetryOpen, setIsCustomTelemetryOpen] = useState(false);

  // Simulator configuration state
  const [simConfig, setSimConfig] = useState<SimulatorConfig>({
    enabled: false,
    rate_hz: 1.0,
    attack_ratio: 0.25,
    sources: ["UAV-ALPHA-01", "UAV-BRAVO-02", "UGV-SIERRA-03", "BASE-RELAY-04"]
  });

  const [isTogglingAction, setIsTogglingAction] = useState(false);
  const [demoStarted, setDemoStarted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('securelink_demo_started') === 'true';
    }
    return false;
  });

  useEffect(() => {
    api.getSimulatorConfig().then((cfg) => {
      setSimConfig(cfg);
      if (cfg && cfg.enabled) {
        setDemoStarted(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('securelink_demo_started', 'true');
        }
      }
    }).catch(() => {});
  }, []);

  const handleStartDemo = async () => {
    if (isTogglingAction) return;
    setIsTogglingAction(true);
    try {
      wsClient.setPaused(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('securelink_demo_started', 'true');
        localStorage.setItem('securelink_stream_paused', 'false');
      }
      setDemoStarted(true);
      await api.resumeStream();
      const newConfig = { ...simConfig, enabled: true };
      await api.setSimulatorConfig(newConfig);
      setSimConfig(newConfig);
      onRefreshData();
    } catch (e) {
      console.error('Failed to start demo:', e);
    } finally {
      setTimeout(() => setIsTogglingAction(false), 300);
    }
  };

  const handlePause = async () => {
    if (isTogglingAction) return;
    setIsTogglingAction(true);
    try {
      wsClient.setPaused(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('securelink_stream_paused', 'true');
      }
      await api.pauseStream();
      onRefreshData();
    } catch (e) {
      console.error('Failed to pause demo:', e);
    } finally {
      setTimeout(() => setIsTogglingAction(false), 300);
    }
  };

  const handleResume = async () => {
    if (isTogglingAction) return;
    setIsTogglingAction(true);
    try {
      wsClient.setPaused(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('securelink_stream_paused', 'false');
      }
      await api.resumeStream();
      if (!simConfig.enabled) {
        const newConfig = { ...simConfig, enabled: true };
        await api.setSimulatorConfig(newConfig);
        setSimConfig(newConfig);
      }
      onRefreshData();
    } catch (e) {
      console.error('Failed to resume demo:', e);
    } finally {
      setTimeout(() => setIsTogglingAction(false), 300);
    }
  };

  const isStreamPaused = stats?.stream_status
    ? stats.stream_status === 'PAUSED'
    : (typeof window !== 'undefined' && localStorage.getItem('securelink_stream_paused') === 'true');

  const demoState: 'STOPPED' | 'PAUSED' | 'RUNNING' = !demoStarted
    ? 'STOPPED'
    : isStreamPaused
      ? 'PAUSED'
      : 'RUNNING';

  const isTelemetryReceiving = demoState === 'RUNNING';
  const totalProcessed = stats?.adaptive_filter?.evaluated ?? (stats ? stats.authenticated_packets + stats.replay_filtered : packets.length);
  const trustScore = stats ? stats.trust_score : (packets[0]?.trust_score ?? 100);
  const threatsBlocked = stats ? stats.replay_filtered : threats.filter(t => t.action === 'BLOCKED').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full min-w-0">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              SecureLink
            </h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
              demoState === 'PAUSED'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : demoState === 'RUNNING'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                demoState === 'PAUSED' ? 'bg-amber-500' : demoState === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}></span>
              {demoState === 'PAUSED' ? 'DEMO PAUSED' : demoState === 'RUNNING' ? 'ONLINE' : 'STANDBY'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Cyber-Secure Tactical Datalink System
          </p>
        </div>

        {/* TACTICAL CONTROLS: DEMO CONTROLLER (START DEMO -> PAUSE -> RESUME) + SEND CUSTOM TELEMETRY */}
        <div className="flex items-center space-x-2">
          {/* DEMO CONTROLLER BUTTON: Strict 3-state machine */}
          {demoState === 'STOPPED' && (
            <button
              onClick={handleStartDemo}
              disabled={isTogglingAction}
              className="px-3.5 py-1.5 rounded text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="Start simulated telemetry demonstration"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isTogglingAction ? 'STARTING...' : 'START DEMO'}</span>
            </button>
          )}

          {demoState === 'RUNNING' && (
            <button
              onClick={handlePause}
              disabled={isTogglingAction}
              className="px-3.5 py-1.5 rounded text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="Pause telemetry demonstration"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>{isTogglingAction ? 'PAUSING...' : 'PAUSE'}</span>
            </button>
          )}

          {demoState === 'PAUSED' && (
            <button
              onClick={handleResume}
              disabled={isTogglingAction}
              className="px-3.5 py-1.5 rounded text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="Resume telemetry demonstration"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isTogglingAction ? 'RESUMING...' : 'RESUME'}</span>
            </button>
          )}

          {/* Send Custom Telemetry Button */}
          <button
            onClick={() => setIsCustomTelemetryOpen(true)}
            className="px-3.5 py-1.5 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            title="Inject custom tactical telemetry packet"
          >
            <Send className="w-3.5 h-3.5" />
            <span>SEND CUSTOM TELEMETRY</span>
          </button>
        </div>
      </div>

      {/* 2. TOP SECTION — 5 SIMPLE STATUS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 w-full">
        {/* SYSTEM STATUS */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            SYSTEM STATUS
          </span>
          <div className="mt-2 flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isStreamPaused ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
            <span className="text-sm font-bold text-slate-800">
              {isStreamPaused ? 'PAUSED' : 'ONLINE'}
            </span>
          </div>
        </div>

        {/* TELEMETRY */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            TELEMETRY
          </span>
          <div className="mt-2 flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isStreamPaused
                  ? 'bg-amber-400'
                  : isTelemetryReceiving
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-slate-400'
              }`}
            ></span>
            <span className="text-sm font-bold text-slate-800">
              {isStreamPaused ? 'PAUSED' : isTelemetryReceiving ? 'RECEIVING' : 'STANDBY'}
            </span>
          </div>
        </div>

        {/* PACKETS PROCESSED */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            PACKETS PROCESSED
          </span>
          <div className="mt-2 text-xl font-bold font-mono text-slate-900 leading-tight">
            {totalProcessed.toLocaleString()}
          </div>
        </div>

        {/* TRUST SCORE */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            TRUST SCORE
          </span>
          <div
            className={`mt-2 text-xl font-bold font-mono leading-tight ${
              trustScore >= 75
                ? 'text-emerald-700'
                : trustScore >= 50
                ? 'text-amber-700'
                : 'text-rose-700'
            }`}
          >
            {trustScore}/100
          </div>
        </div>

        {/* THREATS */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
            THREATS
          </span>
          <div className="mt-2 text-sm font-bold font-mono text-slate-800">
            {threatsBlocked > 0 ? (
              <span className="text-rose-700">{threatsBlocked} BLOCKED</span>
            ) : (
              <span className="text-emerald-700">0 BLOCKED</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. SECURITY PIPELINE (ONE SIMPLE HORIZONTAL LINE) */}
      <PipelineVisualizer stages={pipelineStages} />

      {/* 4. MAIN SECTION — REAL-TIME TELEMETRY AUTHENTICATION FEED (LATEST 10 PACKETS) */}
      <RealTimeTelemetryFeed
        packets={packets}
        simulatorActive={demoState === 'RUNNING'}
        onSelectPacket={(pkt) => setSelectedPacket(pkt)}
      />

      {/* 5. BOTTOM SECTION — SECURITY ALERTS & TRUSTED C2 OUTPUT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <SecurityAlertsPanel
          threats={threats}
          packets={packets}
          onNavigateToLogs={() => onNavigate?.('logs')}
        />
        <TrustedC2Panel
          status={stats?.c2_output?.status || 'CONNECTED'}
          forwardedCount={stats?.c2_output?.forwarded ?? (stats?.adaptive_filter?.accepted || 0)}
          blockedCount={stats?.replay_filtered ?? (stats?.adaptive_filter?.blocked || 0)}
        />
      </div>

      {/* PACKET DETAIL MODAL */}
      <SimplePacketDetailModal
        packet={selectedPacket}
        onClose={() => setSelectedPacket(null)}
        onNavigateToVerification={() => onNavigate?.('verification')}
      />

      {/* CUSTOM TELEMETRY MODAL */}
      <CustomTelemetryModal
        isOpen={isCustomTelemetryOpen}
        onClose={() => setIsCustomTelemetryOpen(false)}
        onTelemetrySubmitted={() => onRefreshData()}
      />
    </div>
  );
};
