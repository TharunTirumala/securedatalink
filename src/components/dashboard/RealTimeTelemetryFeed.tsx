import React from 'react';
import { Packet } from '../../types/telemetry';

interface RealTimeTelemetryFeedProps {
  packets: Packet[];
  simulatorActive: boolean;
  onSelectPacket: (packet: Packet) => void;
}

export const RealTimeTelemetryFeed: React.FC<RealTimeTelemetryFeedProps> = ({
  packets,
  simulatorActive,
  onSelectPacket
}) => {
  // STRICT REQUIREMENT: Keep only the latest 10 packets, newest at the top
  const latestTen = packets.slice(0, 10);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden w-full min-w-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-wide">
            REAL-TIME TELEMETRY AUTHENTICATION FEED
          </h2>
          <div className="text-xs font-semibold mt-0.5 flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${simulatorActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
            <span className={simulatorActive ? 'text-emerald-700' : 'text-slate-500'}>
              {simulatorActive ? 'LIVE • SIMULATION MODE' : 'LIVE • STANDBY'}
            </span>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Showing latest {latestTen.length} / 10 packets
        </span>
      </div>

      {/* 6-Column Simple Table */}
      <div className="overflow-x-auto w-full contain-scroll-x">
        <table className="w-full text-left text-xs table-fixed">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100">
            <tr>
              <th className="py-2.5 px-4 font-mono w-[16%]">PACKET</th>
              <th className="py-2.5 px-4 w-[20%]">SOURCE</th>
              <th className="py-2.5 px-4 font-mono w-[16%]">TIME</th>
              <th className="py-2.5 px-4 w-[18%]">AUTHENTICATION</th>
              <th className="py-2.5 px-4 font-mono w-[14%]">TRUST</th>
              <th className="py-2.5 px-4 text-right w-[16%]">RESULT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {latestTen.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No packets processed yet. Click Start Demo to begin.
                </td>
              </tr>
            ) : (
              latestTen.map((pkt, idx) => {
                const timeStr = new Date(pkt.timestamp * 1000).toTimeString().slice(0, 8);
                const isVerified = pkt.auth_status === 'VERIFIED' || pkt.action === 'ACCEPTED';
                const isAccepted = pkt.action === 'ACCEPTED';

                return (
                  <tr
                    key={pkt.packet_id + (pkt.id || idx)}
                    onClick={() => onSelectPacket(pkt)}
                    className="hover:bg-sky-50/40 cursor-pointer transition-colors"
                  >
                    {/* PACKET */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span>#{pkt.sequence_num || pkt.packet_id.replace('PKT-', '')}</span>
                        {idx === 0 && (
                          <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                            NEW
                          </span>
                        )}
                      </div>
                    </td>

                    {/* SOURCE */}
                    <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap truncate">
                      <div className="flex items-center space-x-1.5">
                        <span className="truncate">{pkt.source}</span>
                        {(pkt.simulated === false || pkt.packet_type === "Custom Telemetry") && (
                          <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold border border-indigo-200 shrink-0">
                            CUSTOM
                          </span>
                        )}
                      </div>
                    </td>

                    {/* TIME */}
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {timeStr}
                    </td>

                    {/* AUTHENTICATION */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isVerified ? (
                        <span className="inline-flex items-center text-emerald-700 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                          VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-rose-700 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
                          FAILED
                        </span>
                      )}
                    </td>

                    {/* TRUST */}
                    <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                      <span
                        className={
                          pkt.trust_score >= 75
                            ? 'text-emerald-700'
                            : pkt.trust_score >= 50
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }
                      >
                        {pkt.trust_score}/100
                      </span>
                    </td>

                    {/* RESULT */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {isAccepted ? (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          ACCEPTED
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          BLOCKED
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
      <div className="px-5 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Click any packet to inspect detailed cryptographic verification</span>
      </div>
    </div>
  );
};
