import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  variant?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'blue',
  onClick,
}) => {
  const variantStyles = {
    blue: {
      bg: 'bg-[#f0f9fb]',
      iconBg: 'bg-[#dcf1f6] text-[#2582a1]',
      border: 'border-[#bee3ee]',
    },
    emerald: {
      bg: 'bg-emerald-50/70',
      iconBg: 'bg-emerald-100 text-emerald-700',
      border: 'border-emerald-200',
    },
    amber: {
      bg: 'bg-[#fff8eb]',
      iconBg: 'bg-[#fde6b3] text-[#b37d10]',
      border: 'border-[#fde6b3]',
    },
    rose: {
      bg: 'bg-rose-50/70',
      iconBg: 'bg-rose-100 text-rose-700',
      border: 'border-rose-200',
    },
    slate: {
      bg: 'bg-slate-50',
      iconBg: 'bg-slate-100 text-slate-700',
      border: 'border-slate-200',
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl bg-white border ${style.border} shadow-xs hover:shadow-md transition-all ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0e3b4b]">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 line-clamp-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl shrink-0 ${style.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center text-xs font-medium text-slate-600">
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
};
