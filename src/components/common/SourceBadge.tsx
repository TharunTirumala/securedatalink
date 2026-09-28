import React from 'react';

interface SourceBadgeProps {
  source: string;
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, className = '' }) => {
  const norm = (source || '').toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  if (norm.startsWith('UAV')) {
    colorClasses = 'bg-sky-50 text-sky-700 border-sky-200';
  } else if (norm.startsWith('UGV')) {
    colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (norm.startsWith('BASE') || norm.startsWith('RELAY') || norm.startsWith('C2')) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${colorClasses} ${className}`}>
      {source}
    </span>
  );
};
