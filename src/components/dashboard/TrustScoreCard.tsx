import React from 'react';
import { TrustDetails } from '../../types/telemetry';
import { ShieldAlert, ShieldCheck, Check, X, AlertTriangle } from 'lucide-react';

interface TrustScoreCardProps {
  score: number;
  details?: TrustDetails;
}

export const TrustScoreCard: React.FC<TrustScoreCardProps> = ({ score, details }) => {
  const isHighTrust = score >= 75;
  const isModerateTrust = score >= 50 && score < 75;
  const isSuspicious = score < 50;

  let scoreColor = 'text-emerald-700';
  let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  let gaugeBarColor = 'bg-emerald-500';

  if (isModerateTrust) {
    scoreColor = 'text-amber-700';
    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
    gaugeBarColor = 'bg-amber-500';
  } else if (isSuspicious) {
    scoreColor = 'text-rose-700';
    badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
    gaugeBarColor = 'bg-rose-500';
  }

  // Default checks if not yet received
  const checks = [
    { label: 'Authentication (AES-256-GCM)', ok: details ? details.auth_ok : true },
    { label: 'ECDSA Digital Signature', ok: details ? details.sig_ok : true },
    { label: 'Dynamic Freshness Check', ok: details ? details.fresh_ok : true },
    { label: 'Replay Nonce Verification', ok: details ? details.replay_ok : true },
    { label: 'SHA-256 Payload Integrity', ok: details ? details.integrity_ok : true },
    { label: 'Source Verification', ok: details ? details.source_ok : true },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isSuspicious ? (
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            )}
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tactical Trust Score
            </h3>
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
            {isSuspicious ? 'DECISION: BLOCKED' : isModerateTrust ? 'EVALUATION WARN' : 'DECISION: ACCEPTED'}
          </span>
        </div>

        {/* Big Score Display */}
        <div className="mt-4 flex items-baseline space-x-2">
          <span className={`text-4xl font-extrabold tracking-tight font-mono ${scoreColor}`}>
            {score}
          </span>
          <span className="text-slate-400 font-bold text-lg font-mono">/ 100</span>
          <span className="text-xs font-medium text-slate-500 ml-2">Decision-Support Metric</span>
        </div>

        {/* Linear progress bar */}
        <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
          <div
            className={`h-full transition-all duration-500 rounded-full ${gaugeBarColor}`}
            style={{ width: `${Math.max(5, Math.min(score, 100))}%` }}
          ></div>
        </div>

        {/* Contributing checks list */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Contributing Cryptographic Checks
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center space-x-2 py-1">
                {c.ok ? (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span className={c.ok ? 'text-slate-700 font-medium' : 'text-rose-700 font-semibold'}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isSuspicious && (
        <div className="mt-4 p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>Security violation detected: Invalidation penalized score and triggered automatic block.</span>
        </div>
      )}
    </div>
  );
};
