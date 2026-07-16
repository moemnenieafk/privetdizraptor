"use client";

import { PackageX } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useIsPve } from '@/hooks/useGameMode';
import { VendorImage } from './ItemImage';
import type { VendorOffer } from './ItemModules';

interface ItemPriceBlockProps {
  buyFor?: VendorOffer[];
  sellFor?: VendorOffer[];
  slots: number;
  /** Требуемый уровень игрока для лучшей покупки у торговца */
  buyLevelRequired?: number | null;
}

const isFlea = (v: { normalizedName?: string; name: string }) =>
  v.normalizedName === 'flea-market' || v.name === 'Flea Market';

const rub = (o: VendorOffer) => o.priceRUB ?? o.price;
// Резолвер цены по режиму: PvE-поле, иначе фолбэк на обычную (PvP) цену.
const rubForMode = (o: VendorOffer, pve: boolean) => (pve ? (o.priceRUBPve ?? o.pricePve ?? rub(o)) : rub(o));

// Тег контекста цены барахолки в PvE: пока данных нет — показываем, что цифра из PvP-рынка.
function FleaModeTag({ isPve, hasPve }: { isPve: boolean; hasPve: boolean }) {
  if (!isPve) return null;
  return (
    <span className="ml-2 rounded-xs border border-edition-tue px-1.5 py-0.5 font-blender-medium text-type-caption uppercase tracking-widest text-edition-tue">
      {hasPve ? 'PvE' : 'PvP-рынок'}
    </span>
  );
}
const fmtRub = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;

