import React from 'react';
import { Packet } from '../../types/telemetry';
import { X, ShieldCheck, ShieldAlert, ArrowRight } from 'lucide-react';

interface SimplePacketModalProps {
  packet: Packet | null;
  onClose: () => void;
  onNavigateToVerification?: () => void;
}

export const SimplePacketModal: React.FC<SimplePacketModalProps> = ({
  packet,
  onClose,
  onNavigateToVerification
}) => {
  if (!packet) return null;

  const isAccepted = packet.action === 'ACCEPTED';
  const isAuth = packet.auth_status === 'VERIFIED';
  const isSig = packet.sig_status === 'VERIFIED';
  const isFresh = packet.freshness_status === 'PASS';
  const isIntegrity = packet.integrity_status === 'PASS';

  const timeStr = new Date(packet.timestamp * 1000).toLocaleString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2">
            {isAccepted ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Packet Detail #{packet.sequence_num || packet.packet_id.replace('PKT-', '')}
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {packet.packet_id}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Metadata Block */}
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Source</span>
              <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{packet.source}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Timestamp</span>
              <span className="font-mono text-slate-700 text-xs mt-0.5 block">{timeStr}</span>
            </div>
          </div>

          {/* Verification Checks */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Security Verifications
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-150">
                <span className="text-slate-600 font-medium">Authentication</span>
                <span className={`font-mono font-bold ${isAuth ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {isAuth ? 'VERIFIED' : 'FAILED'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-150">
                <span className="text-slate-600 font-medium">Signature</span>
                <span className={`font-mono font-bold ${isSig ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {isSig ? 'VERIFIED' : 'FAILED'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-150">
                <span className="text-slate-600 font-medium">Freshness</span>
                <span className={`font-mono font-bold ${isFresh ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {isFresh ? 'PASS' : 'FAIL'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-150">
                <span className="text-slate-600 font-medium">Integrity</span>
                <span className={`font-mono font-bold ${isIntegrity ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {isIntegrity ? 'PASS' : 'FAIL'}
                </span>
              </div>
            </div>
          </div>

          {/* Decision Outcome */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">Trust Score:</span>
              <span className="font-mono font-bold text-sm text-slate-900">
                {packet.trust_score}/100
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">Classification:</span>
              <span className="font-mono font-bold text-slate-800">
                {packet.classification}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="font-semibold text-slate-600">Final Action:</span>
              <span className={`font-bold font-mono px-2 py-0.5 rounded text-xs ${
                isAccepted
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {packet.action}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {onNavigateToVerification ? (
            <button
              onClick={() => {
                onClose();
                onNavigateToVerification();
              }}
              className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center space-x-1"
            >
              <span>VIEW IN PACKET VERIFICATION</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div></div>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
