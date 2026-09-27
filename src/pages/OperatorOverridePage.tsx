import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { SlidersHorizontal, AlertTriangle, ShieldAlert, CheckCircle2, History } from 'lucide-react';

export const OperatorOverridePage: React.FC = () => {
  const [freshnessWindow, setFreshnessWindow] = useState(5.0);
  const [operatorActions, setOperatorActions] = useState<any[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingWindow, setPendingWindow] = useState(5.0);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchActions = async () => {
    try {
      const actions = await api.getOperatorActions();
      setOperatorActions(actions);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchActions();
  }, []);

  const handleApplyOverride = async () => {
    try {
      await api.applyOverride(pendingWindow, 'OPERATOR-PRIMARY');
      setFreshnessWindow(pendingWindow);
      setStatusMsg(`Security override applied: Freshness tolerance set to ${pendingWindow}s`);
      fetchActions();
    } catch (e) {
      console.error(e);
    } finally {
      setIsConfirmOpen(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operator Security Override</h1>
        <p className="text-xs text-slate-500 font-medium">
          Authorized tactical control interface for adjusting pipeline tolerances and policy rules
        </p>
      </div>

      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMsg}</span>
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

        <div className="max-w-md space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Tolerance Window:</span>
            <span className="font-mono font-bold text-sky-800 text-sm">{pendingWindow} seconds</span>
          </div>

          <input
            type="range"
            min="1.0"
            max="30.0"
            step="0.5"
            value={pendingWindow}
            onChange={(e) => setPendingWindow(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-700"
          />

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>1.0s (Strict Tactical)</span>
            <span>5.0s (Standard Nominal)</span>
            <span>30.0s (High Latency Mesh)</span>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsConfirmOpen(true)}
              disabled={pendingWindow === freshnessWindow}
              className={`px-4 py-2 rounded text-xs font-semibold shadow-xs transition-colors ${
                pendingWindow !== freshnessWindow
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
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
                    <td className="py-2.5 px-3 font-mono text-slate-500">
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

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Confirm Security Override"
        message={`Are you sure you want to adjust the dynamic freshness window to ${pendingWindow} seconds? This action will be permanently recorded in the operator audit trail.`}
        confirmLabel="Confirm Override"
        confirmVariant="warning"
        onConfirm={handleApplyOverride}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};
