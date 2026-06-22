'use client';

import { useBarterStore } from '@/store/useBarterStore';
import { calcStashEconomics, calcBarterProfit, formatRub } from '@/lib/barter-calc';
import { VerdictCard } from './VerdictCard';

export function StashSummary() {
  const items = useBarterStore((s) => s.items);
  const selectedBarter = useBarterStore((s) => s.selectedBarter);

  // ─── Barter simulation mode → карточка-вердикт ───────────────
  if (selectedBarter) {
    const calc = calcBarterProfit(selectedBarter, items);
    return <VerdictCard barter={selectedBarter} calc={calc} />;
  }

  // ─── Manual stash mode → stat-карточки ───────────────────────
  if (items.length === 0) return null;

  const { totalFleaValue, totalTraderValue, arbitrageCount, arbitrageProfit } =
    calcStashEconomics(items);

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <StatCard label="На барахолке" value={formatRub(totalFleaValue)} />
      <StatCard label="У торговцев" value={formatRub(totalTraderValue)} />
      {arbitrageCount > 0 && (
        <StatCard
          label={`Арбитраж ×${arbitrageCount}`}
          value={`+${formatRub(arbitrageProfit)}`}
          color="var(--color-success)"
        />
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

function StatCard({ label, value, color = 'var(--color-text-secondary)' }: StatCardProps) {
  return (
    <div className="flex min-w-37.5 flex-1 flex-col gap-2 rounded border border-lines-hover bg-card-menu p-4">
      <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
        >
          <span
            className="icon-eft-currency-ruble h-4 w-4 mask-contain mask-center mask-no-repeat"
            style={{ backgroundColor: color }}
            role="img"
            aria-label="Рубль"
          />
        </div>
        <span className="font-blender-medium text-xl leading-none" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  );
}
