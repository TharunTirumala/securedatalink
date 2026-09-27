import React from 'react';

interface SimpleStatusCardsProps {
  systemStatus: string;
  telemetryReceiving: boolean;
  streamPaused: boolean;
  packetsProcessed: number;
  trustScore: number;
  threatsBlocked: number;
}

export const SimpleStatusCards: React.FC<SimpleStatusCardsProps> = ({
  systemStatus,
  telemetryReceiving,
  streamPaused,
  packetsProcessed,
  trustScore,
  threatsBlocked
}) => {
  // Derive telemetry status label
  let telemetryLabel = 'RECEIVING';
  let telemetryColor = 'text-emerald-600';
  let telemetryDot = 'bg-emerald-500';

  if (streamPaused) {
    telemetryLabel = 'PAUSED';
    telemetryColor = 'text-amber-600';
    telemetryDot = 'bg-amber-500';
  } else if (!telemetryReceiving) {
    telemetryLabel = 'RECEIVING';
    telemetryColor = 'text-emerald-600';
    telemetryDot = 'bg-emerald-500';
  }

  // Trust score coloring
  let trustColor = 'text-emerald-700';
  if (trustScore < 50) {
    trustColor = 'text-rose-700';
  } else if (trustScore < 75) {
    trustColor = 'text-amber-700';
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5 w-full">
      {/* 1. SYSTEM STATUS */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 shadow-xs flex flex-col justify-between overflow-hidden">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          SYSTEM STATUS
        </span>
        <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-1 flex items-center space-x-1.5 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
          <span className="text-emerald-700">ONLINE</span>
        </div>
      </div>

      {/* 2. TELEMETRY */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 shadow-xs flex flex-col justify-between overflow-hidden">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          TELEMETRY
        </span>
        <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-1 flex items-center space-x-1.5 whitespace-nowrap">
          <span className={`w-2 h-2 rounded-full ${telemetryDot} flex-shrink-0`}></span>
          <span className={telemetryColor}>{telemetryLabel}</span>
        </div>
      </div>

      {/* 3. PACKETS PROCESSED */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 shadow-xs flex flex-col justify-between overflow-hidden">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          PACKETS PROCESSED
        </span>
        <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-1 whitespace-nowrap">
          {packetsProcessed.toLocaleString()}
        </div>
      </div>

      {/* 4. TRUST SCORE */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 shadow-xs flex flex-col justify-between overflow-hidden">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          TRUST SCORE
        </span>
        <div className={`text-base sm:text-lg font-bold font-mono mt-1 whitespace-nowrap ${trustColor}`}>
          {Math.round(trustScore)}/100
        </div>
      </div>

      {/* 5. THREATS */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-3.5 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1 overflow-hidden">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          THREATS
        </span>
        <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-1 flex items-center space-x-1 whitespace-nowrap">
          <span className={threatsBlocked > 0 ? 'text-rose-700 font-bold' : 'text-slate-700'}>
            {threatsBlocked} BLOCKED
          </span>
        </div>
      </div>
    </div>
  );
};
