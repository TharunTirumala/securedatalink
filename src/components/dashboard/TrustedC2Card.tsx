import React from 'react';

interface TrustedC2CardProps {
  status: string;
  forwardedCount: number;
  blockedCount: number;
}

export const TrustedC2Card: React.FC<TrustedC2CardProps> = ({
  status = 'CONNECTED',
  forwardedCount = 0,
  blockedCount = 0
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            TRUSTED C2 OUTPUT
          </h3>
          <div className="flex items-center space-x-1.5 text-xs font-mono font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{status || 'CONNECTED'}</span>
          </div>
        </div>

        {/* 2 Simple Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3 rounded-md bg-slate-50 border border-slate-150">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Packets forwarded
            </span>
            <span className="text-xl font-bold font-mono text-emerald-800 mt-1 block">
              {forwardedCount.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-md bg-slate-50 border border-slate-150">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Packets blocked
            </span>
            <span className="text-xl font-bold font-mono text-slate-800 mt-1 block">
              {blockedCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>Downstream Command & Control Egress</span>
        <span className="font-mono text-emerald-600 font-semibold">● ACTIVE</span>
      </div>
    </div>
  );
};
