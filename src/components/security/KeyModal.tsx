import React from 'react';
import { KeyMetadata } from '../../types/telemetry';
import { KeyRound, X, ShieldCheck, Lock, Clock, Info } from 'lucide-react';

interface KeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: KeyMetadata | null;
}

export const KeyModal: React.FC<KeyModalProps> = ({ isOpen, onClose, metadata }) => {
  if (!isOpen || !metadata) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-100 text-sky-800 rounded-md">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cryptographic Session Key</h3>
              <p className="text-xs text-slate-500 font-mono">Protected In-Memory Secret</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Masked Secret Key Display */}
          <div className="p-4 bg-slate-900 rounded-lg text-white">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>AES-256-GCM SESSION KEY</span>
              <span className="flex items-center text-emerald-400">
                <Lock className="w-3 h-3 mr-1" /> PROTECTED
              </span>
            </div>
            <div className="mt-2 text-xl font-mono tracking-widest text-slate-200 select-none">
              {metadata.masked_key}
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
              Raw 256-bit key bytes are isolated in backend memory and never exposed over the network.
            </div>
          </div>

          {/* Safe Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block uppercase text-[10px] font-bold">Key ID</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{metadata.key_id}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block uppercase text-[10px] font-bold">Algorithm</span>
              <span className="font-semibold text-slate-900 mt-0.5 block">{metadata.algorithm}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block uppercase text-[10px] font-bold">Status</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 mt-0.5">
                {metadata.status}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block uppercase text-[10px] font-bold">Rotation Status</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{metadata.rotation_status}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 col-span-2">
              <span className="text-slate-500 block uppercase text-[10px] font-bold">Purpose</span>
              <span className="font-medium text-slate-800 mt-0.5 block">{metadata.purpose}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 col-span-2">
              <span className="text-slate-500 block uppercase text-[10px] font-bold">Digital Signature Algorithm</span>
              <span className="font-medium text-slate-800 mt-0.5 block">{metadata.signature_algorithm}</span>
            </div>
          </div>

          <div className="p-3 bg-sky-50 border border-sky-200 rounded text-xs text-sky-800 flex items-start space-x-2">
            <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Demonstration Environment Notice:</strong> Dynamic key rotation preserves historical session keys for grace periods while rejecting unknown or corrupted keys.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded text-xs font-semibold hover:bg-slate-700 transition-colors"
          >
            Close Security Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
