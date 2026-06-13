import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

const accentTextStyles = {
  default: 'text-text-primary',
  primary: 'text-[var(--primary)]',
  success: 'text-[var(--color-nvg-green)]',
  warning: 'text-yellow-500',
  danger: 'text-red-500',
};

export function MetricCard({ label, value, subtext, accent = 'default', className = '' }: MetricCardProps) {
  return (
    <div className={`bg-card-menu/40 p-3 rounded-md border border-lines-hover flex flex-col justify-between ${className}`}>
      <div className="text-[11px] font-black tracking-widest uppercase text-text-muted mb-1 leading-tight">
        {label}
      </div>
      <div className={`font-mono text-lg font-bold tracking-tight ${accentTextStyles[accent]}`}>
        {value}
      </div>
      {subtext && (
        <div className="text-[10px] text-text-secondary mt-1 font-blender-book">
          {subtext}
        </div>
      )}
    </div>
  );
}