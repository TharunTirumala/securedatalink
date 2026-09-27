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
import { ImportTelemetryModal } from '../components/dashboard/ImportTelemetryModal';
import { Play, Pause, Upload, Square } from 'lucide-react';

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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [demoState, setDemoState] = useState<'STOPPED' | 'RUNNING' | 'PAUSED'>(() => {
    if (stats?.demo_state) return stats.demo_state;
    if (stats?.stream_status === 'PAUSED') return 'PAUSED';
    if (stats?.simulator_active) return 'RUNNING';
    return 'STOPPED';
  });
  const [actionLoading, setActionLoading] = useState<'STARTING' | 'STOPPING' | 'PAUSING' | 'RESUMING' | null>(null);

  useEffect(() => {
    if (stats?.demo_state) {
      setDemoState(stats.demo_state);
    }
  }, [stats?.demo_state]);

  useEffect(() => {
    api.getOperatorStatus().then((st) => {
      if (st && st.demo_state) {
        setDemoState(st.demo_state as 'STOPPED' | 'RUNNING' | 'PAUSED');
      }
    }).catch(() => {});

    const unsubStatus = wsClient.on('system_status_changed', (data: any) => {
      if (data && data.demo_state) {
        setDemoState(data.demo_state);
      } else if (data && data.stream_status === 'PAUSED') {
        setDemoState('PAUSED');
      } else if (data && data.simulator_active === false) {
        setDemoState('STOPPED');
      } else if (data && data.simulator_active === true && data.stream_status === 'ACTIVE') {
        setDemoState('RUNNING');
      }
    });

    return () => {
      unsubStatus();
    };
  }, []);

  const handleStartDemo = async () => {
    if (actionLoading !== null) return;
    setActionLoading('STARTING');
    try {
      wsClient.setPaused(false);
      const res = await api.startDemo();
      if (res && res.demo_state) {
        setDemoState(res.demo_state);
      } else {
        setDemoState('RUNNING');
      }
      onRefreshData();
    } catch (e) {
      console.error('Failed to start demo:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopDemo = async () => {
    if (actionLoading !== null) return;
    setActionLoading('STOPPING');
    try {
      const res = await api.stopDemo();
      if (res && res.demo_state) {
        setDemoState(res.demo_state);
      } else {
        setDemoState('STOPPED');
      }
      onRefreshData();
    } catch (e) {
      console.error('Failed to stop demo:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async () => {
    if (actionLoading !== null) return;
    setActionLoading('PAUSING');
    try {
      wsClient.setPaused(true);
      const res = await api.pauseStream();
      if (res && res.demo_state) {
        setDemoState(res.demo_state);
      } else {
        setDemoState('PAUSED');
      }
      onRefreshData();
    } catch (e) {
      console.error('Failed to pause demo:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    if (actionLoading !== null) return;
    setActionLoading('RESUMING');
    try {
      wsClient.setPaused(false);
      const res = await api.resumeStream();
      if (res && res.demo_state) {
        setDemoState(res.demo_state);
      } else {
        setDemoState('RUNNING');
      }
      onRefreshData();
    } catch (e) {
      console.error('Failed to resume demo:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const isStreamPaused = demoState === 'PAUSED';
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

        {/* TACTICAL CONTROLS: DEMO CONTROLLER (START DEMO -> STOP / PAUSE -> STOP / RESUME) + SEND CUSTOM TELEMETRY */}
        <div className="flex items-center space-x-2">
          {/* DEMO CONTROLLER BUTTONS: Strict state machine */}
          {demoState === 'STOPPED' && (
            <button
              onClick={handleStartDemo}
              disabled={actionLoading !== null}
              className="px-3.5 py-1.5 rounded text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="Start simulated telemetry demonstration"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>{actionLoading === 'STARTING' ? 'STARTING...' : 'START DEMO'}</span>
            </button>
          )}

          {demoState === 'RUNNING' && (
            <>
              <button
                onClick={handleStopDemo}
                disabled={actionLoading !== null}
                className="px-3.5 py-1.5 rounded text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                title="Stop telemetry demonstration and reset run sequence"
              >
                <Square className="w-3.5 h-3.5 text-rose-200 fill-current" />
                <span>{actionLoading === 'STOPPING' ? 'STOPPING...' : 'STOP'}</span>
              </button>
              <button
                onClick={handlePause}
                disabled={actionLoading !== null}
                className="px-3.5 py-1.5 rounded text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                title="Pause telemetry demonstration (preserves state)"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>{actionLoading === 'PAUSING' ? 'PAUSING...' : 'PAUSE'}</span>
              </button>
            </>
          )}

          {demoState === 'PAUSED' && (
            <>
              <button
                onClick={handleStopDemo}
                disabled={actionLoading !== null}
                className="px-3.5 py-1.5 rounded text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                title="Stop telemetry demonstration and reset run sequence"
              >
                <Square className="w-3.5 h-3.5 text-rose-200 fill-current" />
                <span>{actionLoading === 'STOPPING' ? 'STOPPING...' : 'STOP'}</span>
              </button>
              <button
                onClick={handleResume}
                disabled={actionLoading !== null}
                className="px-3.5 py-1.5 rounded text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                title="Resume telemetry demonstration from current state"
              >
                <Play className="w-3.5 h-3.5 text-sky-200" />
                <span>{actionLoading === 'RESUMING' ? 'RESUMING...' : 'RESUME'}</span>
              </button>
            </>
          )}

          {/* IMPORT JSON / CSV Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-1.5 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            title="Import telemetry batch from JSON, CSV, or JSONL file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>IMPORT JSON / CSV</span>
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
            <span className={`w-2 h-2 rounded-full ${
              demoState === 'PAUSED' ? 'bg-amber-500 animate-pulse' : demoState === 'RUNNING' ? 'bg-emerald-500' : 'bg-slate-400'
            }`}></span>
            <span className="text-sm font-bold text-slate-800">
              {demoState === 'PAUSED' ? 'PAUSED' : demoState === 'RUNNING' ? 'ONLINE' : 'STANDBY'}
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

      {/* IMPORT TELEMETRY MODAL */}
      <ImportTelemetryModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onTelemetryImported={() => onRefreshData()}
      />
    </div>
  );
};
