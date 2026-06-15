"use client";

import { Coins, PackageX } from 'lucide-react';
import { formatCompactNumber, getCurrencySymbol } from '@/lib/formatters';
import { useEftItemTile } from './context';
import type { EftPriceEntry, EftVendor } from './types';

function VendorAvatar({ vendor }: { vendor?: EftVendor }) {
  if (!vendor || vendor.name === '-') return <span className="h-4 w-4 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/images/traders/eft/${vendor.normalizedName ?? vendor.name.toLowerCase()}.webp`}
      alt={vendor.name}
      title={vendor.name}
      className="h-4 w-4 shrink-0 rounded-xs object-cover opacity-80"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

function PriceCell({
  entry,
  isFlea = false,
  accent = false,
}: {
  entry?: EftPriceEntry;
  isFlea?: boolean;
  accent?: boolean;
}) {
  if (!entry || entry.price <= 0) {
    return (
      <div className="flex items-center gap-1">
        <PackageX className="h-3.5 w-3.5 text-text-muted/50" />
        <span className="font-blender-medium text-[9px] uppercase tracking-widest text-text-muted/60">НЕТ</span>
      </div>
    );
  }

  const symbol = getCurrencySymbol(entry.currency);
  const display = entry.currency === 'USD'
    ? `${symbol}${formatCompactNumber(entry.price)}`
    : `${formatCompactNumber(entry.price)} ₽`;

  return (
    <div className="flex items-center gap-1.5">
      {isFlea
        ? <Coins className="h-3.5 w-3.5 shrink-0 text-yellow-500/70" />
        : <VendorAvatar vendor={entry.vendor} />
      }
      <span
        title={`${entry.price.toLocaleString('ru-RU')} ₽`}
        className={`cursor-help font-blender-medium ${
          accent ? 'text-sm text-(--primary)' : 'text-[11px] text-text-secondary'
        }`}
      >
        {display}
      </span>
    </div>
  );
}

function VpsCell({ price, slots }: { price?: number; slots: number }) {
  if (!price || price <= 0) {
    return (
      <div className="flex items-center gap-1">
        <PackageX className="h-3 w-3 text-text-muted/40" />
        <span className="font-blender-medium text-[9px] text-text-muted/50">—</span>
      </div>
    );
  }
  const vps = Math.floor(price / slots);
  return (
    <span
      title={`${vps.toLocaleString('ru-RU')} ₽ / слот`}
      className={`cursor-help font-blender-medium text-xs ${
        vps > 10000 ? 'text-nvg-green' : vps > 5000 ? 'text-yellow-500' : 'text-text-primary'
      }`}
    >
      {formatCompactNumber(vps)} ₽
    </span>
  );
}

export function EftPricing() {
  const { item } = useEftItemTile();
  const { pricing } = item;
  const slots = item.width * item.height;

  return (
    <div className="mt-auto flex flex-col gap-0 border-t border-lines-hover pt-3">

      {/* ── Покупка ── */}
      <div className="mb-1 grid grid-cols-2 gap-2">
        <span className="font-blender-medium text-[8px] uppercase tracking-widest text-text-muted/60">Покупка</span>
        <span className="text-right font-blender-medium text-[8px] uppercase tracking-widest text-text-muted/60">Барахолка</span>
      </div>
      <div className="mb-2.5 grid grid-cols-2 gap-2">
        <PriceCell entry={pricing.traderBuy} />
        <div className="flex justify-end">
          <PriceCell entry={pricing.fleaBuy} isFlea accent />
        </div>
      </div>

      {/* ── Продажа ── */}
      <div className="mb-1 grid grid-cols-2 gap-2">
        <span className="font-blender-medium text-[8px] uppercase tracking-widest text-text-muted/60">Продажа</span>
        <span className="text-right font-blender-medium text-[8px] uppercase tracking-widest text-text-muted/60">Барахолка</span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <PriceCell entry={pricing.traderSell} />
        <div className="flex justify-end">
          <PriceCell entry={pricing.fleaSell} isFlea accent />
        </div>
      </div>

      {/* ── Цена / Слот ── */}
      <div className="grid grid-cols-2 gap-2 rounded-xs border border-lines-hover/50 bg-[color-mix(in_srgb,var(--color-card-menu)_40%,transparent)] px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          {/* Mini slot grid */}
          <div
            className="inline-grid gap-px p-px rounded-xs border border-lines-hover/30 bg-(--color-base) shrink-0"
            style={{ gridTemplateColumns: `repeat(${item.width}, 3px)` }}
          >
            {Array.from({ length: slots }).map((_, i) => (
              <div key={i} className="h-0.75 w-0.75 bg-text-muted/50" />
            ))}
          </div>
          <VpsCell price={pricing.traderSell?.price} slots={slots} />
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <div
            className="inline-grid gap-px p-px rounded-xs border border-lines-hover/30 bg-(--color-base) shrink-0"
            style={{ gridTemplateColumns: `repeat(${item.width}, 3px)` }}
          >
            {Array.from({ length: slots }).map((_, i) => (
              <div key={i} className="h-0.75 w-0.75 bg-text-muted/50" />
            ))}
          </div>
          <VpsCell price={pricing.fleaSell?.price} slots={slots} />
        </div>
      </div>
    </div>
  );
}
