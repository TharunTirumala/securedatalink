import React from 'react';
import { ThreatEvent, Packet } from '../../types/telemetry';
import { ArrowRight, ShieldCheck } from 'lucide-react';

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
  // Real security alerts: take threats, plus any packets that were blocked/rejected/filtered
  const alerts: Array<{ text: string; action: string; key: string }> = [];

  threats.slice(0, 5).forEach((t, i) => {
    alerts.push({
      text: t.event || `Security anomaly detected on ${t.source}`,
      action: t.action || 'BLOCKED',
      key: `threat-${t.id ?? i}-${t.packet_id}`,
    });
  });

  if (alerts.length < 5) {
    const droppedPackets = packets
      .filter((p) => p.action === 'BLOCKED' || p.action === 'REJECTED' || p.action === 'FILTERED')
      .slice(0, 5 - alerts.length);

    droppedPackets.forEach((p) => {
      alerts.push({
        text: `${p.classification} from ${p.source}`,
        action: p.action,
        key: `packet-${p.packet_id}`,
      });
    });
  }

  const getActionStyles = (action: string) => {
    switch (action) {
      case 'BLOCKED':
        return { dot: 'bg-rose-500', text: 'text-rose-700' };
      case 'REJECTED':
        return { dot: 'bg-amber-500', text: 'text-amber-700' };
      case 'FILTERED':
        return { dot: 'bg-purple-500', text: 'text-purple-700' };
      default:
        return { dot: 'bg-emerald-500', text: 'text-emerald-700' };
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between w-full h-full min-h-[220px]">
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 font-mono">
          SECURITY ALERTS
        </h3>

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="flex items-center space-x-2 text-xs text-slate-500 py-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No security threats recorded. Tactical perimeter nominal.</span>
            </div>
          ) : (
            alerts.map((alert) => {
              const styles = getActionStyles(alert.action);
              return (
                <div key={alert.key} className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 truncate mr-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`}></span>
                    <span className="text-slate-800 font-medium truncate">
                      {alert.text}
                    </span>
                  </div>
                  <span className={`font-mono font-bold text-[11px] shrink-0 ${styles.text}`}>
                    — {alert.action}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-slate-100">
        {onNavigateToLogs ? (
          <button
            type="button"
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
