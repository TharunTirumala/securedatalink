import React, { useState } from 'react';
import { KeyMetadata } from '../types/telemetry';
import { api } from '../services/api';
import { KeyModal } from '../components/security/KeyModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { KeyRound, Lock, RefreshCw, ShieldCheck, Clock, CheckCircle2, Shield } from 'lucide-react';

interface KeyManagementPageProps {
  keyMetadata: KeyMetadata | null;
  onRefreshData: () => void;
}

export const KeyManagementPage: React.FC<KeyManagementPageProps> = ({
  keyMetadata,
  onRefreshData
}) => {
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isResyncConfirmOpen, setIsResyncConfirmOpen] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);

  const handleResyncConfirm = async () => {
    setIsResyncing(true);
    try {
      await api.resyncKey('OPERATOR-PRIMARY');
      onRefreshData();
    } catch (e) {
      console.error('Failed to resync key:', e);
    } finally {
      setIsResyncing(false);
      setIsResyncConfirmOpen(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Cryptographic Key Management & Lifecycle
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Zero-exposure session key administration, dynamic re-keying, and safe metadata projection
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs font-semibold border border-slate-300 transition-colors"
          >
            AES KEY
          </button>
          <button
            onClick={() => setIsResyncConfirmOpen(true)}
            disabled={isResyncing}
            className="flex items-center space-x-1.5 px-3 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResyncing ? 'animate-spin' : ''}`} />
            <span>KEY RE-SYNC</span>
          </button>
        </div>
      </div>

      {/* Main Key Display Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
        {/* Banner with masked secret */}
        <div className="p-5 rounded-lg bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>AES-256-GCM SESSION KEY</span>
              <span className="text-emerald-400 font-bold">• ACTIVE</span>
            </div>
            <div className="mt-2 text-2xl font-mono tracking-widest text-slate-100 select-none">
              {keyMetadata?.masked_key || '••••••••••••••••••••••••••••••••'}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              The 256-bit symmetric secret key is masked and protected on the backend using secure memory.
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end space-y-1">
            <span className="text-[11px] text-slate-400 uppercase font-mono">Active Key Identifier</span>
            <span className="text-xl font-mono font-bold text-sky-400">
              {keyMetadata?.key_id || 'SK-ALPHA-042'}
            </span>
            <span className="text-xs text-emerald-300 font-semibold">
              Rotation: {keyMetadata?.rotation_status || 'READY'}
            </span>
          </div>
        </div>

        {/* Safe Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Encryption Algorithm</span>
            <span className="text-sm font-bold text-slate-800 mt-1 block">{keyMetadata?.algorithm || 'AES-256-GCM'}</span>
            <span className="text-[11px] text-slate-500 mt-1 block">Galois/Counter Mode with 128-bit GHASH Tag</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Signature Curve</span>
            <span className="text-sm font-bold text-slate-800 mt-1 block">{keyMetadata?.signature_algorithm || 'NIST P-256 (secp256r1)'}</span>
            <span className="text-[11px] text-slate-500 mt-1 block">ECDSA with SHA-256 Digest Non-repudiation</span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Session Status</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-sm font-bold text-emerald-800">{keyMetadata?.status || 'ACTIVE'}</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Next rotation in ~{keyMetadata ? Math.round(keyMetadata.rotation_seconds_remaining / 60) : 60} min</span>
          </div>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-100">
          <div>
            <span className="text-slate-500 font-medium">Last Cryptographic Synchronization:</span>
            <div className="font-mono text-slate-800 font-semibold mt-0.5">
              {keyMetadata?.last_sync ? new Date(keyMetadata.last_sync).toLocaleString() : 'Just now'}
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Session Key Creation Time:</span>
            <div className="font-mono text-slate-800 font-semibold mt-0.5">
              {keyMetadata?.created_at ? new Date(keyMetadata.created_at).toLocaleString() : 'Just now'}
            </div>
          </div>
        </div>
      </div>

      {/* Security Architecture & Policy Notice */}
      <div className="bg-sky-50/70 border border-sky-200 rounded-lg p-5 text-xs text-sky-900 space-y-2">
        <div className="flex items-center space-x-2 font-bold text-sky-950">
          <ShieldCheck className="w-4 h-4 text-sky-700" />
          <span>Tactical Datalink Key Management Policy</span>
        </div>
        <p className="leading-relaxed">
          In compliance with tactical datalink cybersecurity criteria, actual symmetric key materials and ECDSA private keys are isolated inside the backend secure runtime. The UI and external APIs only interface with safe metadata representations. Historical keys are cached during grace periods to prevent out-of-order frame drops while enforcing immediate re-keying on operator command.
        </p>
      </div>

      {/* Key Modal */}
      <KeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        metadata={keyMetadata}
      />

      {/* Confirmation Modal for Key Re-Sync */}
      <ConfirmModal
        isOpen={isResyncConfirmOpen}
        title="Execute Dynamic Key Re-Sync"
        message="Are you sure you want to trigger dynamic session re-keying? This will generate a new AES-256 session key, update the Key ID, and broadcast the change across all tactical channels."
        confirmLabel="Execute Re-Keying"
        confirmVariant="primary"
        onConfirm={handleResyncConfirm}
        onCancel={() => setIsResyncConfirmOpen(false)}
      />
    </div>
  );
};
