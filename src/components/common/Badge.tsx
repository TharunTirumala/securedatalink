import React from 'react';

interface BadgeProps {
  label: string;
  type?: 'classification' | 'action' | 'verification' | 'severity' | 'general';
}

export const Badge: React.FC<BadgeProps> = ({ label, type = 'general' }) => {
  const norm = (label || '').toUpperCase().trim();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  if (type === 'action') {
    if (norm === 'ACCEPTED') colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold';
    else if (norm === 'BLOCKED') colorClasses = 'bg-rose-50 text-rose-700 border-rose-300 font-bold';
    else if (norm === 'REJECTED') colorClasses = 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
    else if (norm === 'FILTERED') colorClasses = 'bg-purple-50 text-purple-700 border-purple-300 font-bold';
  } else if (type === 'classification') {
    if (norm === 'AUTHENTIC') colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold';
    else if (norm === 'REPLAYED') colorClasses = 'bg-amber-50 text-amber-900 border-amber-400 font-semibold';
    else if (norm === 'TAMPERED') colorClasses = 'bg-rose-50 text-rose-800 border-rose-400 font-semibold';
    else if (norm.includes('SIGNATURE')) colorClasses = 'bg-red-50 text-red-800 border-red-300 font-semibold';
    else if (norm.includes('INTEGRITY')) colorClasses = 'bg-orange-50 text-orange-800 border-orange-300 font-semibold';
    else if (norm.includes('FORMAT')) colorClasses = 'bg-slate-100 text-slate-800 border-slate-300 font-semibold';
    else if (norm === 'FILTERED') colorClasses = 'bg-purple-50 text-purple-800 border-purple-300 font-semibold';
  } else if (type === 'verification') {
    if (norm === 'PASS' || norm === 'VERIFIED') colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
    else if (norm === 'FAIL' || norm === 'FAILED' || norm === 'INVALID') colorClasses = 'bg-rose-50 text-rose-700 border-rose-200 font-medium';
    else colorClasses = 'bg-slate-50 text-slate-500 border-slate-200';
  } else if (type === 'severity') {
    if (norm === 'CRITICAL') colorClasses = 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
    else if (norm === 'HIGH' || norm === 'WARNING') colorClasses = 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
    else if (norm === 'MEDIUM') colorClasses = 'bg-yellow-50 text-yellow-800 border-yellow-200 font-medium';
    else colorClasses = 'bg-sky-50 text-sky-800 border-sky-200 font-medium';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border ${colorClasses}`}>
      {label}
    </span>
  );
};
