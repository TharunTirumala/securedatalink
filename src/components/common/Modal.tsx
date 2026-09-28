import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  hideCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-md',
  className = '',
  hideCloseButton = false,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      className={`p-0 bg-transparent rounded-lg shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm m-auto w-full ${maxWidth} border-none outline-hidden ${className}`}
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden text-slate-900 flex flex-col">
        {(title || !hideCloseButton) && (
          <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div>
              {title && typeof title === 'string' ? (
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              ) : (
                title
              )}
              {subtitle && (
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{subtitle}</div>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </dialog>
  );
};
