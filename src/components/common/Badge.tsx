import React from 'react';

export type BadgeType = 'classification' | 'action' | 'verification' | 'severity' | 'general';

const DEFAULT_STYLE = 'bg-slate-100 text-slate-700 border-slate-200 font-medium';

const STYLES: Record<Exclude<BadgeType, 'general'>, Record<string, string>> = {
  action: {
    ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold',
    BLOCKED: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
    REJECTED: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
    FILTERED: 'bg-purple-50 text-purple-700 border-purple-300 font-bold',
  },
  classification: {
    AUTHENTIC: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
    REPLAYED: 'bg-amber-50 text-amber-900 border-amber-400 font-semibold',
    TAMPERED: 'bg-rose-50 text-rose-800 border-rose-400 font-semibold',
    'INVALID SIGNATURE': 'bg-red-50 text-red-800 border-red-300 font-semibold',
    'INTEGRITY FAILURE': 'bg-orange-50 text-orange-800 border-orange-300 font-semibold',
    'INVALID FORMAT': 'bg-slate-100 text-slate-800 border-slate-300 font-semibold',
    FILTERED: 'bg-purple-50 text-purple-800 border-purple-300 font-semibold',
  },
  verification: {
    PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
    VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
    FAIL: 'bg-rose-50 text-rose-700 border-rose-200 font-medium',
    FAILED: 'bg-rose-50 text-rose-700 border-rose-200 font-medium',
    INVALID: 'bg-rose-50 text-rose-700 border-rose-200 font-medium',
    SKIPPED: 'bg-slate-50 text-slate-500 border-slate-200 font-medium',
  },
  severity: {
    CRITICAL: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
    HIGH: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
    WARNING: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
    MEDIUM: 'bg-yellow-50 text-yellow-800 border-yellow-200 font-medium',
    LOW: 'bg-sky-50 text-sky-800 border-sky-200 font-medium',
    INFO: 'bg-sky-50 text-sky-800 border-sky-200 font-medium',
  },
};

interface BadgeProps {
  label: string;
  type?: BadgeType;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, type = 'general', className = '' }) => {
  const norm = (label || '').toUpperCase().trim();

  let colorClasses = DEFAULT_STYLE;
  if (type !== 'general') {
    const table = STYLES[type];
    if (table[norm]) {
      colorClasses = table[norm];
    } else if (type === 'classification') {
      if (norm.includes('SIGNATURE')) colorClasses = table['INVALID SIGNATURE'];
      else if (norm.includes('INTEGRITY')) colorClasses = table['INTEGRITY FAILURE'];
      else if (norm.includes('FORMAT')) colorClasses = table['INVALID FORMAT'];
    }
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border ${colorClasses} ${className}`}>
      {label}
    </span>
  );
};
