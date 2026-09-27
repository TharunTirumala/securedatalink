import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { SimulatorConfig } from '../types/telemetry';
import {
  SlidersHorizontal,
  ShieldAlert,
  CheckCircle2,
  History,
  Key,
  Lock,
  RefreshCw,
  Play,
  Pause,
  Trash2,
  Cpu,
  Layers,
  Radio,
  Sliders
} from 'lucide-react';

export const OperatorOverridePage: React.FC = () => {
  const [freshnessWindow, setFreshnessWindow] = useState(5.0);
  const [pendingWindow, setPendingWindow] = useState(5.0);
  const [streamStatus, setStreamStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE');
  const [cacheEntries, setCacheEntries] = useState(0);
  const [activeKeyId, setActiveKeyId] = useState<string>('KEY-TACTICAL-PRIMARY');
  const [selectedOperator, setSelectedOperator] = useState('OPERATOR-PRIMARY');
  const [authorizedOperators, setAuthorizedOperators] = useState<string[]>([
    'OPERATOR-PRIMARY',
    'OPERATOR-BACKUP',
    'TACTICAL-SUPERVISOR',
    'CHIEF-SECURITY-OFFICER'
  ]);
  const [passcode, setPasscode] = useState('');
  const [operatorActions, setOperatorActions] = useState<any[]>([]);
  
  // Simulator State
  const [simConfig, setSimConfig] = useState<SimulatorConfig>({
    enabled: true,
    rate_hz: 1.0,
    attack_ratio: 0.25,
    sources: ['UAV-ALPHA-01', 'UAV-BRAVO-02', 'UGV-SIERRA-03', 'BASE-RELAY-04']
  });
  const [isUpdatingSim, setIsUpdatingSim] = useState(false);

  // Modal State
  const [modalAction, setModalAction] = useState<'override' | 'clear_cache' | 'resync_key' | 'pause_stream' | 'resume_stream' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchStatusAndActions = async () => {
    try {
      const [status, actions, keyData, sim] = await Promise.all([
        api.getOperatorStatus().catch(() => null),
        api.getOperatorActions().catch(() => []),
        api.getActiveKey().catch(() => null),
        api.getSimulatorConfig().catch(() => null)
      ]);

      if (status) {
        if (status.freshness_window !== undefined) {
          setFreshnessWindow(status.freshness_window);
          setPendingWindow(status.freshness_window);
        }
        if (status.stream_status) {
          setStreamStatus(status.stream_status as 'ACTIVE' | 'PAUSED');
        }
        if (status.cache_entries !== undefined) {
          setCacheEntries(status.cache_entries);
        }
        if (status.authorized_operators && status.authorized_operators.length > 0) {
          setAuthorizedOperators(status.authorized_operators);
        }
      }
      if (keyData && keyData.key_id) {
        setActiveKeyId(keyData.key_id);
      }
      if (sim) {
        setSimConfig(sim);
      }
      setOperatorActions(actions);
    } catch (e) {
      console.error('Error fetching operator state:', e);
    }
  };

  useEffect(() => {
    fetchStatusAndActions();

    const unsubOverride = wsClient.on('override_applied', (data: any) => {
      if (data && data.freshness_window !== undefined) {
        setFreshnessWindow(data.freshness_window);
        setPendingWindow(data.freshness_window);
      }
      api.getOperatorActions().then(setOperatorActions).catch(() => {});
    });

    const unsubStatus = wsClient.on('system_status_changed', (data: any) => {
      if (data && data.stream_status) {
        setStreamStatus(data.stream_status as 'ACTIVE' | 'PAUSED');
      }
      if (data && data.simulator_active !== undefined) {
        setSimConfig(prev => ({ ...prev, enabled: data.simulator_active }));
      }
      api.getOperatorActions().then(setOperatorActions).catch(() => {});
    });

    const unsubCache = wsClient.on('cache_cleared', () => {
      setCacheEntries(0);
      api.getOperatorActions().then(setOperatorActions).catch(() => {});
    });

    const unsubKey = wsClient.on('key_status_changed', (data: any) => {
      if (data && data.key_id) {
        setActiveKeyId(data.key_id);
      }
      api.getOperatorActions().then(setOperatorActions).catch(() => {});
    });

    return () => {
      unsubOverride();
      unsubStatus();
      unsubCache();
      unsubKey();
    };
  }, []);

  // Handle Confirmed Modal Action
  const handleConfirmAction = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      if (modalAction === 'override') {
        const result = await api.applyOverride(pendingWindow, selectedOperator, passcode);
        setFreshnessWindow(pendingWindow);
        setStatusMsg(result.message || `Security override applied: Freshness tolerance set to ${pendingWindow}s`);
      } else if (modalAction === 'clear_cache') {
        const result = await api.clearReplayCache(passcode, selectedOperator);
        setCacheEntries(0);
        setStatusMsg(result.message || 'Replay nonce cache successfully flushed.');
      } else if (modalAction === 'resync_key') {
        const result = await api.resyncKey(selectedOperator);
        setActiveKeyId(result.key_id);
        setStatusMsg(`Active cryptographic session key resynchronized to ${result.key_id}.`);
      } else if (modalAction === 'pause_stream') {
        const result = await api.pauseStream(selectedOperator);
        setStreamStatus('PAUSED');
        setStatusMsg(result.message || 'Tactical telemetry stream paused.');
      } else if (modalAction === 'resume_stream') {
        const result = await api.resumeStream(selectedOperator);
        setStreamStatus('ACTIVE');
        setStatusMsg(result.message || 'Tactical telemetry stream resumed.');
      }

      setPasscode('');
      setModalAction(null);
      // Refresh actions list
      const actions = await api.getOperatorActions();
      setOperatorActions(actions);
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed. Verify operator authorization and passcode.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSimulator = async (newConfig: SimulatorConfig) => {
    setIsUpdatingSim(true);
    setErrorMsg('');
    try {
      await api.setSimulatorConfig(newConfig);
      setSimConfig(newConfig);
      setStatusMsg(`Demonstration simulator updated: ${newConfig.enabled ? 'ACTIVE' : 'STANDBY'} at ${newConfig.rate_hz} Hz (${Math.round(newConfig.attack_ratio * 100)}% attack injection)`);
      const actions = await api.getOperatorActions();
      setOperatorActions(actions);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update simulator configuration.');
    } finally {
      setIsUpdatingSim(false);
    }
  };

  const setPreset = (sec: number) => {
    setPendingWindow(sec);
    setErrorMsg('');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operator Control Center</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
              <Cpu className="w-3 h-3 text-sky-600 mr-1" />
              TACTICAL COMMAND
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time tactical controls for pipeline tolerances, stream state, replay cache, and key management
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase">OPERATOR:</span>
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {authorizedOperators.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchStatusAndActions}
            className="p-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600 flex items-center space-x-1.5 text-xs font-semibold"
            title="Refresh Operator Status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>REFRESH</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between space-x-2 shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg('')} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">×</button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between space-x-2 shadow-xs">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-800 font-bold ml-2">×</button>
        </div>
      )}

      {/* Tactical Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stream Ingestion Control Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">STREAM STATUS</span>
              <Radio className={`w-4 h-4 ${streamStatus === 'ACTIVE' ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className={`text-base font-bold font-mono ${streamStatus === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {streamStatus}
              </span>
              <span className="text-[11px] text-slate-500">
                {streamStatus === 'ACTIVE' ? 'Processing live frames' : 'Pipeline ingress halted'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Pausing the stream temporarily suspends UDP ingestion and simulation processing.
            </p>
          </div>

          <div>
            {streamStatus === 'ACTIVE' ? (
              <button
                onClick={() => { setErrorMsg(''); setModalAction('pause_stream'); }}
                className="w-full py-2 px-3 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5 text-amber-700" />
                <span>Pause Stream Processing</span>
              </button>
            ) : (
              <button
                onClick={() => { setErrorMsg(''); setModalAction('resume_stream'); }}
                className="w-full py-2 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume Stream Processing</span>
              </button>
            )}
          </div>
        </div>

        {/* Replay Nonce Cache Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">REPLAY CACHE</span>
              <Layers className="w-4 h-4 text-sky-600" />
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-base font-bold font-mono text-slate-900">
                {cacheEntries} Nonces
              </span>
              <span className="text-[11px] text-slate-500">Tracked in memory</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Flushing clears cached cryptographic nonces, resetting duplicate detection windows.
            </p>
          </div>

          <button
            onClick={() => { setErrorMsg(''); setModalAction('clear_cache'); }}
            className="w-full py-2 px-3 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Flush Replay Cache</span>
          </button>
        </div>

        {/* Cryptographic Session Key Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">SESSION KEY</span>
              <Key className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-xs font-bold font-mono text-indigo-900 truncate">
                {activeKeyId}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              AES-256-GCM authenticated cipher. Dynamic re-keying rotates the shared session key.
            </p>
          </div>

          <button
            onClick={() => { setErrorMsg(''); setModalAction('resync_key'); }}
            className="w-full py-2 px-3 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
            <span>Resync Session Key</span>
          </button>
        </div>
      </div>

      {/* Freshness Window Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-5">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
          <SlidersHorizontal className="w-5 h-5 text-sky-700" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Dynamic Freshness Verification Window
          </h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          The sliding freshness window prevents packet replay attacks by rejecting frames whose timestamps deviate from system time beyond the configured threshold. In high-latency tactical satellite or multi-hop mesh links, an authorized operator may temporarily widen this window.
        </p>

        {/* Current Active Window Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs">
          <span className="text-slate-500 font-medium">Active Tolerance in Pipeline:</span>
          <span className="font-mono font-bold text-sky-700">{freshnessWindow.toFixed(1)} seconds</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">Persisted in SQLite</span>
        </div>

        <div className="max-w-2xl space-y-4 pt-2">
          {/* Operator Identifier Selection & Window Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Authorized Operator ID
              </label>
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {authorizedOperators.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Target Freshness Window
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1.0"
                  max="60.0"
                  step="0.5"
                  value={pendingWindow}
                  onChange={(e) => setPendingWindow(parseFloat(e.target.value) || 1.0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono font-bold text-sky-800 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span className="text-xs font-semibold text-slate-500">sec</span>
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-1.5">
            <input
              type="range"
              min="1.0"
              max="60.0"
              step="0.5"
              value={pendingWindow}
              onChange={(e) => setPendingWindow(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-700"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1.0s (Strict)</span>
              <span>5.0s (Nominal)</span>
              <span>15.0s (Mesh)</span>
              <span>30.0s (SatCom)</span>
              <span>60.0s (Max)</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { label: '1.0s Strict Tactical', val: 1.0 },
              { label: '5.0s Standard Nominal', val: 5.0 },
              { label: '15.0s Mesh Relay', val: 15.0 },
              { label: '30.0s SatCom Link', val: 30.0 },
              { label: '60.0s Max Boundary', val: 60.0 },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => setPreset(p.val)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors border ${
                  pendingWindow === p.val
                    ? 'bg-sky-50 text-sky-800 border-sky-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setErrorMsg('');
                setModalAction('override');
              }}
              disabled={pendingWindow === freshnessWindow}
              className={`px-4 py-2 rounded text-xs font-semibold shadow-xs transition-colors ${
                pendingWindow !== freshnessWindow
                  ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
            >
              Apply Freshness Override
            </button>
          </div>
        </div>
      </div>

      {/* Demonstration & Testing Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Simulation & Demonstration Configuration
            </h2>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            simConfig.enabled ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'
          }`}>
            {simConfig.enabled ? 'GENERATING SYNTHETIC TELEMETRY' : 'SIMULATION STANDBY'}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Configure real-time synthetic telemetry traffic generation for offline evaluation, demonstration, and stress testing. Adjust packet ingestion frequency and synthetic threat injection ratios.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Simulator Toggle */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col justify-between">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Simulation Generator
            </label>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => handleUpdateSimulator({ ...simConfig, enabled: !simConfig.enabled })}
                disabled={isUpdatingSim}
                className={`w-full py-1.5 px-3 rounded text-xs font-bold transition-colors ${
                  simConfig.enabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {simConfig.enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          {/* Rate Hz Slider */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
            <div className="flex justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <span>Ingestion Frequency</span>
              <span className="font-mono text-indigo-700">{simConfig.rate_hz.toFixed(1)} Hz</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={simConfig.rate_hz}
              onChange={(e) => handleUpdateSimulator({ ...simConfig, rate_hz: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>0.5 Hz (Slow)</span>
              <span>1.0 Hz (Nominal)</span>
              <span>5.0 Hz (Stress)</span>
            </div>
          </div>

          {/* Attack Ratio Slider */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
            <div className="flex justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <span>Attack Injection Ratio</span>
              <span className="font-mono text-rose-700">{Math.round(simConfig.attack_ratio * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.8"
              step="0.05"
              value={simConfig.attack_ratio}
              onChange={(e) => handleUpdateSimulator({ ...simConfig, attack_ratio: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>0% (Clean)</span>
              <span>25% (Standard)</span>
              <span>80% (Hostile)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operator Audit History Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Operator Control Audit History
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {operatorActions.length} Actions Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Timestamp (UTC)</th>
                <th className="py-2.5 px-3">Operator ID</th>
                <th className="py-2.5 px-3">Action Executed</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Confirmed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {operatorActions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No operator actions recorded yet. Perform an action above to commit an audit event.
                  </td>
                </tr>
              ) : (
                operatorActions.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {act.timestamp ? new Date(act.timestamp).toISOString().replace('T', ' ').slice(0, 19) : ''}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{act.operator_id}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{act.action}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        act.status === 'SUCCESS' || act.status === 'EXECUTED'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        {act.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-emerald-600 font-semibold">
                      {act.confirmed ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation & Authorization Modal */}
      <ConfirmModal
        isOpen={Boolean(modalAction)}
        title={
          modalAction === 'override'
            ? 'Authorize Security Override'
            : modalAction === 'clear_cache'
            ? 'Authorize Replay Cache Flush'
            : modalAction === 'resync_key'
            ? 'Confirm Session Key Resynchronization'
            : modalAction === 'pause_stream'
            ? 'Confirm Telemetry Stream Pause'
            : 'Confirm Telemetry Stream Resume'
        }
        message={
          modalAction === 'override'
            ? `Confirm adjustment of dynamic freshness window from ${freshnessWindow.toFixed(1)}s to ${pendingWindow.toFixed(1)}s for operator ${selectedOperator}.`
            : modalAction === 'clear_cache'
            ? `Confirm flushing ${cacheEntries} nonces from the replay protection cache. An authorization passcode is required.`
            : modalAction === 'resync_key'
            ? `Rotate and distribute the active AES-256-GCM session key across the tactical network?`
            : modalAction === 'pause_stream'
            ? `Suspend incoming telemetry stream processing? The pipeline will stop accepting packets until resumed.`
            : `Resume incoming telemetry stream processing? The pipeline will accept new packet frames.`
        }
        confirmLabel={isSubmitting ? "Executing..." : "Authorize & Confirm"}
        confirmVariant={modalAction === 'pause_stream' || modalAction === 'override' ? 'warning' : 'primary'}
        disabled={isSubmitting || ((modalAction === 'override' || modalAction === 'clear_cache') && !passcode.trim())}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          if (!isSubmitting) {
            setModalAction(null);
            setPasscode('');
          }
        }}
      >
        <div className="space-y-3 pt-2">
          {(modalAction === 'override' || modalAction === 'clear_cache') && (
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Operator Authorization Passcode (Required)</span>
              </label>
              <input
                type="password"
                placeholder="Enter passcode (e.g. TAC-SEC-8000)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Authorized tactical passcode: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-bold">TAC-SEC-8000</code>
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 font-medium">
              {errorMsg}
            </div>
          )}
        </div>
      </ConfirmModal>
    </div>
  );
};
