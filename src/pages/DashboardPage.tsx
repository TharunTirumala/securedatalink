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
import { Play, Pause } from 'lucide-react';

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

  // Simulator configuration state
  const [simConfig, setSimConfig] = useState<SimulatorConfig>({
    enabled: false,
    rate_hz: 1.0,
    attack_ratio: 0.25,
    sources: ["UAV-ALPHA-01", "UAV-BRAVO-02", "UGV-SIERRA-03", "BASE-RELAY-04"]
  });

  useEffect(() => {
    api.getSimulatorConfig().then(setSimConfig).catch(() => {});
  }, []);

  const [isTogglingPause, setIsTogglingPause] = useState(false);

  const handleStartDemo = async () => {
    try {
      const newConfig = { ...simConfig, enabled: true };
      await api.setSimulatorConfig(newConfig);
      setSimConfig(newConfig);
      onRefreshData();
    } catch (e) {
      console.error('Failed to start demo:', e);
    }
  };

  const handleStopDemo = async () => {
    try {
      const newConfig = { ...simConfig, enabled: false };
      await api.setSimulatorConfig(newConfig);
      setSimConfig(newConfig);
      onRefreshData();
    } catch (e) {
      console.error('Failed to stop demo:', e);
    }
  };

  const handlePause = async () => {
    if (isTogglingPause) return;
    setIsTogglingPause(true);
    try {
      wsClient.setPaused(true);
      await api.pauseStream();
      onRefreshData();
    } catch (e) {
      console.error('Failed to pause stream:', e);
    } finally {
      setTimeout(() => setIsTogglingPause(false), 300);
    }
  };

  const handleResume = async () => {
    if (isTogglingPause) return;
    setIsTogglingPause(true);
    try {
      wsClient.setPaused(false);
      await api.resumeStream();
      onRefreshData();
    } catch (e) {
      console.error('Failed to resume stream:', e);
    } finally {
      setTimeout(() => setIsTogglingPause(false), 300);
    }
  };

  const isStreamPaused = stats?.stream_status === 'PAUSED';
  const isTelemetryReceiving = !isStreamPaused && (simConfig.enabled || packets.length > 0);
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
              isStreamPaused
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isStreamPaused ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              {isStreamPaused ? 'STREAM PAUSED' : 'ONLINE'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Cyber-Secure Tactical Datalink System
          </p>
        </div>

        {/* TACTICAL CONTROLS: PAUSE/RESUME STREAM + DEMO MODE */}
        <div className="flex items-center space-x-2">
          {/* Pause / Resume Button - Always accessible */}
          {isStreamPaused ? (
            <button
              onClick={handleResume}
              disabled={isTogglingPause}
              className="px-3.5 py-1.5 rounded text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              title="Resume tactical telemetry stream processing"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isTogglingPause ? 'RESUMING...' : 'RESUME STREAM'}</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              disabled={isTogglingPause}
              className="px-3.5 py-1.5 rounded text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              title="Pause tactical telemetry stream processing"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>{isTogglingPause ? 'PAUSING...' : 'PAUSE STREAM'}</span>
            </button>
          )}

          {/* Simulator Controls */}
          {simConfig.enabled ? (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                DEMO ACTIVE
              </span>
              <button
                onClick={handleStopDemo}
                className="px-3 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              >
                STOP DEMO
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartDemo}
              className="px-3 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center space-x-1"
            >
              <Play className="w-3 h-3 text-slate-500" />
              <span>DEMO MODE</span>
            </button>
          )}
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
        simulatorActive={simConfig.enabled}
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
    </div>
  );
};
