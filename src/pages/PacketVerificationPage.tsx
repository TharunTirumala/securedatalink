import React, { useState } from 'react';
import { Packet } from '../types/telemetry';
import { Badge } from '../components/common/Badge';
import {
  Lock,
  Clock,
  Key,
  ShieldCheck,
  Hash,
  RefreshCw
} from 'lucide-react';

interface PacketVerificationPageProps {
  packets: Packet[];
  onRefreshData?: () => void;
  initialPacketId?: string | null;
}

export const PacketVerificationPage: React.FC<PacketVerificationPageProps> = ({
  packets,
  onRefreshData,
  initialPacketId
}) => {
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(initialPacketId || null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  React.useEffect(() => {
    if (initialPacketId) {
      setSelectedPacketId(initialPacketId);
    }
  }, [initialPacketId]);

  const handleRefresh = async () => {
    if (onRefreshData) {
      setIsRefreshing(true);
      try {
        await onRefreshData();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  const activePacket = (selectedPacketId ? packets.find(p => p.packet_id === selectedPacketId) : null) || packets[0];

  const totalEvaluated = packets.length;
  const acceptedCount = packets.filter(p => p.action === 'ACCEPTED').length;
  const blockedCount = packets.filter(p => p.action === 'BLOCKED' || p.action === 'REJECTED' || p.action === 'FILTERED').length;
  const avgTrust = totalEvaluated > 0
    ? Math.round(packets.reduce((acc, p) => acc + (p.trust_score || 0), 0) / totalEvaluated)
    : 100;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Packet Verification & Cryptographic Deep Dive
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Step-by-step cryptographic verification: Nonce freshness, AES-256-GCM, ECDSA P-256, and SHA-256 digest
          </p>
        </div>
        {onRefreshData && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-xs transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            title="Synchronize packet verification list with backend"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>
        )}
      </div>

      {/* 4 Summary Verification Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">EVALUATED</span>
          <span className="text-lg font-bold font-mono text-slate-900 leading-tight mt-1 block">
            {totalEvaluated} PACKETS
          </span>
        </div>
        <div className="bg-white border border-emerald-200 rounded-lg p-3.5 shadow-xs bg-emerald-50/40">
          <span className="text-[10px] font-bold text-emerald-700 uppercase font-mono block">VERIFIED / ACCEPTED</span>
          <span className="text-lg font-bold font-mono text-emerald-700 leading-tight mt-1 block">
            {acceptedCount}
          </span>
        </div>
        <div className="bg-white border border-rose-200 rounded-lg p-3.5 shadow-xs bg-rose-50/40">
          <span className="text-[10px] font-bold text-rose-700 uppercase font-mono block">THREATS BLOCKED</span>
          <span className="text-lg font-bold font-mono text-rose-700 leading-tight mt-1 block">
            {blockedCount}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">AVG TRUST SCORE</span>
          <span className={`text-lg font-bold font-mono leading-tight mt-1 block ${
            avgTrust >= 75 ? 'text-emerald-700' : avgTrust >= 50 ? 'text-amber-700' : 'text-rose-700'
          }`}>
            {avgTrust}/100
          </span>
        </div>
      </div>

      {packets.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-lg text-slate-400 text-sm">
          No packets processed yet. Click Start Demo to begin.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Packet Selector List */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-2 h-[680px] flex flex-col">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Packet to Inspect ({packets.length})
            </h3>
            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {packets.slice(0, 50).map((pkt) => {
                const isSelected = activePacket?.packet_id === pkt.packet_id;
                return (
                  <button
                    key={pkt.packet_id}
                    onClick={() => setSelectedPacketId(pkt.packet_id)}
                    className={`w-full text-left p-3 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected ? 'bg-sky-50 border border-sky-200' : 'hover:bg-slate-50'
                    }`}
                  >
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-xs text-slate-900">{pkt.packet_id}</span>
                      {pkt.simulated ? (
                        <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                          SIM
                        </span>
                      ) : pkt.packet_type?.toUpperCase().includes('CSV') ? (
                        <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                          CSV
                        </span>
                      ) : pkt.packet_type?.toUpperCase().includes('JSON') ? (
                        <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-sky-100 text-sky-800 font-semibold border border-sky-200">
                          JSON
                        </span>
                      ) : (
                        <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200">
                          IMP
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">{pkt.source}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge label={pkt.classification} type="classification" />
                    <div className="text-[10px] font-mono text-slate-400">
                      Trust: {pkt.trust_score}/100
                    </div>
                  </div>
                </button>
              );
            })}
            </div>
          </div>

          {/* Detailed Verification Inspector */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5">
            {/* Header info */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold">Active Frame</span>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-slate-900 font-mono">{activePacket.packet_id}</h2>
                  {activePacket.simulated ? (
                    <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      SIMULATOR SOURCE
                    </span>
                  ) : activePacket.packet_type?.toUpperCase().includes('CSV') ? (
                    <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
                      CSV IMPORTED
                    </span>
                  ) : activePacket.packet_type?.toUpperCase().includes('JSON') ? (
                    <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold border border-sky-200">
                      JSON IMPORTED
                    </span>
                  ) : (
                    <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold border border-indigo-200">
                      IMPORTED TELEMETRY
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Node: <span className="font-semibold text-slate-700">{activePacket.source}</span> • Key ID: <span className="font-mono text-sky-700 font-semibold">{activePacket.key_id}</span>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-1.5">
                <Badge label={activePacket.classification} type="classification" />
                <Badge label={activePacket.action} type="action" />
              </div>
            </div>

            {/* Verification Reason Banner */}
            {activePacket.reason && (
              <div className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 ${
                activePacket.action === 'ACCEPTED'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${
                  activePacket.action === 'ACCEPTED' ? 'text-emerald-600' : 'text-rose-600'
                }`} />
                <div>
                  <span className="font-bold">Evaluation Decision: </span>
                  <span>{activePacket.reason}</span>
                </div>
              </div>
            )}

            {/* Stage-by-stage verification panels */}
            <div className="space-y-4">
              {/* 1. Freshness & Dynamic Nonce */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-sky-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase">1. Dynamic Nonce & Freshness Verification</span>
                  </div>
                  <Badge label={activePacket.freshness_status} type="verification" />
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  Verifies that the packet timestamp falls within the authorized 5.0-second sliding window and that the IV/nonce has not been replayed.
                </p>
                <div className="font-mono text-[11px] bg-white p-2.5 rounded border border-slate-200 text-slate-700">
                  IV / Nonce: <span className="text-sky-700 font-bold">{activePacket.iv_hex || 'N/A'}</span>
                </div>
              </div>

              {/* 2. AES-256-GCM Authenticated Decryption */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase">2. AES-256-GCM Tag & Decryption</span>
                  </div>
                  <Badge label={activePacket.auth_status} type="verification" />
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  Validates the 128-bit GHASH authentication tag using the active AES-256 session key. Any single-bit alteration triggers an authentication failure.
                </p>
                <div className="space-y-1.5 font-mono text-[11px] bg-white p-2.5 rounded border border-slate-200 text-slate-700">
                  <div>Auth Tag: <span className="text-emerald-700 font-bold">{activePacket.tag_hex || 'N/A'}</span></div>
                  <div className="truncate">Ciphertext: <span className="text-slate-500">{activePacket.ciphertext_preview || 'N/A'}</span></div>
                </div>
              </div>

              {/* 3. ECDSA NIST P-256 Signature */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Key className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase">3. ECDSA Digital Signature (NIST P-256)</span>
                  </div>
                  <Badge label={activePacket.sig_status} type="verification" />
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  Validates non-repudiation and node identity against the registered public key for {activePacket.source}.
                </p>
                <div className="font-mono text-[11px] bg-white p-2.5 rounded border border-slate-200 text-slate-700 truncate">
                  Signature: <span className="text-amber-700">{activePacket.signature_hex || 'N/A'}</span>
                </div>
              </div>

              {/* 4. SHA-256 Integrity Verification */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Hash className="w-4 h-4 text-purple-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase">4. Cryptographic Integrity Digest (SHA-256)</span>
                  </div>
                  <Badge label={activePacket.integrity_status} type="verification" />
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  Re-computes the SHA-256 hash of the decrypted payload and verifies equivalence with the header-declared digest.
                </p>
                <div className="font-mono text-[11px] bg-white p-2.5 rounded border border-slate-200 text-slate-700 truncate">
                  Digest: <span className="text-purple-700 font-bold">{activePacket.payload_hash || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
