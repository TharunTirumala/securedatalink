import React, { useState } from 'react';
import { api } from '../../services/api';
import { ConfirmModal } from '../common/ConfirmModal';
import { Pause, Play, RefreshCw, SlidersHorizontal, Download, ShieldCheck } from 'lucide-react';

interface OperatorControlsProps {
  streamStatus: string;
  onActionComplete: () => void;
  onOpenKeyModal: () => void;
}

export const OperatorControls: React.FC<OperatorControlsProps> = ({
  streamStatus,
  onActionComplete,
  onOpenKeyModal
}) => {
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    variant: 'primary',
    action: async () => {},
  });

  const handlePauseResume = () => {
    const isPaused = streamStatus === 'PAUSED';
    setModalConfig({
      isOpen: true,
      title: isPaused ? 'Resume Telemetry Stream' : 'Pause Telemetry Stream',
      message: isPaused
        ? 'Are you sure you want to resume telemetry ingestion and pipeline verification?'
        : 'Pausing the stream will temporarily halt tactical packet verification and C2 output forwarding.',
      confirmLabel: isPaused ? 'Resume Stream' : 'Pause Stream',
      variant: isPaused ? 'primary' : 'warning',
      action: async () => {
        if (isPaused) {
          await api.resumeStream();
        } else {
          await api.pauseStream();
        }
        onActionComplete();
      },
    });
  };

  const handleKeyResync = () => {
    setModalConfig({
      isOpen: true,
      title: 'Cryptographic Key Re-Sync',
      message: 'This will dynamically rotate the active AES-256-GCM session key across the tactical datalink and generate a new Key ID. Active UAVs and relays will synchronize immediately.',
      confirmLabel: 'Re-Sync Session Key',
      variant: 'primary',
      action: async () => {
        await api.resyncKey();
        onActionComplete();
      },
    });
  };

  const handleExport = (format: 'csv' | 'json') => {
    window.open(api.getLogExportUrl(format), '_blank');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-sky-700" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Operator Tactical Controls
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">OPERATOR-PRIMARY SESSION</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {/* Pause/Resume Stream */}
        <button
          onClick={handlePauseResume}
          className={`flex items-center justify-center space-x-2 px-3 py-2.5 rounded-md text-xs font-bold border transition-colors ${
            streamStatus === 'PAUSED'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-sm'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
          }`}
        >
          {streamStatus === 'PAUSED' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          <span>{streamStatus === 'PAUSED' ? 'RESUME STREAM' : 'PAUSE STREAM'}</span>
        </button>

        {/* Key Re-Sync */}
        <button
          onClick={handleKeyResync}
          className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-md text-xs font-bold bg-sky-700 hover:bg-sky-800 text-white shadow-sm border border-sky-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>KEY RE-SYNC</span>
        </button>

        {/* Inspect AES Key Safe Modal */}
        <button
          onClick={onOpenKeyModal}
          className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-md text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
        >
          <span>AES KEY</span>
        </button>

        {/* Export Log */}
        <button
          onClick={() => handleExport('csv')}
          className="flex items-center justify-center space-x-2 px-3 py-2.5 rounded-md text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>EXPORT LOG</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmLabel={modalConfig.confirmLabel}
        confirmVariant={modalConfig.variant}
        onConfirm={async () => {
          await modalConfig.action();
          setModalConfig({ ...modalConfig, isOpen: false });
        }}
        onCancel={() => setModalConfig({ ...modalConfig, isOpen: false })}
      />
    </div>
  );
};
