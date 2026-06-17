'use client';

import { useBarterStore } from '@/store/useBarterStore';
import { calcStashEconomics, calcBarterProfit, formatRub } from '@/lib/barter-calc';

export function StashSummary() {
  const items = useBarterStore((s) => s.items);
  const selectedBarter = useBarterStore((s) => s.selectedBarter);

  // ─── Barter simulation mode ──────────────────────────────────
  if (selectedBarter) {
    const calc = calcBarterProfit(selectedBarter, items);
    const profitPositive = calc.instantProfit >= 0;
    const savingsPositive = calc.calculatedSavings >= 0;
    const roiPositive = calc.roi >= 0;

    return (
      <div className="mt-5 flex flex-wrap gap-2">
        <MetricCard label="Ингредиенты" value={formatRub(calc.totalComponentsCost)} />
        <MetricCard
          label="Цена награды"
          value={calc.targetItemFleaPrice > 0 ? formatRub(calc.targetItemFleaPrice) : '—'}
        />
        <MetricCard
          label="Мгновенный профит"
          value={`${profitPositive ? '+' : ''}${formatRub(calc.instantProfit)}`}
          color={profitPositive ? 'success' : 'danger'}
        />
        {calc.targetItemFleaPrice > 0 && (
          <MetricCard
            label="Экономия"
            value={`${savingsPositive ? '+' : ''}${formatRub(calc.calculatedSavings)}`}
            color={savingsPositive ? 'success' : 'danger'}
          />
        )}
        {calc.totalComponentsCost > 0 && (
          <MetricCard
            label="ROI"
            value={`${roiPositive ? '+' : ''}${calc.roi.toFixed(1)}%`}
            color={roiPositive ? 'success' : 'danger'}
          />
        )}
      </div>
    );
  }

  // ─── Manual stash mode ───────────────────────────────────────
  if (items.length === 0) return null;

  const { totalFleaValue, totalTraderValue, arbitrageCount, arbitrageProfit } =
    calcStashEconomics(items);

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <MetricCard label="На барахолке" value={formatRub(totalFleaValue)} />
      <MetricCard label="У торговцев" value={formatRub(totalTraderValue)} />
      {arbitrageCount > 0 && (
        <MetricCard
          label={`Арбитраж ×${arbitrageCount}`}
          value={`+${formatRub(arbitrageProfit)}`}
          color="success"
        />
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  color?: 'success' | 'danger' | 'neutral';
}

function MetricCard({ label, value, color = 'neutral' }: MetricCardProps) {
  const valueColor =
    color === 'success'
      ? 'var(--color-success)'
      : color === 'danger'
      ? 'var(--color-danger)'
      : 'var(--color-text-secondary)';

  return (
    <div className="flex flex-col px-4 py-2.5 bg-card-menu border border-lines-hover gap-0.5">
      <span className="font-blender-medium text-[9px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className="font-blender-medium text-sm" style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  );
}
