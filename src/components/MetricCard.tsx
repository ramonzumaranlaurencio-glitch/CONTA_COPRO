import React from 'react';

type MetricCardProps = {
  title: string;
  value: string;
  trend?: string;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'indigo';
};

const colorMap: Record<NonNullable<MetricCardProps['color']>, string> = {
  blue: 'var(--primary-blue)',
  green: '#15803d',
  red: '#b91c1c',
  orange: '#c2410c',
  indigo: '#4f46e5',
};

export const MetricCard = ({ title, value, trend = '+0.0%', color = 'blue' }: MetricCardProps) => (
  <div className="glass-card p-5 flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
        <h2 className="text-2xl font-extrabold mt-1 text-slate-800">{value}</h2>
      </div>
      <div className="metric-dot" style={{ backgroundColor: colorMap[color] }} />
    </div>

    <div className="mt-4">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-green-600 font-bold">{trend} vs mes ant.</span>
        <span className="text-slate-400">Meta: 90%</span>
      </div>
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
        <div className="h-full rounded-full w-[70%]" style={{ backgroundColor: colorMap[color] }} />
      </div>
    </div>
  </div>
);
