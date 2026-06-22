'use client';

import Image from 'next/image';
import { useCountUp } from '@/hooks/useCountUp';
import { formatRub } from '@/lib/barter-calc';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import type { BarterCalculation, BarterTrade, BarterVerdict } from '@/types/barter';

interface Props {
  barter: BarterTrade;
  calc: BarterCalculation;
}

const STATUS: Record<BarterVerdict, { label: string; color: string; glow: boolean }> = {
  profitable: { label: 'ВЫГОДНЫЙ БАРТЕР', color: 'var(--color-success)', glow: true },
  neutral: { label: 'НЕЙТРАЛЬНЫЙ БАРТЕР', color: 'var(--color-text-secondary)', glow: false },
  unprofitable: { label: 'НЕВЫГОДНЫЙ БАРТЕР', color: 'var(--color-danger)', glow: true },
};

function signColor(n: number): string {
  if (n > 0) return 'var(--color-success)';
  if (n < 0) return 'var(--color-danger)';
  return 'var(--color-text-secondary)';
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : '−'}${formatRub(Math.abs(n))}`;
}

export function VerdictCard({ barter, calc }: Props) {
  const cfg = STATUS[calc.verdict];
  const animatedNet = useCountUp(calc.netProfit);
  const reward = barter.rewardItems[0];
  const traderName = barter.trader.normalizedName;

  const rows: { label: string; value: string; color: string }[] = [
    { label: 'Покупка', value: formatRub(calc.totalComponentsCost), color: 'var(--color-text-primary)' },
  ];
  if (calc.targetItemFleaPrice > 0) {
    rows.push({ label: 'Экономия', value: signed(calc.calculatedSavings), color: signColor(calc.calculatedSavings) });
  }
  rows.push({ label: 'Прибыль', value: signed(calc.instantProfit), color: signColor(calc.instantProfit) });
  if (calc.fleaCommission > 0) {
    rows.push({ label: 'Комиссия', value: `−${formatRub(calc.fleaCommission)}`, color: 'var(--color-text-muted)' });
  }
  if (calc.totalComponentsCost > 0) {
    rows.push({ label: 'ROI', value: `${calc.roi >= 0 ? '+' : '−'}${Math.abs(calc.roi).toFixed(1)}%`, color: signColor(calc.roi) });
  }

  return (
    <div
      className="relative mt-5 overflow-hidden rounded-lg border p-4 transition-all duration-500 md:p-5"
      style={{
        borderColor: cfg.color,
        boxShadow: cfg.glow ? `0 0 28px color-mix(in srgb, ${cfg.color} 22%, transparent)` : 'none',
        background: `radial-gradient(circle at 50% -40%, color-mix(in srgb, ${cfg.color} 9%, transparent), var(--color-darkbase))`,
      }}
    >
      {/* Header: status + trader */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="icon-eft-prog-barter h-4.5 w-4.5 shrink-0 mask-contain mask-center mask-no-repeat"
            style={{ backgroundColor: cfg.color }}
            role="img"
            aria-label="Бартер"
          />
          <span
            className="font-blender-medium text-xs uppercase tracking-widest md:text-sm"
            style={{ color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
            {barter.trader.name} LL{barter.level}
          </span>
        </div>
        <Image
          src={`/images/traders/eft/${traderName}.webp`}
          alt={barter.trader.name}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-xs border border-lines-hover object-cover"
          unoptimized
        />
      </div>

      {/* Reward + headline net profit */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {reward && (
            <div
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xs border border-lines-hover"
              style={{ background: getTarkovBackgroundColor(reward.item.backgroundColor) }}
            >
              {reward.item.image512pxLink && (
                <Image
                  src={reward.item.image512pxLink}
                  alt={reward.item.shortName}
                  fill
                  className="object-contain p-1"
                  sizes="56px"
                  unoptimized
                />
              )}
              {reward.count > 1 && (
                <span className="absolute right-0 bottom-0 bg-black/70 px-1 font-blender-medium text-type-micro text-text-primary">
                  ×{Math.ceil(reward.count)}
                </span>
              )}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-blender-book text-sm text-text-primary">
              {reward?.item.name}
            </p>
            <p className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
              Чистыми в карман
            </p>
          </div>
        </div>

        <div
          className="shrink-0 font-blender-medium text-2xl leading-none tracking-tight md:text-3xl"
          style={{
            color: cfg.color,
            textShadow: cfg.glow ? `0 0 16px color-mix(in srgb, ${cfg.color} 45%, transparent)` : 'none',
          }}
        >
          {signed(Math.round(animatedNet))}
        </div>
      </div>

      {/* Breakdown rows */}
      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1.5 border-t border-lines-hover pt-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
              {r.label}
            </span>
            <span className="font-blender-medium text-sm" style={{ color: r.color }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
