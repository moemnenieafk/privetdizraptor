"use client";

import { formatCompactNumber, formatCurrencyDisplay } from '@/lib/formatters';
import type { EftCraftData } from '../types';
import { calcEftProfitLevel } from '../types';

const LABELS = {
  neutral:      'НЕЙТРАЛЬНЫЙ КРАФТ',
  profitable:   'ВЫГОДНЫЙ КРАФТ',
  unprofitable: 'НЕВЫГОДНЫЙ КРАФТ',
} as const;

const BORDER = {
  neutral:      'border-lines-hover',
  profitable:   'border-nvg-green/50',
  unprofitable: 'border-red-500/50',
} as const;

const VALUE_COLOR = {
  neutral:      'text-text-primary',
  profitable:   'text-nvg-green',
  unprofitable: 'text-red-400',
} as const;

interface EftCraftTooltipProps {
  data: EftCraftData;
  style?: React.CSSProperties;
}

export function EftCraftTooltip({ data, style }: EftCraftTooltipProps) {
  const level = calcEftProfitLevel(data.profit);

  return (
    <div
      className={`w-64 rounded-sm border ${BORDER[level]} bg-card-menu p-3 shadow-xl`}
      style={style}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className={`font-blender-medium text-[9px] uppercase tracking-widest ${VALUE_COLOR[level]}`}>
          {LABELS[level]}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="font-blender-medium text-[10px] text-text-muted">УР.{data.stationLevel}</span>
          <span className="icon-eft-prog-craft h-3 w-3 bg-text-muted mask-contain mask-center mask-no-repeat" />
        </div>
      </div>

      <div className="mb-2.5 flex flex-col gap-1.5">
        {data.ingredients.map((ing) => (
          <div key={ing.id} className="flex items-center gap-2">
            { }
            <img
              src={ing.iconLink || `/images/items/eft/${ing.id}.webp`}
              alt={ing.name}
              className="h-8 w-8 shrink-0 rounded-xs border border-lines-hover/30 bg-(--color-base) object-contain p-0.5"
              onError={(e) => { e.currentTarget.src = '/images/placeholder.webp'; }}
            />
            <span className="min-w-0 flex-1 font-blender-book text-[10px] leading-tight text-text-secondary">
              {ing.name}
            </span>
            {ing.count > 1 && (
              <span className="shrink-0 font-blender-medium text-[10px] text-text-muted">×{ing.count}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mb-2 border-t border-lines-hover/50" />

      <div className="flex flex-col gap-1">
        {([
          { label: 'ДЛИТЕЛЬНОСТЬ', value: data.durationLabel,                               colored: false },
          {
            label: 'ПОКУПКА',
            value: data.buyCurrency === 'USD' && data.buyPriceNative != null
              ? `${formatCurrencyDisplay(data.buyPriceNative, 'USD')} · ${formatCompactNumber(data.buyPrice)} ₽`
              : `${formatCompactNumber(data.buyPrice)} ₽`,
            colored: false,
          },
          { label: 'ОБОРОТ / Ч',   value: `${formatCompactNumber(data.turnoverPerHour)} ₽`, colored: false },
          { label: 'ПРИБЫЛЬ',      value: `${formatCompactNumber(data.profit)} ₽`,          colored: true },
          { label: 'ПРИБЫЛЬ / Ч',  value: `${formatCompactNumber(data.profitPerHour)} ₽`,  colored: true },
        ]).map(({ label, value, colored }) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <span className="font-blender-medium text-[9px] uppercase tracking-widest text-text-muted">
              {label}
            </span>
            <span className={`font-blender-medium text-[11px] ${colored ? VALUE_COLOR[level] : 'text-text-primary'}`}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
