import React from 'react';
import { Packet } from '../../types/telemetry';

interface SimpleTelemetryFeedProps {
  packets: Packet[];
  simulatorActive: boolean;
  onSelectPacket: (packet: Packet) => void;
}

export const SimpleTelemetryFeed: React.FC<SimpleTelemetryFeedProps> = ({
  packets,
  simulatorActive,
  onSelectPacket
}) => {
  // STRICT CAP: Show ONLY THE 10 LATEST PACKETS, newest at the top
  const displayPackets = packets.slice(0, 10);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden w-full">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-2">
        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-wide uppercase truncate">
            REAL-TIME TELEMETRY AUTHENTICATION FEED
          </h2>
          <div className="flex items-center space-x-2 mt-0.5 whitespace-nowrap">
            {simulatorActive ? (
              <span className="text-xs font-semibold text-amber-700 flex items-center">
                <span className="relative flex h-2 w-2 mr-1.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                LIVE • SIMULATION MODE
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-600 flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 flex-shrink-0"></span>
                LIVE • STANDBY
              </span>
            )}
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-slate-500 font-mono">
              Latest 10 packets ({displayPackets.length}/10)
            </span>
          </div>
        </div>
      </div>

      {/* 6-Column Simple Table with Fixed Layout for Cross-Browser Parity */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs border-collapse table-fixed min-w-[620px]">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3.5 font-mono whitespace-nowrap truncate">PACKET</th>
              <th className="py-2.5 px-3.5 whitespace-nowrap truncate">SOURCE</th>
              <th className="py-2.5 px-3.5 whitespace-nowrap truncate">TIME</th>
              <th className="py-2.5 px-3.5 whitespace-nowrap truncate">AUTHENTICATION</th>
              <th className="py-2.5 px-3.5 whitespace-nowrap truncate">TRUST</th>
              <th className="py-2.5 px-3.5 text-right whitespace-nowrap truncate">RESULT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150">
            {displayPackets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Awaiting incoming telemetry packets... Click "START DEMO" or transmit UDP:9871.
                </td>
              </tr>
            ) : (
              displayPackets.map((pkt, idx) => {
                const timeStr = new Date(pkt.timestamp * 1000).toTimeString().slice(0, 8);
                const isBlocked = pkt.action === 'BLOCKED' || pkt.action === 'REJECTED';
                const isAuth = pkt.auth_status === 'VERIFIED';

                let trustColor = 'text-emerald-700';
                if (pkt.trust_score < 50) trustColor = 'text-rose-700 font-bold';
                else if (pkt.trust_score < 75) trustColor = 'text-amber-700 font-bold';

                return (
                  <tr
                    key={pkt.packet_id + (pkt.id || idx)}
                    onClick={() => onSelectPacket(pkt)}
                    className={`hover:bg-sky-50/50 cursor-pointer transition-colors h-10 ${
                      isBlocked ? 'bg-rose-50/20' : idx === 0 ? 'bg-sky-50/20' : ''
                    }`}
                  >
                    {/* PACKET */}
                    <td className="py-2 px-3.5 font-mono font-bold text-slate-900 truncate">
                      <div className="flex items-center space-x-1.5 truncate">
                        <span className="text-sky-800 truncate">
                          #{pkt.sequence_num || pkt.packet_id.replace('PKT-', '')}
                        </span>
                        {idx === 0 && (
                          <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold flex-shrink-0">
                            NEW
                          </span>
                        )}
                      </div>
                    </td>

                    {/* SOURCE */}
                    <td className="py-2 px-3.5 font-semibold text-slate-800 truncate">
                      {pkt.source}
                    </td>

                    {/* TIME */}
                    <td className="py-2 px-3.5 font-mono text-slate-600 truncate">
                      {timeStr}
                    </td>

                    {/* AUTHENTICATION */}
                    <td className="py-2 px-3.5 truncate">
                      {isAuth ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                          FAILED
                        </span>
                      )}
                    </td>

                    {/* TRUST */}
                    <td className={`py-2 px-3.5 font-mono font-bold text-xs truncate ${trustColor}`}>
                      {pkt.trust_score}/100
                    </td>

                    {/* RESULT */}
                    <td className="py-2 px-3.5 text-right truncate">
                      {pkt.action === 'ACCEPTED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                          ACCEPTED
                        </span>
                      ) : pkt.action === 'BLOCKED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap">
                          BLOCKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                          FILTERED
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
        <span className="truncate">Click any packet to inspect verification details</span>
        <span className="font-mono text-slate-400 whitespace-nowrap">Strictly capped at latest 10 packets</span>
      </div>
    </div>
  );
};
