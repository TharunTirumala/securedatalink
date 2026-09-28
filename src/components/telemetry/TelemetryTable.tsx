import React from 'react';
import { Packet } from '../../types/telemetry';
import { Badge } from '../common/Badge';
import { Radio } from 'lucide-react';
import { formatTime } from '../../utils/formatters';

interface TelemetryTableProps {
  packets: Packet[];
  onSelectPacket?: (packet: Packet) => void;
  title?: string;
  limit?: number;
}

export const TelemetryTable: React.FC<TelemetryTableProps> = ({
  packets,
  onSelectPacket,
  title = 'Live Tactical Telemetry Stream',
  limit
}) => {
  const displayPackets = limit ? packets.slice(0, limit) : packets;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <Radio className="w-4 h-4 text-sky-700" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Showing {displayPackets.length} packets
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Packet ID</th>
              <th className="py-2.5 px-3">Source</th>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Authentication</th>
              <th className="py-2.5 px-3">Freshness</th>
              <th className="py-2.5 px-3">Integrity</th>
              <th className="py-2.5 px-3">Classification</th>
              <th className="py-2.5 px-3">Trust Score</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {displayPackets.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400">
                  No packets processed yet. Click Start Demo to begin.
                </td>
              </tr>
            ) : (
              displayPackets.map((pkt) => {
                const timeStr = formatTime(pkt.timestamp);
                const isThreat = pkt.action === 'BLOCKED';

                return (
                  <tr
                    key={pkt.packet_id + (pkt.id || '')}
                    onClick={() => onSelectPacket && onSelectPacket(pkt)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      isThreat ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 flex items-center space-x-1">
                      <span>#{pkt.sequence_num || pkt.packet_id.replace('PKT-', '')}</span>
                      {pkt.simulated ? (
                        <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                          SIMULATOR
                        </span>
                      ) : pkt.packet_type?.toUpperCase().includes('CSV') ? (
                        <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                          CSV
                        </span>
                      ) : pkt.packet_type?.toUpperCase().includes('JSON') ? (
                        <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-semibold border border-sky-200">
                          JSON
                        </span>
                      ) : (
                        <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200">
                          IMPORTED
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">
                      {pkt.source}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {timeStr}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {pkt.packet_type}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge label={pkt.auth_status} type="verification" />
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge label={pkt.freshness_status} type="verification" />
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge label={pkt.integrity_status} type="verification" />
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge label={pkt.classification} type="classification" />
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`font-mono font-bold ${
                        pkt.trust_score >= 75 ? 'text-emerald-700' : pkt.trust_score >= 50 ? 'text-amber-700' : 'text-rose-700'
                      }`}>
                        {pkt.trust_score}/100
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge label={pkt.action} type="action" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
