import React from 'react';
import { Packet } from '../../types/telemetry';
import { ArrowRight } from 'lucide-react';
import { formatTime } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { SourceBadge } from '../common/SourceBadge';

interface SimplePacketDetailModalProps {
  packet: Packet | null;
  onClose: () => void;
  onNavigateToVerification?: (packetId?: string) => void;
}

export const SimplePacketDetailModal: React.FC<SimplePacketDetailModalProps> = ({
  packet,
  onClose,
  onNavigateToVerification
}) => {
  if (!packet) return null;

  const timeStr = formatTime(packet.timestamp);

  const title = (
    <div>
      <h3 className="text-sm font-bold text-slate-900">
        Packet Details: #{packet.sequence_num || packet.packet_id.replace('PKT-', '')}
      </h3>
      <p className="text-[11px] text-slate-500 font-mono">
        ID: {packet.packet_id}
      </p>
    </div>
  );

  return (
    <Modal isOpen={!!packet} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-3.5 text-xs">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded border border-slate-200/80">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Source</span>
            <SourceBadge source={packet.source} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Timestamp</span>
            <span className="font-mono text-slate-700 text-xs">{timeStr}</span>
          </div>
        </div>

        {/* Verification Attributes */}
        <div className="space-y-2 border-t border-b border-slate-100 py-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Authentication:</span>
            <Badge label={packet.auth_status} type="verification" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Freshness:</span>
            <Badge label={packet.freshness_status} type="verification" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Integrity:</span>
            <Badge label={packet.integrity_status} type="verification" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Signature:</span>
            <Badge label={packet.sig_status} type="verification" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Trust Score:</span>
            <span className={`font-bold font-mono ${packet.trust_score >= 75 ? 'text-emerald-700' : packet.trust_score >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>
              {packet.trust_score}/100
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Classification:</span>
            <Badge label={packet.classification} type="classification" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium">Action:</span>
            <Badge label={packet.action} type="action" />
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-1">
          {onNavigateToVerification && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToVerification(packet.packet_id);
              }}
              className="inline-flex items-center text-xs font-semibold text-sky-700 hover:text-sky-900 transition-colors"
            >
              <span>Full Packet Verification</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-3.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
