import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  disabled?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm Action',
  confirmVariant = 'primary',
  disabled = false,
  children,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const btnClasses = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    primary: 'bg-sky-700 hover:bg-sky-800 text-white',
  }[confirmVariant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
        <div className="p-5 flex items-start justify-between border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-50 rounded-md border border-amber-200 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          {children}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Audit Notice:</span> This action will be permanently recorded in the persistent security log with operator timestamp.
          </div>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            className={`px-4 py-2 rounded-md text-xs font-semibold shadow-sm transition-colors ${
              disabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : btnClasses
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
