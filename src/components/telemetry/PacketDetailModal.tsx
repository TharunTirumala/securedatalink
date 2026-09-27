import React from 'react';
import { Packet } from '../../types/telemetry';
import { Badge } from '../common/Badge';
import { X, Lock, CheckCircle2, XCircle, Shield, FileCode, Radio, Cpu } from 'lucide-react';

interface PacketDetailModalProps {
  packet: Packet | null;
  onClose: () => void;
}

export const PacketDetailModal: React.FC<PacketDetailModalProps> = ({ packet, onClose }) => {
  if (!packet) return null;

  const payload = packet.decrypted_payload;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xl max-w-2xl w-full my-8 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-sky-100 text-sky-800 rounded">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Packet Inspector: {packet.packet_id}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Source: {packet.source} • Sequence #{packet.sequence_num}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge label={packet.classification} type="classification" />
            <Badge label={packet.action} type="action" />
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Trust Score & Latency */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Trust Score</span>
              <span className={`text-lg font-mono font-bold ${
                packet.trust_score >= 75 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {packet.trust_score} / 100
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Latency</span>
              <span className="text-lg font-mono font-bold text-slate-800">
                {packet.latency_ms} ms
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Session Key</span>
              <span className="text-sm font-mono font-bold text-slate-800">
                {packet.key_id}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Mode</span>
              <span className="text-sm font-medium text-slate-700">
                {packet.simulated ? 'Simulated Demo' : 'Live Ingestion'}
              </span>
            </div>
          </div>

          {/* Verification Breakdown */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Cryptographic & Freshness Verifications
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <span className="text-slate-600 font-medium">AES-256-GCM Tag Check:</span>
                <Badge label={packet.auth_status} type="verification" />
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <span className="text-slate-600 font-medium">Dynamic Freshness:</span>
                <Badge label={packet.freshness_status} type="verification" />
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <span className="text-slate-600 font-medium">ECDSA P-256 Signature:</span>
                <Badge label={packet.sig_status} type="verification" />
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                <span className="text-slate-600 font-medium">SHA-256 Integrity Digest:</span>
                <Badge label={packet.integrity_status} type="verification" />
              </div>
            </div>
          </div>

          {/* Cryptographic Field Values */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Raw Cryptographic Elements
            </span>
            <div className="p-3 bg-slate-900 rounded font-mono text-[11px] text-slate-300 space-y-1.5 overflow-x-auto">
              <div>
                <span className="text-sky-400">IV / Nonce (96-bit):</span> {packet.iv_hex || 'N/A'}
              </div>
              <div>
                <span className="text-emerald-400">GCM Auth Tag (128-bit):</span> {packet.tag_hex || 'N/A'}
              </div>
              <div>
                <span className="text-amber-400">Payload Hash (SHA-256):</span> {packet.payload_hash || 'N/A'}
              </div>
              <div className="truncate">
                <span className="text-purple-400">Ciphertext Preview:</span> {packet.ciphertext_preview || 'N/A'}
              </div>
              <div className="truncate">
                <span className="text-slate-400">Signature Preview:</span> {packet.signature_hex || 'N/A'}
              </div>
            </div>
          </div>

          {/* Decrypted Telemetry (if authentic) */}
          {payload && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Decrypted Telemetry Data Units
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-2 bg-white border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-bold">LATITUDE</span>
                  <span className="font-mono font-bold text-slate-800">{payload.latitude}°</span>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-bold">LONGITUDE</span>
                  <span className="font-mono font-bold text-slate-800">{payload.longitude}°</span>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-bold">ALTITUDE</span>
                  <span className="font-mono font-bold text-slate-800">{payload.altitude_m} m</span>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-bold">SPEED</span>
                  <span className="font-mono font-bold text-slate-800">{payload.speed_mps} m/s</span>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-bold">HEADING</span>
                  <span className="font-mono font-bold text-slate-800">{payload.heading_deg}°</span>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded">
                  <span className="text-slate-400 block text-[10px] font-bold">BATTERY BUS</span>
                  <span className="font-mono font-bold text-emerald-700">{payload.battery_pct}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
