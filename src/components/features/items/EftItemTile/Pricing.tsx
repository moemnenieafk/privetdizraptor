"use client";

import { PackageX } from 'lucide-react';
import { formatCurrencyDisplay } from '@/lib/formatters';
import { useEftItemTile } from './context';
import { usePlayerStore } from '@/store/usePlayerStore';
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

function LoyaltyBadge({
  loyaltyLevel,
  vendorName,
}: {
  loyaltyLevel: number;
  vendorName?: string;
}) {
  const profiles = usePlayerStore((s) => s.profiles);
  const activeId  = usePlayerStore((s) => s.activeProfileId);
  const profile   = profiles.find((p) => p.id === activeId);
  const key       = vendorName?.toLowerCase() ?? '';
  const playerLvl = profile ? (profile.traderLevels[key] ?? 0) : 0;
  const met       = playerLvl >= loyaltyLevel;
  const cls       = `icon-eft-profile-rep-${loyaltyLevel}`;

  return (
    <span
      className={`${cls} h-3 w-3 shrink-0 mask-contain mask-center mask-no-repeat ${
        met ? 'bg-nvg-green' : 'bg-danger'
      }`}
      title={`Уровень лояльности ${loyaltyLevel}`}
    />
  );
}

function LevelBadge({ required }: { required: number }) {
  const profiles = usePlayerStore((s) => s.profiles);
  const activeId  = usePlayerStore((s) => s.activeProfileId);
  const profile   = profiles.find((p) => p.id === activeId);
  const playerLvl = profile ? parseInt(profile.level, 10) : 0;
  const met       = playerLvl >= required;
  const color     = met ? 'var(--color-nvg-green)' : 'var(--color-danger)';

  return (
    <span
      title={`Требуемый уровень игрока: ${required}`}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <polygon
          points="8,1.5 14,4.75 14,11.25 8,14.5 2,11.25 2,4.75"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
        />
        <text
          x="8"
          y="10.5"
          textAnchor="middle"
          fontSize="6"
          fill={color}
          fontFamily="var(--font-blender-medium)"
        >
          {required}
        </text>
      </svg>
    </span>
  );
}

function QuestUnlockIcon() {
  return (
    <span
      className="icon-eft-quests h-4 w-4 shrink-0 bg-danger mask-contain mask-center mask-no-repeat"
      title="Требуется задание"
    />
  );
}

function PriceCell({
  entry,
  isFlea = false,
  accent = false,
  showQuestUnlock = false,
  levelRequired,
}: {
  entry?: EftPriceEntry;
  isFlea?: boolean;
  accent?: boolean;
  showQuestUnlock?: boolean;
  levelRequired?: number;
}) {
  if (!entry || entry.price <= 0) {
    return (
      <div className="flex items-center gap-1">
        <PackageX className="h-3.5 w-3.5 text-red-600" />
        <span className="font-blender-medium text-[9px] uppercase tracking-widest text-red-600">НЕТ</span>
      </div>
    );
  }

  const display  = formatCurrencyDisplay(entry.price, entry.currency);
  const titleRUB = (entry.priceRUB ?? entry.price).toLocaleString('ru-RU') + ' ₽';

  return (
    <div className="flex items-center gap-1.5">
      {isFlea ? (
        <span className="icon-eft-currency-ruble h-3.5 w-3.5 shrink-0 bg-yellow-500/70 mask-contain mask-center mask-no-repeat" />
      ) : (
        <VendorAvatar vendor={entry.vendor} />
      )}
      {!isFlea && levelRequired != null && <LevelBadge required={levelRequired} />}
      {!isFlea && levelRequired == null && entry.loyaltyLevel != null && (
        <LoyaltyBadge
          loyaltyLevel={entry.loyaltyLevel}
          vendorName={entry.vendor?.normalizedName ?? entry.vendor?.name}
        />
      )}
      {!isFlea && showQuestUnlock && <QuestUnlockIcon />}
      <span
        title={titleRUB}
        className={`cursor-help font-blender-medium ${
          accent ? 'text-sm text-(--primary)' : 'text-[11px] text-text-secondary'
        }`}
      >
        {display}
      </span>
    </div>
  );
}

function VpsCell({ price, priceRUB, slots }: { price?: number; priceRUB?: number; slots: number }) {
  if (!price || price <= 0) {
    return (
      <div className="flex items-center gap-1">
        <PackageX className="h-3 w-3 text-danger/40" />
        <span className="font-blender-medium text-[9px] text-text-muted/50">—</span>
      </div>
    );
  }
  const vps = Math.floor((priceRUB ?? price) / slots);
  const iconColor = vps > 10000 ? 'bg-nvg-green' : 'bg-text-secondary';
  return (
    <div className="flex items-center gap-1">
      <span className={`icon-eft-items-price-slot h-4 w-4 shrink-0 ${iconColor} mask-contain mask-center mask-no-repeat`} />
      <span
        title={`${vps.toLocaleString('ru-RU')} ₽ / слот`}
        className={`cursor-help font-blender-medium text-xs ${
          vps > 10000 ? 'text-nvg-green' : vps > 5000 ? 'text-yellow-500' : 'text-text-primary'
        }`}
      >
        {formatCurrencyDisplay(vps)}
      </span>
    </div>
  );
}

export function EftPricing() {
  const { item } = useEftItemTile();
  const { pricing, indicators, minPlayerLevel } = item;
  const slots = item.width * item.height;
  const hasQuestUnlock = indicators?.quest?.type === 'unlock_trade';

  return (
    <div className="mt-auto flex flex-col gap-0 pt-3">

      {/* ── Покупка ── */}
      <div className="mb-1 flex w-full items-center gap-2">
        <span className="font-blender-medium text-[10px] uppercase leading-none tracking-wide text-zinc-600 opacity-50">ПОКУПКА</span>
        <div className="h-px flex-1 bg-neutral-800" />
        <span className="font-blender-medium text-[10px] uppercase leading-none tracking-wide text-zinc-600 opacity-50">БАРАХОЛКА</span>
      </div>
      <div className="mb-2.5 grid grid-cols-2 gap-2">
        <PriceCell entry={pricing.traderBuy} showQuestUnlock={hasQuestUnlock} />
        <div className="flex justify-end">
          <PriceCell entry={pricing.fleaBuy} isFlea accent />
        </div>
      </div>

      {/* ── Продажа ── */}
      <div className="mb-1 flex w-full items-center gap-2">
        <span className="font-blender-medium text-[10px] uppercase leading-none tracking-wide text-zinc-600 opacity-50">ПРОДАЖА</span>
        <div className="h-px flex-1 bg-neutral-800" />
        <span className="font-blender-medium text-[10px] uppercase leading-none tracking-wide text-zinc-600 opacity-50">БАРАХОЛКА</span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <PriceCell entry={pricing.traderSell} levelRequired={minPlayerLevel} />
        <div className="flex justify-end">
          <PriceCell entry={pricing.fleaSell} isFlea accent />
        </div>
      </div>

      {/* ── Цена / Слот ── */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <VpsCell price={pricing.traderSell?.price} priceRUB={pricing.traderSell?.priceRUB} slots={slots} />
        <div className="flex items-center justify-end">
          <VpsCell price={pricing.fleaSell?.price} priceRUB={pricing.fleaSell?.priceRUB} slots={slots} />
        </div>
      </div>
    </div>
  );
}
