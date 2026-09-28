import React from 'react';

interface TrustedC2PanelProps {
  status?: string;
  forwardedCount: number;
  blockedCount: number;
}

export const TrustedC2Panel: React.FC<TrustedC2PanelProps> = ({
  status = 'INTERFACE READY',
  forwardedCount,
  blockedCount
}) => {
  const normStatus = status.toUpperCase();
  const isLive = normStatus.includes('CONNECTED') || normStatus.includes('ACTIVE') || normStatus.includes('FORWARDING');
  const isStandby = normStatus.includes('READY') || normStatus.includes('STANDBY');
  const dotColor = isLive ? 'bg-emerald-500' : isStandby ? 'bg-sky-500' : 'bg-rose-500';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between w-full h-full min-h-[220px]">
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 font-mono">
          TRUSTED C2 OUTPUT
        </h3>

        <div className="space-y-4">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
              STATUS
            </span>
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
              <span className="text-sm font-bold text-slate-800">
                {status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="p-3 bg-slate-50 rounded border border-slate-200/80">
              <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">
                Packets forwarded
              </span>
              <span className="text-xl font-bold font-mono text-emerald-700">
                {forwardedCount.toLocaleString()}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200/80">
              <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">
                Packets blocked
              </span>
              <span className="text-xl font-bold font-mono text-rose-700">
                {blockedCount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-400">
        Downstream tactical flight & mission controllers
      </div>
    </div>
  );
};
