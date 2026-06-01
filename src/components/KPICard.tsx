import { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: ReactNode;
  bgClass?: string;
}

export default function KPICard({ title, value, change, isPositive, icon, bgClass = 'bg-white' }: KPICardProps) {
  return (
    <div className={`${bgClass} p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between transition-all duration-300 hover:shadow-md hover:border-slate-200`}>
      <div className="space-y-1.5">
        <span className="text-xs md:text-sm text-slate-500 font-medium">{title}</span>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl md:text-3xl font-bold text-slate-900 leading-none">{value}</span>
          {change && (
            <span className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full ${
              isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
              {change}
            </span>
          )}
        </div>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-blue-50/50 flex items-center justify-center shrink-0 text-blue-600">
        {icon}
      </div>
    </div>
  );
}
