'use client';

import { useState, useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';

interface TelemetryMetrics {
  kdRatio: string;
  raidsTotal: number;
  survived: number;
  kia: number;
  playtime: string;
}

interface TelemetryProfile {
  id: string;
  metrics?: TelemetryMetrics;
}

interface TelemetryDetailsClientProps {
  id: string;
}

interface MetricRowProps {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  isLast?: boolean;
}

function MetricRow({ label, value, valueClassName, isLast }: MetricRowProps) {
  return (
    <div className={`flex items-center justify-between ${isLast ? 'pt-1' : 'border-b border-[var(--color-lines-hover)] pb-2'}`}>
      <span className="font-blender-book text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className={`font-mono text-xs ${valueClassName || 'text-[var(--color-text-primary)]'}`}>{value}</span>
    </div>
  );
}

export default function TelemetryDetailsClient({ id }: TelemetryDetailsClientProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  const profile = usePlayerStore((state) => 
    state.profiles?.find((p) => p.id === id) as TelemetryProfile | undefined
  );

  useEffect(() => setIsMounted(true), []);

  if (!isMounted) {
    return (
      <div className="flex w-full items-center justify-between py-2">
        <div className="h-3 w-32 animate-pulse rounded bg-[var(--color-lines-hover)]" />
        <div className="h-3 w-3 animate-pulse rounded bg-[var(--color-lines-hover)]" />
      </div>
    );
  }

  if (!profile?.metrics) {
    return <div className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Данные недоступны</div>;
  }

  const metrics = profile.metrics;

  return (
    <div className="flex w-full flex-col">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="group flex w-full items-center justify-between py-2 transition-colors duration-300 hover:text-[var(--primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        aria-expanded={isExpanded}
      >
        <span className="font-blender-medium text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] transition-colors duration-300 group-hover:text-[var(--primary)]">
          Детальная сводка
        </span>
        <span className={`text-[var(--color-text-muted)] transition-transform duration-300 ease-out group-hover:text-[var(--primary)] ${isExpanded ? 'rotate-180' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="mt-3 flex w-full flex-col gap-3 rounded bg-[var(--color-card-menu)] p-4 border border-[var(--color-lines-hover)] opacity-0 transition-opacity duration-300 delay-100 data-[expanded=true]:opacity-100" data-expanded={isExpanded}>
            
            <MetricRow 
              label="K/D Ratio" 
              value={!isNaN(Number(metrics.kdRatio)) ? Number(metrics.kdRatio).toFixed(2) : metrics.kdRatio} 
              valueClassName="font-bold text-[var(--color-text-primary)]" 
            />
            <MetricRow label="Всего рейдов" value={metrics.raidsTotal} />
            <MetricRow label="Выживаний" value={metrics.survived} valueClassName="text-[var(--color-nvg-green)]" />
            <MetricRow label="Часов в рейде" value={metrics.playtime} isLast />

          </div>
        </div>
      </div>
    </div>
  );
}