// ─── Бокс 48px для иконок — фон в цвет иконки (10%), без обводки ──────────────
function IconFrame({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded ${tint}`}>
      {children}
    </div>
  );
}

// ─── Гексагон требуемого уровня игрока (как LevelBadge в EftItemTile) ─────────
function LevelHex({ required }: { required: number }) {
  const profiles = usePlayerStore((s) => s.profiles);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const profile = profiles.find((p) => p.id === activeId);
  const playerLvl = profile ? parseInt(profile.level, 10) : 0;
  const met = playerLvl >= required;
  const color = met ? 'var(--color-nvg-green)' : 'var(--color-danger)';

  return (
    <span
      title={`Требуемый уровень игрока: ${required}`}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center"
    >
      <svg width="28" height="28" viewBox="0 0 16 16" aria-hidden="true">
        <polygon points="8,1.5 14,4.75 14,11.25 8,14.5 2,11.25 2,4.75" fill="none" stroke={color} strokeWidth="1.2" />
        <text x="8" y="10.4" textAnchor="middle" fontSize="6.5" fill={color} fontFamily="var(--font-blender-medium)">
          {required}
        </text>
      </svg>
    </span>
  );
}

function BigPrice({ value, className }: { value: number; className: string }) {
  return <span className={`font-blender-medium text-3xl leading-none ${className}`}>{fmtRub(value)}</span>;
}

function EmptyValue() {
  return (
    <>
      <IconFrame tint="bg-red-500/10">
        <PackageX className="h-5 w-5 text-red-500/70" />
      </IconFrame>
      <span className="font-blender-medium text-2xl leading-none uppercase tracking-widest text-red-500">НЕТ</span>
    </>
  );
}

// ─── Строка-ячейка: лейбл слева, иконка + цена справа ────────────────────────
function PriceCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded border border-lines-hover bg-card-menu px-5 py-3">
      <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
        {label}
      </span>
      <div className="flex min-h-12 shrink-0 items-center justify-end gap-3">{children}</div>
    </div>
  );
}

export function ItemPriceBlock({ buyFor = [], sellFor = [], slots, buyLevelRequired }: ItemPriceBlockProps) {
  const isPve = useIsPve();
  const traderBuys = buyFor.filter((b) => !isFlea(b.vendor));
  const fleaBuy = buyFor.find((b) => isFlea(b.vendor));
  const traderSells = sellFor.filter((s) => !isFlea(s.vendor));
  const fleaSell = sellFor.find((s) => isFlea(s.vendor));

  const bestTraderBuy = traderBuys.length
    ? traderBuys.reduce((min, c) => (rub(c) < rub(min) ? c : min))
    : null;
  const bestTraderSell = traderSells.length
    ? traderSells.reduce((max, c) => (rub(c) > rub(max) ? c : max))
    : null;

  const safeSlots = slots > 0 ? slots : 1;
  const traderSellVps = bestTraderSell ? Math.floor(rub(bestTraderSell) / safeSlots) : 0;
  const fleaSellVps = fleaSell ? Math.floor(rubForMode(fleaSell, isPve) / safeSlots) : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* ── Купить у торговца ── */}
      <PriceCard label="Купить у торговца">
        {bestTraderBuy ? (
          <>
            <div className="flex shrink-0 items-center gap-1.5">
              <VendorImage
                normalizedName={bestTraderBuy.vendor.normalizedName}
                name={bestTraderBuy.vendor.name}
                className="h-11 w-11 shrink-0 rounded border border-lines-hover/50 object-cover"
              />
              {buyLevelRequired != null && buyLevelRequired > 0 && <LevelHex required={buyLevelRequired} />}
            </div>
            <BigPrice value={rub(bestTraderBuy)} className="text-text-primary" />
          </>
        ) : (
          <EmptyValue />
        )}
      </PriceCard>

      {/* ── Купить на барахолке ── */}
      <PriceCard label="Купить на барахолке">
        {fleaBuy ? (
          <>
            <IconFrame tint="bg-yellow-500/10">
              <span className="icon-eft-currency-ruble h-5 w-5 bg-yellow-500/80 mask-contain mask-center mask-no-repeat" />
            </IconFrame>
            <BigPrice value={rubForMode(fleaBuy, isPve)} className="text-nvg-green" />
            <FleaModeTag isPve={isPve} hasPve={fleaBuy.priceRUBPve != null} />
          </>
        ) : (
          <EmptyValue />
        )}
      </PriceCard>

      {/* ── Продать торговцу ── */}
      <PriceCard label="Продать торговцу">
        {bestTraderSell ? (
          <>
            <VendorImage
              normalizedName={bestTraderSell.vendor.normalizedName}
              name={bestTraderSell.vendor.name}
              className="h-11 w-11 shrink-0 rounded border border-lines-hover/50 object-cover"
            />
            <BigPrice value={rub(bestTraderSell)} className="text-text-secondary" />
          </>
        ) : (
          <EmptyValue />
        )}
      </PriceCard>

      {/* ── Продать на барахолке ── */}
      <PriceCard label="Продать на барахолке">
        {fleaSell ? (
          <>
            <IconFrame tint="bg-yellow-500/10">
              <span className="icon-eft-currency-ruble h-5 w-5 bg-yellow-500/80 mask-contain mask-center mask-no-repeat" />
            </IconFrame>
            <BigPrice value={rubForMode(fleaSell, isPve)} className="text-nvg-green" />
            <FleaModeTag isPve={isPve} hasPve={fleaSell.priceRUBPve != null} />
          </>
        ) : (
          <EmptyValue />
        )}
      </PriceCard>

      {/* ── Цена / слот: торговец ── */}
      <PriceCard label="Цена / слот">
        {traderSellVps > 0 ? (
          <>
            <IconFrame tint="bg-text-secondary/10">
              <span className="icon-eft-items-price-slot h-5 w-5 bg-text-secondary mask-contain mask-center mask-no-repeat" />
            </IconFrame>
            <BigPrice value={traderSellVps} className="text-text-secondary" />
          </>
        ) : (
          <EmptyValue />
        )}
      </PriceCard>

      {/* ── Цена / слот: барахолка ── */}
      <PriceCard label="Цена / слот на барахолке">
        {fleaSellVps > 0 ? (
          <>
            <IconFrame tint="bg-nvg-green/10">
              <span className="icon-eft-items-price-slot h-5 w-5 bg-nvg-green mask-contain mask-center mask-no-repeat" />
            </IconFrame>
            <BigPrice value={fleaSellVps} className="text-nvg-green" />
          </>
        ) : (
          <EmptyValue />
        )}
      </PriceCard>
    </div>
  );
}
