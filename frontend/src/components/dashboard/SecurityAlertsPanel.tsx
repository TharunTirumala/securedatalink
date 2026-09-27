import React from 'react';
import { ThreatEvent, Packet } from '../../types/telemetry';
import { ArrowRight } from 'lucide-react';

interface SecurityAlertsPanelProps {
  threats: ThreatEvent[];
  packets: Packet[];
  onNavigateToLogs?: () => void;
}

export const SecurityAlertsPanel: React.FC<SecurityAlertsPanelProps> = ({
  threats,
  packets,
  onNavigateToLogs
}) => {
  const alerts: Array<{ text: string; action: string; isThreat: boolean }> = [];

  threats.slice(0, 4).forEach((t) => {
    alerts.push({
      text: t.event || `Security threat detected on ${t.source}`,
      action: t.action || 'BLOCKED',
      isThreat: true
    });
  });

  if (alerts.length < 4) {
    const authenticPackets = packets.filter((p) => p.action === 'ACCEPTED').slice(0, 4 - alerts.length);
    authenticPackets.forEach((p) => {
      alerts.push({
        text: `Authentication successful on ${p.source}`,
        action: 'ACCEPTED',
        isThreat: false
      });
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between w-full h-full min-h-[220px]">
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 font-mono">
          SECURITY ALERTS
        </h3>

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-xs text-slate-400 py-3">
              No security alerts recorded. Tactical perimeter nominal.
            </div>
          ) : (
            alerts.slice(0, 5).map((alert, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      alert.action === 'BLOCKED' ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                  ></span>
                  <span className="text-slate-800 font-medium">
                    {alert.text}
                  </span>
                </div>
                <span
                  className={`font-mono font-bold text-[11px] ${
                    alert.action === 'BLOCKED' ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  — {alert.action}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-slate-100">
        {onNavigateToLogs ? (
          <button
            onClick={onNavigateToLogs}
            className="inline-flex items-center text-xs font-bold text-sky-700 hover:text-sky-900 transition-colors"
          >
            <span>VIEW ALL SECURITY LOGS</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        ) : (
          <span className="text-xs font-bold text-slate-400">VIEW ALL SECURITY LOGS →</span>
        )}
      </div>
    </div>
  );
};
