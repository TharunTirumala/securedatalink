import React from 'react';
import { PipelineStage } from '../../types/telemetry';

interface PipelineVisualizerProps {
  stages: PipelineStage[];
}

const DEFAULT_STAGES: PipelineStage[] = [
  { id: 1, name: 'Telemetry Input', status: 'STANDBY', detail: 'Awaiting telemetry packet ingress' },
  { id: 2, name: 'Signal Ingestion', status: 'STANDBY', detail: 'Radio RF demodulator standby' },
  { id: 3, name: 'Preprocessing', status: 'STANDBY', detail: 'Frame alignment buffer idle' },
  { id: 4, name: 'Nonce/Freshness', status: 'STANDBY', detail: 'Replay window initialized' },
  { id: 5, name: 'AES-256-GCM', status: 'STANDBY', detail: 'Hardware decrypt engine standby' },
  { id: 6, name: 'ECDSA', status: 'STANDBY', detail: 'P-256 public key verification ready' },
  { id: 7, name: 'Integrity', status: 'STANDBY', detail: 'SHA-256 digest validator ready' },
  { id: 8, name: 'Adaptive Filter', status: 'STANDBY', detail: 'Threat heuristic engine ready' },
  { id: 9, name: 'Trust Score', status: 'STANDBY', detail: 'Multi-factor trust evaluator ready' },
  { id: 10, name: 'C2 Output', status: 'STANDBY', detail: 'Downstream command link standby' },
];

const STAGE_NAME_MAP: Record<string, string> = {
  'Telemetry Input': 'Telemetry Input',
  'Signal Ingestion': 'Signal Ingestion',
  'Preprocessing': 'Preprocessing',
  'Nonce/Freshness': 'Nonce/Freshness',
  'Dynamic Nonce / Freshness': 'Nonce/Freshness',
  'AES-256-GCM': 'AES-256-GCM',
  'AES-256-GCM Decryption': 'AES-256-GCM',
  'ECDSA': 'ECDSA',
  'ECDSA Verification': 'ECDSA',
  'Integrity': 'Integrity',
  'Integrity Check': 'Integrity',
  'Integrity Verification': 'Integrity',
  'Adaptive Filter': 'Adaptive Filter',
  'Adaptive Filtering': 'Adaptive Filter',
  'Trust Score': 'Trust Score',
  'Trust Assessment': 'Trust Score',
  'C2 Output': 'C2 Output',
  'Trusted C2 Output': 'C2 Output',
};

export const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({ stages }) => {
  const rawList = stages && stages.length > 0 ? stages : DEFAULT_STAGES;
  const displayStages = rawList.map((s) => ({
    ...s,
    displayName: STAGE_NAME_MAP[s.name] || s.name,
    displayStatus: s.status === 'VERIFIED' ? 'PASS' : s.status,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs w-full min-w-0">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">
        SECURITY PIPELINE
      </div>

      <div className="overflow-x-auto py-1 w-full contain-scroll-x">
        <div className="flex items-center justify-between min-w-[880px] w-full flex-nowrap space-x-1">
          {displayStages.map((stage, idx) => {
            const isFail = stage.displayStatus === 'FAILED';
            const isStandby = stage.displayStatus === 'STANDBY';
            const dotColor = isFail ? 'bg-rose-500' : isStandby ? 'bg-slate-400' : 'bg-emerald-500';

            return (
              <React.Fragment key={stage.id || idx}>
                <div
                  title={stage.detail || stage.displayName}
                  className="flex flex-col items-center justify-center px-2 py-1 rounded bg-slate-50 border border-slate-200/90 text-center min-w-[76px] flex-shrink-0 cursor-default hover:bg-slate-100/80 transition-colors"
                >
                  <span className="text-[11px] font-semibold text-slate-800 whitespace-nowrap">
                    {stage.displayName}
                  </span>
                  <div className="flex items-center space-x-1 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                    <span className={`text-[9px] font-mono font-bold uppercase ${isStandby ? 'text-slate-400' : 'text-slate-600'}`}>
                      {stage.displayStatus}
                    </span>
                  </div>
                </div>

                {idx < displayStages.length - 1 && (
                  <span className="text-slate-300 font-bold select-none text-xs flex-shrink-0 px-0.5">
                    →
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
