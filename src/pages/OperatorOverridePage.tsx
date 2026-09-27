import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { SlidersHorizontal, AlertTriangle, ShieldAlert, CheckCircle2, History, Key, Lock, RefreshCw } from 'lucide-react';

export const OperatorOverridePage: React.FC = () => {
  const [freshnessWindow, setFreshnessWindow] = useState(5.0);
  const [pendingWindow, setPendingWindow] = useState(5.0);
  const [selectedOperator, setSelectedOperator] = useState('OPERATOR-PRIMARY');
  const [authorizedOperators, setAuthorizedOperators] = useState<string[]>([
    'OPERATOR-PRIMARY',
    'OPERATOR-BACKUP',
    'TACTICAL-SUPERVISOR',
    'CHIEF-SECURITY-OFFICER'
  ]);
  const [passcode, setPasscode] = useState('');
  const [operatorActions, setOperatorActions] = useState<any[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchStatusAndActions = async () => {
    try {
      const [status, actions] = await Promise.all([
        api.getOperatorStatus().catch(() => null),
        api.getOperatorActions().catch(() => [])
      ]);

      if (status && status.freshness_window !== undefined) {
        setFreshnessWindow(status.freshness_window);
        setPendingWindow(status.freshness_window);
        if (status.authorized_operators && status.authorized_operators.length > 0) {
          setAuthorizedOperators(status.authorized_operators);
        }
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

    return () => {
      unsubOverride();
    };
  }, []);

  const handleApplyOverride = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      const result = await api.applyOverride(pendingWindow, selectedOperator, passcode);
      setFreshnessWindow(pendingWindow);
      setStatusMsg(result.message || `Security override applied: Freshness tolerance set to ${pendingWindow}s`);
      setPasscode('');
      setIsConfirmOpen(false);
      // Refresh actions
      const actions = await api.getOperatorActions();
      setOperatorActions(actions);
    } catch (err: any) {
      setErrorMsg(err.message || 'Operator authorization failed: Invalid passcode or unauthorized role.');
    } finally {
      setIsSubmitting(false);
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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operator Security Override</h1>
          <p className="text-xs text-slate-500 font-medium">
            Authorized tactical control interface for adjusting pipeline tolerances and policy rules
          </p>
        </div>

        <button
          onClick={fetchStatusAndActions}
          className="self-start sm:self-auto p-2 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600 flex items-center space-x-1.5 text-xs font-semibold"
          title="Refresh Operator Status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH STATE</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMsg}</span>
          </div>
          <button onClick={() => setStatusMsg('')} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">×</button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center justify-between space-x-2">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-800 font-bold ml-2">×</button>
        </div>
      )}

      {/* Override Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5">
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
          <span className="text-slate-500">Persisted in Secure Database</span>
        </div>

        <div className="max-w-xl space-y-4 pt-2">
          {/* Operator Identifier Selection */}
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
              <span>15.0s (Nominal)</span>
              <span>30.0s (Mesh)</span>
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
                setIsConfirmOpen(true);
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

      {/* Audit Log of Operator Overrides */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
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
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No operator actions recorded in this session.
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
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {act.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-emerald-600 font-semibold">Yes</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation & Authorization Modal */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Authorize Security Override"
        message={`Confirm adjustment of dynamic freshness window from ${freshnessWindow.toFixed(1)}s to ${pendingWindow.toFixed(1)}s for operator ${selectedOperator}.`}
        confirmLabel={isSubmitting ? "Verifying..." : "Authorize & Apply"}
        confirmVariant="warning"
        disabled={isSubmitting || !passcode.trim()}
        onConfirm={handleApplyOverride}
        onCancel={() => {
          if (!isSubmitting) {
            setIsConfirmOpen(false);
            setPasscode('');
          }
        }}
      >
        <div className="space-y-3 pt-2">
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
