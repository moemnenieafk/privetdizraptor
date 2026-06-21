"use client";

import { formatCompactNumber, formatCurrencyDisplay } from '@/lib/formatters';
import type { EftBarterData } from '../types';
import { calcEftProfitLevel } from '../types';

const LABELS = {
  neutral:      'НЕЙТРАЛЬНЫЙ БАРТЕР',
  profitable:   'ВЫГОДНЫЙ БАРТЕР',
  unprofitable: 'НЕВЫГОДНЫЙ БАРТЕР',
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

interface EftBarterTooltipProps {
  data: EftBarterData;
  style?: React.CSSProperties;
}

export function EftBarterTooltip({ data, style }: EftBarterTooltipProps) {
  const level = calcEftProfitLevel(data.profit);

  return (
    <div
      className={`w-64 rounded-sm border ${BORDER[level]} bg-card-menu p-3 shadow-xl`}
      style={style}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="icon-eft-prog-barter h-3 w-3 bg-text-muted mask-contain mask-center mask-no-repeat" />
          <span className={`font-blender-medium text-type-caption uppercase tracking-widest ${VALUE_COLOR[level]}`}>
            {LABELS[level]}
          </span>
        </div>
        { }
        <img
          src={`/images/traders/eft/${data.trader.normalizedName ?? data.trader.name.toLowerCase()}.webp`}
          alt={data.trader.name}
          className="h-6 w-6 shrink-0 rounded-xs object-cover opacity-80"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      <div className="mb-2.5 flex flex-col gap-1.5">
        {data.items.map((itm) => (
          <div key={itm.id} className="flex items-center gap-2">
            { }
            <img
              src={itm.iconLink || `/images/items/eft/${itm.id}.webp`}
              alt={itm.name}
              className="h-8 w-8 shrink-0 rounded-xs border border-lines-hover/30 bg-(--color-base) object-contain p-0.5"
              onError={(e) => { e.currentTarget.src = '/images/placeholder.webp'; }}
            />
            <span className="min-w-0 flex-1 font-blender-book text-type-caption leading-tight text-text-secondary">
              {itm.name}
            </span>
            {itm.count > 1 && (
              <span className="shrink-0 font-blender-medium text-type-caption text-text-muted">×{itm.count}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mb-2 border-t border-lines-hover/50" />

      <div className="flex flex-col gap-1">
        {([
          {
            label: 'ПОКУПКА',
            value: data.buyCurrency === 'USD' && data.buyPriceNative != null
              ? `${formatCurrencyDisplay(data.buyPriceNative, 'USD')} · ${formatCompactNumber(data.buyPrice)} ₽`
              : `${formatCompactNumber(data.buyPrice)} ₽`,
            colored: false,
          },
          { label: 'ЭКОНОМИЯ', value: `${formatCompactNumber(data.savings)} ₽`,   colored: false },
          { label: 'ПРИБЫЛЬ',  value: `${formatCompactNumber(data.profit)} ₽`,    colored: true  },
          { label: 'КОМИССИЯ', value: `-${formatCompactNumber(Math.abs(data.commission))} ₽`, colored: false },
        ]).map(({ label, value, colored }) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
              {label}
            </span>
            <span className={`font-blender-medium text-type-caption ${colored ? VALUE_COLOR[level] : 'text-text-primary'}`}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
