import React from 'react';
import { Filter, CheckCircle2, XCircle, ShieldAlert, RefreshCw, AlertOctagon } from 'lucide-react';

interface AdaptiveFilterPanelProps {
  stats: {
    is_active: boolean;
    evaluated: number;
    accepted: number;
    rejected: number;
    blocked: number;
    replay: number;
    tampered: number;
    filtered: number;
  };
}

export const AdaptiveFilterPanel: React.FC<AdaptiveFilterPanelProps> = ({ stats }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-sky-700" />
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Adaptive Verification & Filtering
            </h3>
            <div className="text-sm font-bold text-slate-900">Deterministic Policy Filter</div>
          </div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          ADAPTIVE FILTER ACTIVE
        </span>
      </div>

      {/* Grid of Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">Packets Evaluated</span>
          <span className="text-xl font-bold font-mono text-slate-800 mt-1 block">
            {stats.evaluated.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase block">Packets Accepted</span>
          <span className="text-xl font-bold font-mono text-emerald-800 mt-1 block">
            {stats.accepted.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
          <span className="text-[11px] font-semibold text-amber-700 uppercase block">Packets Rejected</span>
          <span className="text-xl font-bold font-mono text-amber-800 mt-1 block">
            {stats.rejected.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-md bg-rose-50 border border-rose-200">
          <span className="text-[11px] font-semibold text-rose-700 uppercase block">Packets Blocked</span>
          <span className="text-xl font-bold font-mono text-rose-800 mt-1 block">
            {stats.blocked.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-semibold text-amber-600 uppercase block">Replay Packets</span>
          <span className="text-xl font-bold font-mono text-amber-700 mt-1 block">
            {stats.replay.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-semibold text-rose-600 uppercase block">Tampered Packets</span>
          <span className="text-xl font-bold font-mono text-rose-700 mt-1 block">
            {stats.tampered.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Policy: Reject invalid format, Block replay & tampering</span>
        <span className="font-mono text-[11px]">Rule Set: SL-REV-4</span>
      </div>
    </div>
  );
};
