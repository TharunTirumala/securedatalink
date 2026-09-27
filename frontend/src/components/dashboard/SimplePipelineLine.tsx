import React from 'react';
import { PipelineStage } from '../../types/telemetry';

interface SimplePipelineLineProps {
  stages?: PipelineStage[];
}

export const SimplePipelineLine: React.FC<SimplePipelineLineProps> = ({ stages }) => {
  // Exact 10 stages requested:
  // Telemetry Input → Signal Ingestion → Preprocessing → Nonce/Freshness → AES-256-GCM → ECDSA → Integrity → Adaptive Filter → Trust Score → C2 Output
  const defaultStages = [
    { name: 'Telemetry Input', status: 'CONNECTED' },
    { name: 'Signal Ingestion', status: 'PASS' },
    { name: 'Preprocessing', status: 'PASS' },
    { name: 'Nonce/Freshness', status: 'PASS' },
    { name: 'AES-256-GCM', status: 'PASS' },
    { name: 'ECDSA', status: 'PASS' },
    { name: 'Integrity', status: 'PASS' },
    { name: 'Adaptive Filter', status: 'PASS' },
    { name: 'Trust Score', status: 'PASS' },
    { name: 'C2 Output', status: 'CONNECTED' },
  ];

  const displayList = defaultStages.map((def, idx) => {
    if (stages && stages[idx]) {
      // Normalize status to clean string like PASS / CONNECTED
      let st = stages[idx].status;
      if (st === 'ACTIVE' || st === 'VERIFIED') st = 'PASS';
      return { name: def.name, status: st };
    }
    return def;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
        SECURITY PROCESSING PIPELINE
      </div>

      {/* ONE SIMPLE HORIZONTAL LINE */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center justify-between min-w-[860px] w-full flex-nowrap space-x-1">
          {displayList.map((stage, idx) => (
            <React.Fragment key={stage.name}>
              <div className="flex flex-col items-center justify-center px-2 py-1 rounded bg-slate-50 border border-slate-200/70 min-w-[76px] flex-shrink-0">
                <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap leading-tight">
                  {stage.name}
                </span>
                <span className="text-[10px] font-mono font-semibold text-emerald-600 mt-0.5 flex items-center leading-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 inline-block"></span>
                  {stage.status}
                </span>
              </div>

              {idx < displayList.length - 1 && (
                <span className="text-slate-300 font-bold text-xs select-none flex-shrink-0 px-0.5">
                  →
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
