import React from 'react';
import { Packet } from '../../types/telemetry';
import { CheckCircle2, Terminal } from 'lucide-react';
import { Badge } from '../common/Badge';

interface TrustedC2FeedProps {
  packets: Packet[];
  limit?: number;
}

export const TrustedC2Feed: React.FC<TrustedC2FeedProps> = ({ packets, limit = 6 }) => {
  const trustedPackets = packets.filter((p) => p.action === 'ACCEPTED').slice(0, limit);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Trusted C2 Output Dispatch
          </h3>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          EGRESS NOMINAL
        </span>
      </div>

      <div className="divide-y divide-slate-150 flex-1 overflow-y-auto max-h-[360px]">
        {trustedPackets.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Awaiting verified packets for C2 transmission...
          </div>
        ) : (
          trustedPackets.map((pkt, index) => {
            const timeStr = new Date(pkt.timestamp * 1000).toTimeString().slice(0, 8);

            return (
              <div key={pkt.packet_id + index} className="p-3 hover:bg-slate-50 transition-colors text-xs">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-900">
                      #{pkt.sequence_num || pkt.packet_id.replace('PKT-', '')}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-slate-700">{pkt.source}</span>
                  </div>
                  <Badge label="FORWARDED" type="action" />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-slate-600">
                  <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                    <Terminal className="w-3 h-3 text-emerald-600" />
                    <span>Target: TACTICAL_BUS_01</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-700 font-semibold">{pkt.latency_ms.toFixed(1)}ms</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">{timeStr}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 font-mono flex justify-between">
        <span>Channel: SECURE_UDP/TLS</span>
        <span>Clearance: AES-256-GCM + NIST P-256</span>
      </div>
    </div>
  );
};
