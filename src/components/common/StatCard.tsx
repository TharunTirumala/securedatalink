import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  badge?: string;
  size?: 'sm' | 'md';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'default',
  badge,
  size = 'md'
}) => {
  const iconColors = {
    default: 'text-slate-600 bg-slate-100 border-slate-200',
    success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    warning: 'text-amber-700 bg-amber-50 border-amber-200',
    danger: 'text-rose-700 bg-rose-50 border-rose-200',
    info: 'text-sky-700 bg-sky-50 border-sky-200',
  };

  const isSm = size === 'sm';

  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow transition-shadow ${isSm ? 'p-3.5' : 'p-5'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`rounded-md border ${isSm ? 'p-1.5' : 'p-2'} ${iconColors[variant]}`}>
          <Icon className={isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </div>
      </div>
      <div className={`flex items-baseline justify-between ${isSm ? 'mt-2' : 'mt-3'}`}>
        <div className={`font-bold text-slate-900 tracking-tight ${isSm ? 'text-xl' : 'text-2xl'}`}>{value}</div>
        {badge && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            {badge}
          </span>
        )}
      </div>
      {subtext && (
        <div className={`text-slate-500 font-medium ${isSm ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs'}`}>{subtext}</div>
      )}
    </div>
  );
};
