import React from 'react';
import { Packet } from '../../types/telemetry';
import { X, ArrowRight } from 'lucide-react';

interface SimplePacketDetailModalProps {
  packet: Packet | null;
  onClose: () => void;
  onNavigateToVerification?: () => void;
}

export const SimplePacketDetailModal: React.FC<SimplePacketDetailModalProps> = ({
  packet,
  onClose,
  onNavigateToVerification
}) => {
  if (!packet) return null;

  const timeStr = new Date(packet.timestamp * 1000).toTimeString().slice(0, 8);
  const isAuth = packet.auth_status === 'VERIFIED' || packet.action === 'ACCEPTED';
  const isFresh = packet.freshness_status === 'PASS';
  const isIntegrity = packet.integrity_status === 'PASS';
  const isSig = packet.sig_status === 'VERIFIED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Packet Details: #{packet.sequence_num || packet.packet_id.replace('PKT-', '')}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">
              ID: {packet.packet_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5 text-xs">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded border border-slate-200/80">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Source</span>
              <span className="font-semibold text-slate-800 text-xs">{packet.source}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Timestamp</span>
              <span className="font-mono text-slate-700 text-xs">{timeStr}</span>
            </div>
          </div>

          {/* Verification Attributes */}
          <div className="space-y-2 border-t border-b border-slate-100 py-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Authentication:</span>
              <span className={`font-bold font-mono ${isAuth ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isAuth ? 'VERIFIED' : 'FAILED'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Freshness:</span>
              <span className={`font-bold font-mono ${isFresh ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isFresh ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Integrity:</span>
              <span className={`font-bold font-mono ${isIntegrity ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isIntegrity ? 'PASS' : 'FAIL'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Signature:</span>
              <span className={`font-bold font-mono ${isSig ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isSig ? 'VERIFIED' : 'FAILED'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Trust Score:</span>
              <span className={`font-bold font-mono ${packet.trust_score >= 75 ? 'text-emerald-700' : packet.trust_score >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>
                {packet.trust_score}/100
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Classification:</span>
              <span className="font-bold text-slate-800">
                {packet.classification}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Action:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                packet.action === 'ACCEPTED'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {packet.action}
              </span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-1">
            {onNavigateToVerification && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToVerification();
                }}
                className="inline-flex items-center text-xs font-semibold text-sky-700 hover:text-sky-900 transition-colors"
              >
                <span>Full Packet Verification</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            )}
            <button
              onClick={onClose}
              className="ml-auto px-3.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
