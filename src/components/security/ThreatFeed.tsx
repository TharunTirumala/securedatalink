import React from 'react';
import { ThreatEvent } from '../../types/telemetry';
import { Badge } from '../common/Badge';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface ThreatFeedProps {
  threats: ThreatEvent[];
  limit?: number;
}

export const ThreatFeed: React.FC<ThreatFeedProps> = ({ threats, limit = 10 }) => {
  const displayThreats = limit ? threats.slice(0, limit) : threats;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Live Threat Detection Feed
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          {threats.length} Total Incidents
        </span>
      </div>

      <div className="divide-y divide-slate-150 flex-1 overflow-y-auto max-h-[360px]">
        {displayThreats.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No active threat events detected. Tactical perimeter secure.
          </div>
        ) : (
          displayThreats.map((threat, index) => {
            const timeStr = threat.timestamp
              ? new Date(threat.timestamp).toLocaleTimeString()
              : 'LIVE';

            return (
              <div key={threat.id || index} className="p-3 hover:bg-slate-50 transition-colors text-xs">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge label={threat.severity} type="severity" />
                    <span className="font-mono font-bold text-slate-800">
                      {threat.packet_id}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-medium text-slate-600">{threat.source}</span>
                  </div>
                  <Badge label={threat.action} type="action" />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-slate-700">
                  <span className="font-medium">{threat.event}</span>
                  <span className="font-mono text-[10px] text-slate-400">{timeStr}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
