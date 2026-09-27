import React from 'react';
import { ThreatEvent } from '../../types/telemetry';
import { ArrowRight } from 'lucide-react';

interface SecurityAlertsCardProps {
  threats: ThreatEvent[];
  onViewAllLogs: () => void;
}

export const SecurityAlertsCard: React.FC<SecurityAlertsCardProps> = ({
  threats,
  onViewAllLogs
}) => {
  // Show maximum 3-5 recent alerts
  const displayAlerts = threats.slice(0, 4);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            SECURITY ALERTS
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Recent Events
          </span>
        </div>

        {/* List of 3-5 alerts */}
        <div className="divide-y divide-slate-100 mt-2">
          {displayAlerts.length === 0 ? (
            <div className="py-4 space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Authentication successful — <strong className="text-emerald-700 font-mono">ACCEPTED</strong></span>
              </div>
              <div className="flex items-center space-x-2 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Tactical datalink integrity — <strong className="text-emerald-700 font-mono">SECURE</strong></span>
              </div>
              <div className="flex items-center space-x-2 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Nonce freshness verified — <strong className="text-emerald-700 font-mono">PASS</strong></span>
              </div>
            </div>
          ) : (
            displayAlerts.map((threat, idx) => {
              const isBlocked = threat.action === 'BLOCKED' || threat.action === 'REJECTED';
              const dotColor = isBlocked ? 'bg-rose-500' : 'bg-amber-500';
              const actionColor = isBlocked ? 'text-rose-700' : 'text-amber-700';

              return (
                <div key={threat.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`}></span>
                    <span className="text-slate-800 font-medium">
                      {threat.event} —{' '}
                      <span className={`font-mono font-bold ${actionColor}`}>
                        {threat.action}
                      </span>
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono ml-2">
                    {threat.source}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Link to full Security Logs page */}
      <div className="pt-3 border-t border-slate-100 mt-3">
        <button
          onClick={onViewAllLogs}
          className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center space-x-1.5 transition-colors"
        >
          <span>VIEW ALL SECURITY LOGS</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
