"use client";

import React, { useMemo, useRef, useState, useEffect, memo, forwardRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { PackageX, Coins, ChevronUp, ChevronDown, Check, X, Scale } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge as SemanticBadge, getArmorClassColor } from '@/components/features/items/Badge';
import { EftItemTile } from '@/components/features/items/EftItemTile';
import type { EftItemData, EftBarterData, EftCraftData, EftQuestData } from '@/components/features/items/EftItemTile';
import { applyQuestProgress, type QuestProgressRef } from '@/lib/eft-indicators.economics';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { itemIconUrl } from '@/lib/item-icon';
import { useCategoryFilters } from '@/components/features/items/useCategoryFilters';
import { CategoryControlBar } from '@/components/features/items/CategoryControlBar';
import { formatCompactNumber } from '@/lib/formatters';
import { getDynamicTopIndicator } from '@/lib/item-indicators.util';
import { getEyewearSubtype, type EyewearSubtype } from '@/lib/eyewear-filter-config';
import { EyewearSubtypeBar } from '@/components/features/items/EyewearSubtypeBar';
import { useItemsStore } from '@/store/useItemsStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { FavoritesStrip } from '@/components/features/items/FavoritesStrip';
import { CompareDrawer } from '@/components/features/items/CompareDrawer';
import { ItemCard } from '@/components/features/items/ItemCard';
import { useMediaQuery } from '@/hooks/useMediaQuery';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryItemProperties {
  // Armor / Helmet / Rig / Glasses / Visors / Masks
  class?: number | null;
  armorType?: string | null;
  durability?: number | null;
  ergoPenalty?: number | null;
  speedPenalty?: number | null;
  turnPenalty?: number | null;
  capacity?: number | null;
  // Helmet-specific
  deafening?: string | null;
  blocksHeadset?: boolean | null;
  // Glasses / Masks
  blindnessProtection?: number | null;
  // Night Vision (ItemPropertiesNightVision)
  nvgIntensity?: number | null;
  noiseIntensity?: number | null;
  // Headphones
  distanceModifier?: number | null;
  ambientVolume?: number | null;
  // Ammo
  caliber?: string | null;
  damage?: number | null;
  penetrationPower?: number | null;
  armorDamage?: number | null;
  fragmentationChance?: number | null;
  // Guns
  ergonomics?: number | null;
  recoilVertical?: number | null;
  recoilHorizontal?: number | null;
  fireRate?: number | null;
  // Mods
  recoilModifier?: number | null;
  // Sights
  zoomLevels?: number[][] | null;
  sightingRange?: number | null;
  // Grenades
  type?: string | null;
  fragments?: number | null;
  fuse?: number | null;
  maxExplosionDistance?: number | null;
  // Meds
  cures?: string[] | null;
  hitpoints?: number | null;
  uses?: number | null;
  useTime?: number | null;
}

export interface CategoryItem {
  id: string;
  normalizedName: string;
  name: string;
  shortName: string;
  width: number;
  height: number;
  weight?: number;
  backgroundColor?: string;
  basePrice: number;
  image512pxLink: string;
  types?: string[];
  properties?: CategoryItemProperties | null;
  sellFor: { price: number; priceRUB?: number; currency?: string; vendor: { name: string; normalizedName?: string } }[];
  buyFor: { price: number; priceRUB?: number; currency?: string; vendor: { name: string; normalizedName?: string } }[];
}

interface ItemsCategoryClientProps {
  initialData: CategoryItem[];
  categorySlug?: string;
  gpCoinBarters?: Record<string, number>;
  /** Серверные карты индикаторов плитки (ключ — id предмета). */
  barterDataMap?: Record<string, EftBarterData>;
  craftDataMap?: Record<string, EftCraftData>;
  /** Определения квест-индикаторов (с сервера) + рефы для оверлея прогресса на клиенте. */
  questDataMap?: Record<string, EftQuestData>;
  questRefMap?: Record<string, QuestProgressRef>;
}

// ─── Slug groups ──────────────────────────────────────────────────────────────

const GUN_SLUGS = new Set(['firearms', 'ar', 'bolt', 'carbine', 'dmr', 'gl', 'lmg', 'shotgun', 'sidearm', 'smg', 'guns']);
const CONTAINER_SLUGS = new Set(['cases', 'secure', 'secure-containers', 'storage-containers']);
const ERGO_RECOIL_MOD_SLUGS = new Set(['muzzle', 'foregrips', 'stocks', 'handguards', 'barrels', 'bipods', 'charginghandles', 'gasblocks', 'receivers', 'receivers-slides', 'magazines', 'mounts', 'laser', 'light-laser-devices', 'auxiliary', 'auxiliary-parts', 'launchers']);

// ─── Economics helper ─────────────────────────────────────────────────────────

function getEconomics(item: CategoryItem) {
  const slots = item.width * item.height || 1;
  const isFlea = (v: { vendor: { name: string; normalizedName?: string } }) =>
    v.vendor.name === 'Flea Market' || v.vendor.normalizedName === 'flea-market';
  const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;

  const fleaBuy = item.buyFor?.find(isFlea);
  const fleaSell = item.sellFor?.find(isFlea);
  const traderSells = item.sellFor?.filter(s => !isFlea(s)) || [];
  const EMPTY_SELL = { price: 0, priceRUB: undefined as number | undefined, currency: undefined as string | undefined, vendor: { name: '-', normalizedName: undefined as string | undefined } };
  const bestTraderSell = traderSells.length
    ? traderSells.reduce((max, curr) => rubVal(curr) > rubVal(max) ? curr : max, traderSells[0])
    : EMPTY_SELL;
  const bestSell = item.sellFor?.length
    ? item.sellFor.reduce((max, curr) => rubVal(curr) > rubVal(max) ? curr : max, item.sellFor[0])
    : { price: 0, vendor: { name: '-' } };
  const validBuy = (item.buyFor || []).filter(b => rubVal(b) > 0);
  const bestBuy = validBuy.length
    ? validBuy.reduce((min, curr) => rubVal(curr) < rubVal(min) ? curr : min, validBuy[0])
    : undefined;

  return {
    slots,
    bestSell,
    bestBuy,
    vps: slots > 0 ? Math.floor(rubVal(bestSell) / slots) : 0,
    fleaBuy,
    fleaSell,
    bestTraderSell,
    minPrice: bestBuy ? rubVal(bestBuy) : 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ARMOR_TYPE_RU: Record<string, string> = { Soft: 'Мягкая', Plate: 'Пластина' };

function formatZoomLevels(zoomLevels?: number[][]): string {
  if (!zoomLevels?.length) return '—';
  return zoomLevels
    .map(g => g.length === 1 ? `${g[0]}x` : `${g[0]}-${g[g.length - 1]}x`)
    .join(' / ');
}

function fmt(val?: number | null): string {
  if (val === null || val === undefined || val === 0) return '—';
  return String(val);
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function VendorIcon({ vendor }: { vendor: { name: string; normalizedName?: string } }) {
  if (!vendor || vendor.name === '-') return null;
  if (vendor.name === 'Flea Market' || vendor.normalizedName === 'flea-market') {
    return <Coins className="w-4 h-4 text-yellow-500 shrink-0" />;
  }
  if (!vendor.normalizedName) return <span className="w-4 h-4 shrink-0" />;
   
  return <img src={`/images/traders/eft/${vendor.normalizedName}.webp`} alt={vendor.name} className="w-4 h-4 object-cover rounded-sm shrink-0" title={vendor.name} />;
}

type ProcessedItem = CategoryItem & { eco: ReturnType<typeof getEconomics> };

// ─── EftItemTile adapters ─────────────────────────────────────────────────────

const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
const isFleaVendor = (v: { name: string; normalizedName?: string }) =>
  v.name === 'Flea Market' || v.normalizedName === 'flea-market';

function toEftItem(
  item: ProcessedItem,
  slug: string,
  questCount: number | undefined,
  barterDataMap: Record<string, EftBarterData>,
  craftDataMap: Record<string, EftCraftData>,
  questIndicatorMap: Map<string, EftQuestData>,
): EftItemData {
  const p = item.properties || {};
  const nonFleaBuys = (item.buyFor ?? []).filter(b => !isFleaVendor(b.vendor) && rubVal(b) > 0);
  const traderBuy = nonFleaBuys.length > 0
    ? nonFleaBuys.reduce((min, curr) => rubVal(curr) < rubVal(min) ? curr : min, nonFleaBuys[0])
    : undefined;

  // Индикаторы плитки: бартер/крафт (серверные карты) + квест (из стора). Только определённые ключи.
  const barter = barterDataMap[item.id];
  const craft  = craftDataMap[item.id];
  const quest  = questIndicatorMap.get(item.id);
  let indicators: EftItemData['indicators'] | undefined;
  if (barter || craft || quest) {
    indicators = {};
    if (barter) indicators.barter = barter;
    if (craft)  indicators.craft  = craft;
    if (quest)  indicators.quest  = quest;
  }

  return {
    id: item.id,
    normalizedName: item.normalizedName,
    name: item.name,
    shortName: item.shortName,
    width: item.width,
    height: item.height,
    backgroundColor: item.backgroundColor,
    image512pxLink: item.image512pxLink,
    armorClass: p.class ?? undefined,
    ammoOverlay: ((p.damage ?? 0) > 0 || (p.penetrationPower ?? 0) > 0)
      ? { damage: p.damage ?? 0, penetration: p.penetrationPower ?? 0 }
      : undefined,
    topStat: getDynamicTopIndicator(item, slug),
    indicators,
    pricing: {
      traderBuy: traderBuy
        ? {
            price:    traderBuy.price,
            priceRUB: traderBuy.priceRUB,
            currency: traderBuy.currency as import('@/components/features/items/EftItemTile/types').EftCurrency | undefined,
            vendor:   traderBuy.vendor,
          }
        : undefined,
      fleaBuy: item.eco.fleaBuy
        ? { price: rubVal(item.eco.fleaBuy), vendor: item.eco.fleaBuy.vendor }
        : undefined,
      traderSell: item.eco.bestTraderSell.price > 0
        ? {
            price:    item.eco.bestTraderSell.price,
            priceRUB: item.eco.bestTraderSell.priceRUB,
            currency: item.eco.bestTraderSell.currency as import('@/components/features/items/EftItemTile/types').EftCurrency | undefined,
            vendor:   item.eco.bestTraderSell.vendor,
          }
        : undefined,
      fleaSell: item.eco.fleaSell
        ? { price: rubVal(item.eco.fleaSell), vendor: item.eco.fleaSell.vendor }
        : undefined,
    },
    questCount,
  };
}


function renderPrice(
  price?: number,
  vendor?: { name: string; normalizedName?: string },
  highlightGreen = false,
  isBestSell = false,
  currency?: string,
) {
  if (!price || price <= 0) {
    return (
      <div className="flex items-center justify-end gap-1 text-text-muted opacity-50" title="Недоступно / Нет в продаже">
        <PackageX className="w-3 h-3" />
        <span className="font-blender-medium text-type-caption uppercase tracking-widest">Нет</span>
      </div>
    );
  }
  const isUSD = currency === 'USD';
  const isEUR = currency === 'EUR';
  const displayText = isUSD
    ? `$${formatCompactNumber(price)}`
    : isEUR
    ? `€${formatCompactNumber(price)}`
    : `${formatCompactNumber(price)} ₽`;
  const colorClass = isBestSell
    ? 'text-(--primary)'
    : highlightGreen
    ? 'text-nvg-green'
    : 'text-text-primary';
  const sizeClass = isBestSell ? 'text-type-label' : 'text-xs';
  return (
    <div className="flex items-center justify-end gap-1.5">
      <span
        title={`${price.toLocaleString('ru-RU')} ${isUSD ? '$' : isEUR ? '€' : '₽'}`}
        className={`cursor-help font-blender-medium ${sizeClass} ${colorClass}`}
      >
        {displayText}
      </span>
      {vendor && <VendorIcon vendor={vendor} />}
    </div>
  );
}

/** Buy price с поддержкой USD (Миротворец) */
function renderBuyPrice(eco: ReturnType<typeof getEconomics>) {
  const { minPrice, bestBuy } = eco;
  if (!minPrice || !bestBuy) {
    return (
      <div className="flex items-center justify-end gap-1 text-text-muted opacity-50" title="Недоступно / Нет в продаже">
        <PackageX className="w-3 h-3" />
        <span className="font-blender-medium text-type-caption uppercase tracking-widest">Нет</span>
      </div>
    );
  }
  const isUSD = bestBuy.currency === 'USD';
  const displayText = isUSD
    ? `$${formatCompactNumber(bestBuy.price)}`
    : `${formatCompactNumber(minPrice)} ₽`;
  const tooltip = `${minPrice.toLocaleString('ru-RU')} ₽`;
  return (
    <div className="flex items-center justify-end gap-1.5">
      <span title={tooltip} className={`cursor-help font-blender-medium text-xs text-nvg-green${isUSD ? ' opacity-90' : ''}`}>
        {displayText}
      </span>
      <VendorIcon vendor={bestBuy.vendor} />
    </div>
  );
}

/** Compact penalty cell — shows penalties only if non-zero */
function PenaltyCell({ ergo, speed, turn }: { ergo?: number | null; speed?: number | null; turn?: number | null }) {
  const rows: { label: string; val: number }[] = [];
  if (ergo) rows.push({ label: 'Эрго', val: ergo });
  if (speed) rows.push({ label: 'Скор', val: speed });
  if (turn) rows.push({ label: 'Повор', val: turn });
  if (!rows.length) return <span className="text-text-muted text-xs">—</span>;
  return (
    <div className="flex flex-col gap-px">
      {rows.map(({ label, val }) => (
        <span key={label} className="font-blender-medium text-type-caption text-red-400">
          {label}: {val < 0 ? val : `-${val}`}%
        </span>
      ))}
    </div>
  );
}

// ─── Advanced filters panel ───────────────────────────────────────────────────

interface AdvancedFiltersPanelProps {
  categorySlug: string;
  priceMin: string;
  priceMax: string;
  caliberFilter: string;
  availableCalibers: string[];
  cantBuyTrader: boolean;
  cantBuyFlea: boolean;
  cantSellTrader: boolean;
  cantSellFlea: boolean;
  onPriceMinChange: (v: string) => void;
  onPriceMaxChange: (v: string) => void;
  onCaliberChange: (v: string) => void;
  onCantBuyTraderChange: (v: boolean) => void;
  onCantBuyFleaChange: (v: boolean) => void;
  onCantSellTraderChange: (v: boolean) => void;
  onCantSellFleaChange: (v: boolean) => void;
  onReset: () => void;
}


function AdvancedFiltersPanel({
  categorySlug,
  priceMin, priceMax, caliberFilter,
  availableCalibers,
  cantBuyTrader, cantBuyFlea, cantSellTrader, cantSellFlea,
  onPriceMinChange, onPriceMaxChange, onCaliberChange,
  onCantBuyTraderChange, onCantBuyFleaChange, onCantSellTraderChange, onCantSellFleaChange,
  onReset,
}: AdvancedFiltersPanelProps) {
  const showCaliber = categorySlug === 'ammo' || GUN_SLUGS.has(categorySlug);
  const hasActiveFilters = !!(priceMin || priceMax || caliberFilter
    || cantBuyTrader || cantBuyFlea || cantSellTrader || cantSellFlea);
  const inputClass = 'h-10 w-full rounded border border-lines-hover bg-(--color-base) px-3 font-blender-medium text-type-label uppercase tracking-wider text-text-primary placeholder:text-text-muted transition-colors focus:border-(--primary) focus:outline-none';

  const AVAILABILITY_FILTERS = [
    { flag: cantBuyTrader,  set: onCantBuyTraderChange,  label: 'Купить у торговца' },
    { flag: cantBuyFlea,    set: onCantBuyFleaChange,    label: 'Купить на барахолке' },
    { flag: cantSellTrader, set: onCantSellTraderChange, label: 'Продать торговцу' },
    { flag: cantSellFlea,   set: onCantSellFleaChange,   label: 'Продать на барахолке' },
  ];

  return (
    <div className="animate-[fade-in-up_0.2s_ease-out_both] border-t border-lines-hover/50 pt-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">

        {/* Цена от */}
        <input
          type="number"
          min={0}
          value={priceMin}
          onChange={(e) => onPriceMinChange(e.target.value)}
          placeholder="Цена от, ₽"
          className={inputClass}
        />

        {/* Цена до */}
        <input
          type="number"
          min={0}
          value={priceMax}
          onChange={(e) => onPriceMaxChange(e.target.value)}
          placeholder="Цена до, ₽"
          className={inputClass}
        />

        {/* Калибр */}
        {showCaliber && availableCalibers.length > 0 && (
          <div className="relative">
            <select
              value={caliberFilter}
              onChange={(e) => onCaliberChange(e.target.value)}
              className="h-10 w-full cursor-pointer appearance-none rounded border border-lines-hover bg-card-menu pl-3 pr-8 font-blender-medium text-type-label uppercase tracking-wider text-text-secondary transition-colors focus:border-(--primary) focus:outline-none"
            >
              <option value="">Все калибры</option>
              {availableCalibers.map(c => (
                <option key={c} value={c}>{c.replace('Caliber', '').trim()}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">▾</span>
          </div>
        )}

        {AVAILABILITY_FILTERS.map(({ flag, set, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => set(!flag)}
            className={`h-10 w-full rounded border px-3 text-left font-blender-medium text-type-label uppercase tracking-wider transition-colors duration-200 ${
              flag
                ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-(--primary)'
                : 'border-lines-hover bg-(--color-base) text-text-muted hover:border-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}

        {/* Сбросить расширенные */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="flex h-10 items-center gap-1.5 rounded border border-lines-hover/50 bg-card-menu px-3 font-blender-medium text-xs uppercase tracking-wider text-text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
          >
            <X className="h-4 w-4 shrink-0" />
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Mobile card specs (профильные колонки → чипы карточки) ────────────────────

function penaltyStr(p: CategoryItemProperties): string {
  const parts: string[] = [];
  if (p.ergoPenalty) parts.push(`Эрго -${p.ergoPenalty}`);
  if (p.speedPenalty) parts.push(`Скор -${p.speedPenalty}%`);
  if (p.turnPenalty) parts.push(`Повор -${p.turnPenalty}%`);
  return parts.length ? parts.join(' · ') : '—';
}

/** Пер-категорийные профильные статы для мобильной карточки — зеркалит колонки таблицы (без цен). */
function getCardSpecs(item: ProcessedItem, slug: string): { label: string; value: string }[] {
  const p = item.properties || {};
  const cls = p.class ? `Класс ${p.class}` : 'Нет';

  if (slug === 'headphones') {
    return [{
      label: 'Слух',
      value: p.distanceModifier != null
        ? `+${Math.round((p.distanceModifier - 1) * 100)}%`
        : p.ambientVolume ? `${p.ambientVolume} dB` : '—',
    }];
  }
  if (slug === 'helmets') {
    return [
      { label: 'Класс', value: cls },
      { label: 'Шум', value: p.deafening || 'Н/Д' },
      { label: 'Наушники', value: p.blocksHeadset ? 'Блок.' : 'Нет' },
      { label: 'Прочн', value: fmt(p.durability) },
      { label: 'Штрафы', value: penaltyStr(p) },
    ];
  }
  if (slug === 'armor') {
    return [
      { label: 'Класс', value: cls },
      { label: 'Тип', value: p.armorType ? (ARMOR_TYPE_RU[p.armorType] ?? p.armorType) : '—' },
      { label: 'Прочн', value: fmt(p.durability) },
      { label: 'Штрафы', value: penaltyStr(p) },
      { label: 'Вес', value: item.weight != null ? `${item.weight} кг` : '—' },
    ];
  }
  if (slug === 'components') {
    return [
      { label: 'Класс', value: cls },
      { label: 'Тип', value: p.armorType ? (ARMOR_TYPE_RU[p.armorType] ?? p.armorType) : '—' },
      { label: 'Прочн', value: fmt(p.durability) },
      { label: 'Штрафы', value: penaltyStr(p) },
    ];
  }
  if (slug === 'eyewear' || slug === 'facecovers' || slug === 'masks') {
    return [
      { label: 'Класс', value: cls },
      { label: 'Защита', value: p.blindnessProtection != null ? `${Math.round(p.blindnessProtection * 100)}%` : '—' },
      { label: 'Штрафы', value: penaltyStr(p) },
    ];
  }
  if (slug === 'rigs') {
    return [
      { label: 'Класс', value: p.class ? `Класс ${p.class}` : 'Без брони' },
      { label: 'Вмест', value: p.capacity != null ? `${p.capacity} слот.` : '—' },
      { label: 'Прочн', value: p.class ? fmt(p.durability) : '—' },
      { label: 'Штрафы', value: penaltyStr(p) },
    ];
  }
  if (slug === 'backpacks') {
    return [
      { label: 'Слоты', value: p.capacity != null ? `${p.capacity} слот.` : '—' },
      { label: 'Вес', value: item.weight != null ? `${item.weight} кг` : '—' },
      { label: 'Слот/кг', value: (p.capacity && item.weight) ? `${(p.capacity / item.weight).toFixed(1)}` : '—' },
    ];
  }
  if (CONTAINER_SLUGS.has(slug)) {
    return [
      { label: 'Вмест', value: p.capacity != null ? `${p.capacity} слот.` : '—' },
      { label: 'Размер', value: `${item.width}×${item.height}` },
      { label: 'Соотн', value: p.capacity ? `${(p.capacity / (item.width * item.height)).toFixed(1)}x` : '—' },
    ];
  }
  if (GUN_SLUGS.has(slug)) {
    return [
      { label: 'Калибр', value: p.caliber?.replace('Caliber', '') || '—' },
      { label: 'Эрго', value: p.ergonomics != null ? String(p.ergonomics) : '—' },
      { label: 'Отдача', value: (p.recoilVertical || p.recoilHorizontal) ? `${p.recoilVertical}/${p.recoilHorizontal}` : '—' },
      { label: 'RPM', value: p.fireRate ? String(p.fireRate) : '—' },
      { label: 'Размер', value: `${item.width}×${item.height}` },
    ];
  }
  if (slug === 'ammo') {
    const pen = Number(p.penetrationPower) || 0;
    const frag = p.fragmentationChance != null ? Number(p.fragmentationChance) : null;
    return [
      { label: 'Калибр', value: p.caliber?.replace('Caliber', '') || '—' },
      { label: 'Урон', value: p.damage != null ? String(p.damage) : '—' },
      { label: 'Проб', value: p.penetrationPower != null ? String(p.penetrationPower) : '—' },
      { label: 'Урон бр', value: p.armorDamage ? `${p.armorDamage}%` : '—' },
      { label: 'Фрагм', value: pen < 20 ? 'Блок.' : frag !== null ? `${Math.round(frag * 100)}%` : '—' },
    ];
  }
  if (slug === 'grenades') {
    return [
      { label: 'Тип', value: p.type || '—' },
      { label: 'Осколки', value: p.fragments != null ? String(p.fragments) : '—' },
      { label: 'Взрыв', value: p.fuse != null ? `${p.fuse} с` : '—' },
      { label: 'Радиус', value: p.maxExplosionDistance != null ? `${p.maxExplosionDistance} м` : '—' },
    ];
  }
  if (slug === 'sights') {
    return [
      { label: 'Эрго', value: p.ergonomics != null ? (p.ergonomics > 0 ? `+${p.ergonomics}` : String(p.ergonomics)) : '—' },
      { label: 'Увелич', value: formatZoomLevels(p.zoomLevels ?? undefined) },
      { label: 'Дальн', value: p.sightingRange ? `${p.sightingRange} м` : '—' },
    ];
  }
  if (slug === 'pistolgrips') {
    return [
      { label: 'Эрго', value: p.ergonomics != null ? (p.ergonomics > 0 ? `+${p.ergonomics}` : String(p.ergonomics)) : '—' },
    ];
  }
  if (ERGO_RECOIL_MOD_SLUGS.has(slug)) {
    return [
      { label: 'Эрго', value: p.ergonomics != null ? (p.ergonomics > 0 ? `+${p.ergonomics}` : String(p.ergonomics)) : '—' },
      { label: 'Отдача', value: p.recoilModifier != null ? `${(p.recoilModifier * 100).toFixed(1)}%` : '—' },
    ];
  }
  return [{ label: 'Размер', value: `${item.width}×${item.height}` }];
}

// ─── Table row ────────────────────────────────────────────────────────────────

const CategoryTableRow = memo(forwardRef<
  HTMLTableRowElement,
  { item: ProcessedItem; categorySlug?: string; gpCount?: number; highlighted?: boolean } & React.HTMLAttributes<HTMLTableRowElement>
>(function CategoryTableRow({ item, categorySlug, gpCount, highlighted, ...props }, ref) {
  const slug = categorySlug || '';
  const p = item.properties || {};
  const isComparing = useItemsStore((s) => s.compareIds.includes(item.id));
  const toggleCompare = useItemsStore((s) => s.toggleCompare);

  // Подсветка лучшей цены продажи (amber)
  const tSell = item.eco.bestTraderSell?.price || 0;
  const fSell = item.eco.fleaSell?.price || 0;
  const bestSellIsTrader = tSell > 0 && tSell >= fSell;
  const bestSellIsFlea   = fSell > tSell && fSell > 0;

  return (
    <tr
      ref={ref}
      id={`eft-item-${item.id}`}
      {...props}
      className={`border-b border-lines-hover/40 last:border-0 transition-colors group ${
        highlighted
          ? 'bg-[color-mix(in_srgb,var(--primary)_18%,transparent)]'
          : 'hover:bg-[color-mix(in_srgb,var(--color-card-menu)_60%,transparent)]'
      }`}
    >
      {/* ─── Визуал (fixed) ─── */}
      <td className="px-3 py-2 border-r border-lines-hover/50">
        <div className="relative w-12 h-12 mx-auto bg-linear-to-b from-lines-hover to-(--color-base) border border-lines-hover shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }} />
          <button
            type="button"
            onClick={() => toggleCompare(item.id, slug)}
            aria-label={isComparing ? 'Убрать из сравнения' : 'В сравнение'}
            title={isComparing ? 'Убрать из сравнения' : 'В сравнение'}
            className={`absolute left-0.5 top-0.5 z-20 flex h-5 w-5 items-center justify-center rounded-xs border transition-colors ${
              isComparing
                ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_25%,transparent)] text-(--primary)'
                : 'border-lines-hover bg-(--color-base)/70 text-text-muted opacity-0 group-hover:opacity-100 hover:border-(--primary) hover:text-(--primary)'
            }`}
          >
            <Scale className="h-3 w-3" />
          </button>
          { }
          <img
            src={itemIconUrl(item.id)}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 z-10 w-full h-full object-contain p-1 group-hover:scale-110 transition-transform"
            onError={(e) => {
              if (!e.currentTarget.dataset.triedApi) {
                e.currentTarget.dataset.triedApi = 'true';
                e.currentTarget.src = item.image512pxLink || '/images/placeholder.webp';
              } else if (!e.currentTarget.dataset.triedPlaceholder) {
                e.currentTarget.dataset.triedPlaceholder = 'true';
                e.currentTarget.src = '/images/placeholder.webp';
              }
            }}
          />
        </div>
      </td>

      {/* ─── Название (fixed) ─── */}
      <td className="px-3 py-2 w-40 max-w-40 sm:w-55 sm:max-w-55 md:w-65 md:max-w-65 lg:w-75 lg:max-w-75 xl:w-64 xl:max-w-64">
        <Link href={`/eft/items/item/${item.normalizedName}`} className="flex min-w-0 w-full flex-col overflow-hidden transition-colors group-hover:text-(--primary)">
          <span className="block w-full truncate font-blender-medium text-type-label uppercase leading-none" title={item.name}>{item.name}</span>
          <span className="mt-1 block w-full truncate font-blender-book text-xs text-text-secondary" title={item.shortName}>{item.shortName}</span>
        </Link>
      </td>

      {/* ─── Dynamic columns ─── */}
      {slug === 'headphones' ? (
        <>
          <td className="px-3 py-2 text-center">
            {p.distanceModifier != null
              ? <SemanticBadge color="emerald" label={`+${Math.round((p.distanceModifier - 1) * 100)}%`} title="Множитель дистанции слуха" className="w-fit mx-auto" />
              : <SemanticBadge color="gray" label={p.ambientVolume ? `${p.ambientVolume} dB` : 'Н/Д'} className="w-fit mx-auto" />}
          </td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.fleaBuy?.price, item.eco.fleaBuy?.vendor)}</td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor, false, bestSellIsTrader, item.eco.bestTraderSell?.currency)}</td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor, false, bestSellIsFlea)}</td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : slug === 'helmets' ? (
        <>
          <td className="px-3 py-2 text-center">
            <SemanticBadge
              color={getArmorClassColor(p.class || 0)}
              label={`Класс ${p.class || '?'}`}
              iconClass={p.class ? `icon-eft-armor-class-${p.class}` : undefined}
              iconSizeClass="w-[22px] h-[22px]"
              className="w-fit mx-auto"
            />
          </td>
          <td className="px-3 py-2 text-center text-text-secondary text-type-caption font-blender-medium uppercase">{p.deafening || 'Н/Д'}</td>
          <td className="px-3 py-2 text-center">
            {p.blocksHeadset
              ? <SemanticBadge color="red" label="Блок." title="Блокирует наушники" className="w-fit mx-auto" />
              : <span className="text-nvg-green font-blender-medium text-xs uppercase opacity-80">Нет</span>}
          </td>
          <td className="px-3 py-2 text-center"><span className="font-blender-medium text-xs text-text-primary">{p.durability || 'Н/Д'}</span></td>
          <td className="px-3 py-2"><PenaltyCell ergo={p.ergoPenalty} speed={p.speedPenalty} turn={p.turnPenalty} /></td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : slug === 'armor' ? (
        <>
          <td className="px-3 py-2 text-center">
            <SemanticBadge
              color={getArmorClassColor(p.class || 0)}
              label={`Класс ${p.class || '?'}`}
              iconClass={p.class ? `icon-eft-armor-class-${p.class}` : undefined}
              iconSizeClass="w-[22px] h-[22px]"
              className="w-fit mx-auto"
            />
          </td>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-type-caption uppercase tracking-wider text-text-muted">
              {p.armorType ? (ARMOR_TYPE_RU[p.armorType] ?? p.armorType) : '—'}
            </span>
          </td>
          <td className="px-3 py-2 text-center"><span className="font-blender-medium text-xs text-text-primary">{fmt(p.durability)}</span></td>
          <td className="px-3 py-2"><PenaltyCell ergo={p.ergoPenalty} speed={p.speedPenalty} turn={p.turnPenalty} /></td>
          <td className="px-3 py-2 text-center">
            {item.weight != null
              ? <span className="font-blender-medium text-xs text-text-secondary">{item.weight} кг</span>
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor, false, bestSellIsTrader, item.eco.bestTraderSell?.currency)}</td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : slug === 'components' ? (
        <>
          <td className="px-3 py-2 text-center">
            <SemanticBadge
              color={getArmorClassColor(p.class || 0)}
              label={`Класс ${p.class || '?'}`}
              iconClass={p.class ? `icon-eft-armor-class-${p.class}` : undefined}
              iconSizeClass="w-[22px] h-[22px]"
              className="w-fit mx-auto"
            />
          </td>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-type-caption uppercase tracking-wider text-text-muted">
              {p.armorType ? (ARMOR_TYPE_RU[p.armorType] ?? p.armorType) : '—'}
            </span>
          </td>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-xs text-text-primary">{fmt(p.durability)}</span>
          </td>
          <td className="px-3 py-2"><PenaltyCell ergo={p.ergoPenalty} speed={p.speedPenalty} turn={p.turnPenalty} /></td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : slug === 'eyewear' ? (
        <>
          <td className="px-3 py-2 text-center">
            {p.class
              ? <SemanticBadge color={getArmorClassColor(p.class)} label={`Класс ${p.class}`} iconClass={`icon-eft-armor-class-${p.class}`} iconSizeClass="w-[22px] h-[22px]" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs font-blender-medium">Нет</span>}
          </td>
          <td className="px-3 py-2 text-center">
            {p.blindnessProtection != null
              ? <SemanticBadge color="emerald" label={`${Math.round((p.blindnessProtection || 0) * 100)}%`} title="Защита от слепящих эффектов" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2">
            <PenaltyCell ergo={p.ergoPenalty} speed={p.speedPenalty} turn={p.turnPenalty} />
          </td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : (slug === 'facecovers' || slug === 'masks') ? (
        <>
          <td className="px-3 py-2 text-center">
            {p.class
              ? <SemanticBadge color={getArmorClassColor(p.class)} label={`Класс ${p.class}`} iconClass={`icon-eft-armor-class-${p.class}`} iconSizeClass="w-[22px] h-[22px]" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs font-blender-medium">Нет</span>}
          </td>
          <td className="px-3 py-2 text-center">
            {p.blindnessProtection != null
              ? <SemanticBadge color="emerald" label={`${Math.round((p.blindnessProtection || 0) * 100)}%`} title="Защита от слепящих эффектов" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2"><PenaltyCell ergo={p.ergoPenalty} /></td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : slug === 'rigs' ? (
        <>
          <td className="px-3 py-2 text-center">
            {p.class
              ? <SemanticBadge color={getArmorClassColor(p.class)} label={`Класс ${p.class}`} iconClass={`icon-eft-armor-class-${p.class}`} iconSizeClass="w-[22px] h-[22px]" className="w-fit mx-auto" />
              : <SemanticBadge color="gray" label="Без брони" className="w-fit mx-auto" />}
          </td>
          <td className="px-3 py-2 text-center">
            {p.capacity != null
              ? <SemanticBadge color="emerald" label={`${p.capacity} слот.`} title="Внутренняя вместимость" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-xs text-text-primary">{p.class ? fmt(p.durability) : '—'}</span>
          </td>
          <td className="px-3 py-2"><PenaltyCell ergo={p.ergoPenalty} speed={p.speedPenalty} turn={p.turnPenalty} /></td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : slug === 'backpacks' ? (
        <>
          <td className="px-3 py-2 text-center">
            {p.capacity != null
              ? <SemanticBadge color="emerald" label={`${p.capacity} слот.`} title="Внутренняя вместимость" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-center">
            {item.weight != null
              ? <span className="font-blender-medium text-xs text-text-secondary">{item.weight} кг</span>
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-center">
            {(p.capacity && item.weight)
              ? <SemanticBadge color="amber" label={`${(p.capacity / item.weight).toFixed(1)} сл/кг`} title="Слотов на кг веса" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
          <td className="px-3 py-2 text-right">
            {(p.capacity && item.eco.minPrice)
              ? <span title={`${Math.round(item.eco.minPrice / p.capacity).toLocaleString('ru-RU')} ₽ за внутренний слот`} className="cursor-help font-blender-medium text-xs text-text-muted">
                  {formatCompactNumber(Math.round(item.eco.minPrice / p.capacity))} ₽
                </span>
              : <span className="text-text-muted text-xs">—</span>}
          </td>
        </>
      ) : CONTAINER_SLUGS.has(slug) ? (
        <>
          <td className="px-3 py-2 text-center">
            {p.capacity != null
              ? <SemanticBadge color="emerald" label={`${p.capacity} слот.`} title="Внутренняя вместимость" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-xs text-text-muted">{item.width}×{item.height}</span>
          </td>
          <td className="px-3 py-2 text-center">
            {p.capacity
              ? <SemanticBadge color="amber" label={`${(p.capacity / (item.width * item.height)).toFixed(1)}x`} title="Соотношение внутр. слотов к занятым" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
          <td className="px-3 py-2 text-right">
            {(p.capacity && item.eco.minPrice)
              ? <span title={`${Math.round(item.eco.minPrice / p.capacity).toLocaleString('ru-RU')} ₽ за внутренний слот`} className="cursor-help font-blender-medium text-xs text-text-muted">
                  {formatCompactNumber(Math.round(item.eco.minPrice / p.capacity))} ₽
                </span>
              : <span className="text-text-muted text-xs">—</span>}
          </td>
        </>
      ) : GUN_SLUGS.has(slug) ? (
        <>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-type-caption uppercase tracking-wider text-text-muted">
              {p.caliber?.replace('Caliber', '') || '—'}
            </span>
          </td>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-xs text-nvg-green">{p.ergonomics != null ? p.ergonomics : '—'}</span>
          </td>
          <td className="px-3 py-2 text-center">
            {(p.recoilVertical || p.recoilHorizontal)
              ? <span className="font-blender-medium text-xs text-text-secondary">{p.recoilVertical}/{p.recoilHorizontal}</span>
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-center">
            {p.fireRate ? <SemanticBadge color="amber" label={`${p.fireRate} rpm`} className="w-fit mx-auto" /> : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-xs text-text-muted">{item.width}×{item.height}</span>
          </td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor, false, bestSellIsTrader, item.eco.bestTraderSell?.currency)}</td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : slug === 'ammo' ? (
        <>
          <td className="px-3 py-2 text-center text-text-secondary font-blender-medium text-type-caption">{p.caliber?.replace('Caliber', '') || '—'}</td>
          <td className="px-3 py-2"><SemanticBadge color="red" label={p.damage?.toString() || '—'} className="w-fit mx-auto" /></td>
          <td className="px-3 py-2"><SemanticBadge color="emerald" label={p.penetrationPower?.toString() || '—'} className="w-fit mx-auto" /></td>
          <td className="px-3 py-2"><SemanticBadge color="gray" label={p.armorDamage ? `${p.armorDamage}%` : '—'} className="w-fit mx-auto" /></td>
          <td className="px-3 py-2">
            {(() => {
              const frag = p.fragmentationChance != null ? Number(p.fragmentationChance) : null;
              const pen = Number(p.penetrationPower) || 0;
              const isBlocked = pen < 20;
              const fragLabel = isBlocked ? 'Блок.' : frag !== null ? `${Math.round(frag * 100)}%` : '—';
              return <SemanticBadge color={isBlocked ? "gray" : "amber"} label={fragLabel} isStrike={isBlocked} title={isBlocked ? "Фрагментация невозможна из-за пробития < 20" : "Шанс фрагментации"} className="w-fit mx-auto" />;
            })()}
          </td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : slug === 'grenades' ? (
        <>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-type-caption uppercase tracking-wider text-text-muted">{p.type || '—'}</span>
          </td>
          <td className="px-3 py-2 text-center">
            {p.fragments != null
              ? <SemanticBadge color="red" label={`${p.fragments} осколк.`} title="Количество осколков" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-center">
            {p.fuse != null
              ? <SemanticBadge color="amber" label={`${p.fuse} с`} title="Время задержки взрыва" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-center">
            {p.maxExplosionDistance != null
              ? <SemanticBadge color="gray" label={`${p.maxExplosionDistance} м`} title="Максимальный радиус взрыва" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor, false, bestSellIsTrader, item.eco.bestTraderSell?.currency)}</td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : slug === 'sights' ? (
        <>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-xs text-nvg-green">{p.ergonomics != null ? (p.ergonomics > 0 ? `+${p.ergonomics}` : p.ergonomics) : '—'}</span>
          </td>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-xs text-text-primary">{formatZoomLevels(p.zoomLevels ?? undefined)}</span>
          </td>
          <td className="px-3 py-2 text-center">
            {p.sightingRange
              ? <SemanticBadge color="gray" label={`${p.sightingRange} м`} title="Прицельная дальность" className="w-fit mx-auto" />
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor, false, bestSellIsTrader, item.eco.bestTraderSell?.currency)}</td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor, false, bestSellIsFlea)}</td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : slug === 'pistolgrips' ? (
        <>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-xs text-nvg-green">{p.ergonomics != null ? (p.ergonomics > 0 ? `+${p.ergonomics}` : p.ergonomics) : '—'}</span>
          </td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor, false, bestSellIsTrader, item.eco.bestTraderSell?.currency)}</td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor, false, bestSellIsFlea)}</td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : ERGO_RECOIL_MOD_SLUGS.has(slug) ? (
        <>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-xs text-nvg-green">{p.ergonomics != null ? (p.ergonomics > 0 ? `+${p.ergonomics}` : p.ergonomics) : '—'}</span>
          </td>
          <td className="px-3 py-2 text-center">
            {p.recoilModifier != null
              ? <span className={`font-blender-medium text-xs ${p.recoilModifier < 0 ? 'text-nvg-green' : 'text-red-400'}`}>
                  {p.recoilModifier > 0 ? `+${(p.recoilModifier * 100).toFixed(1)}` : `${(p.recoilModifier * 100).toFixed(1)}`}%
                </span>
              : <span className="text-text-muted text-xs">—</span>}
          </td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor, false, bestSellIsTrader, item.eco.bestTraderSell?.currency)}</td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor, false, bestSellIsFlea)}</td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
        </>
      ) : (
        /* default — all other categories */
        <>
          <td className="px-3 py-2 text-center">
            <span className="font-blender-medium text-xs text-text-muted">{item.width}×{item.height}</span>
          </td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.bestTraderSell?.price, item.eco.bestTraderSell?.vendor, false, bestSellIsTrader, item.eco.bestTraderSell?.currency)}</td>
          <td className="px-3 py-2 text-right">{renderPrice(item.eco.fleaSell?.price, item.eco.fleaSell?.vendor, false, bestSellIsFlea)}</td>
          <td className="px-3 py-2 text-right">{renderBuyPrice(item.eco)}</td>
          <td className="px-3 py-2 text-right">
            {item.eco.vps > 0 ? (
              <span
                title={`${item.eco.vps.toLocaleString('ru-RU')} ₽`}
                className={`cursor-help font-blender-medium text-xs ${item.eco.vps > 10000 ? 'text-nvg-green' : item.eco.vps > 5000 ? 'text-yellow-500' : 'text-text-primary'}`}
              >
                {formatCompactNumber(item.eco.vps)} ₽
              </span>
            ) : (
              <div className="flex items-center justify-end gap-1 text-text-muted opacity-50">
                <PackageX className="w-3 h-3" /><span className="font-blender-medium text-type-caption uppercase tracking-widest">Нет</span>
              </div>
            )}
          </td>
        </>
      )}

      {/* ─── GP Монеты — универсальная последняя колонка ─── */}
      <td className="px-3 py-2 text-center w-14">
        {gpCount ? (
          <div className="flex flex-col items-center gap-px" title={`Купить у Рефа за ${gpCount} ГП монет`}>
            <span className="font-blender-medium text-xs text-(--primary)">{gpCount}</span>
            <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">ГП</span>
          </div>
        ) : <span className="text-text-muted/40 text-type-caption">—</span>}
      </td>
    </tr>
  );
}));

// ─── Main component ───────────────────────────────────────────────────────────

export function ItemsCategoryClient({
  initialData,
  categorySlug,
  gpCoinBarters,
  barterDataMap,
  craftDataMap,
  questDataMap,
  questRefMap,
}: ItemsCategoryClientProps) {
  const {
    searchQuery, setSearchQuery,
    sortConfig,
    activeArmorClasses,
    isLoading,
    barterOnly, setBarterOnly,
    availableOnly, setAvailableOnly,
    isSaved,
    playerLevel,
    priceMin, setPriceMin,
    priceMax, setPriceMax,
    caliberFilter, setCaliberFilter,
    cantBuyTrader, setCantBuyTrader,
    cantBuyFlea, setCantBuyFlea,
    cantSellTrader, setCantSellTrader,
    cantSellFlea, setCantSellFlea,
    favoritesOnly, setFavoritesOnly,
    handleColumnSort,
    handleDropdownSort,
    toggleArmorClass,
    handleSaveFilters,
    resetFilters,
    resetAdvancedFilters,
  } = useCategoryFilters();
  // Табличный вид убран — всегда карточки. Тип расширен, чтобы мёртвые table-ветки компилились.
  const viewMode: 'grid' | 'table' = 'grid';

  const selectedTraders = useItemsStore((state) => state.selectedTraders);
  const setCatalogReturnPath = useItemsStore((s) => s.setCatalogReturnPath);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const focusedRef = useRef<string | null>(null);
  const tasks = useQuestStore((s) => s.tasks);
  const completedQuests = useQuestStore((s) => s.completedQuests);
  const itemProgress = useQuestStore((s) => s.itemProgress);
  const favoriteIds = useFavoritesStore((s) => s.favoriteIds);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeEyewearSubtype, setActiveEyewearSubtype] = useState<EyewearSubtype | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(100);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 639px)');
  const slug = categorySlug || '';

  const availableCalibers = useMemo(() => {
    if (slug !== 'ammo' && !GUN_SLUGS.has(slug)) return [];
    const cals = new Set<string>();
    initialData.forEach(item => { if (item.properties?.caliber) cals.add(item.properties.caliber); });
    return Array.from(cals).sort();
  }, [initialData, slug]);

  const activeAdvancedCount = [
    priceMin, priceMax, caliberFilter,
    cantBuyTrader ? '1' : '', cantBuyFlea ? '1' : '',
    cantSellTrader ? '1' : '', cantSellFlea ? '1' : '',
  ].filter(Boolean).length;

  const eyewearCounts = useMemo(() => {
    if (slug !== 'eyewear') return undefined;
    const counts: Partial<Record<EyewearSubtype | 'all', number>> = { all: 0 };
    for (const item of initialData) {
      const sub = getEyewearSubtype(item);
      if (sub === null) continue;
      counts.all = (counts.all ?? 0) + 1;
      counts[sub] = (counts[sub] ?? 0) + 1;
    }
    return counts;
  }, [initialData, slug]);

  const questCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      for (const obj of task.objectives) {
        if (obj.__typename === 'TaskObjectiveItem' && obj.item?.id) {
          map.set(obj.item.id, (map.get(obj.item.id) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [tasks]);

  // Квест-индикаторы плитки: серверные определения + живой прогресс из персистентного стора.
  const questIndicatorMap = useMemo(
    () => applyQuestProgress(questDataMap ?? {}, questRefMap ?? {}, completedQuests, itemProgress),
    [questDataMap, questRefMap, completedQuests, itemProgress],
  );

  const emptyBarterMap = useMemo<Record<string, EftBarterData>>(() => ({}), []);
  const emptyCraftMap = useMemo<Record<string, EftCraftData>>(() => ({}), []);

  const processedItems = useMemo(() => {
    let data = initialData.map(item => ({ ...item, eco: getEconomics(item) }));

    if (slug === 'eyewear') {
      data = data.filter(item => {
        const sub = getEyewearSubtype(item);
        if (sub === null) return false;
        return activeEyewearSubtype === 'all' || sub === activeEyewearSubtype;
      });
    }

    data = data.filter(item => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!(item.name?.toLowerCase().includes(q) || item.shortName?.toLowerCase().includes(q))) return false;
      }
      if (['armor', 'helmets', 'rigs', 'components', 'eyewear', 'facecovers', 'masks'].includes(slug)) {
        const itemClass = Number(item.properties?.class) || 0;
        if (itemClass > 0 && !activeArmorClasses.includes(itemClass)) return false;
      }
      if (barterOnly && (!item.types || !item.types.includes('barter'))) return false;
      // Advanced filters
      const pMin = priceMin !== '' ? Number(priceMin) : null;
      const pMax = priceMax !== '' ? Number(priceMax) : null;
      if (pMin !== null && item.eco.minPrice < pMin) return false;
      if (pMax !== null && pMax > 0 && item.eco.minPrice > pMax) return false;
      if (caliberFilter && item.properties?.caliber !== caliberFilter) return false;
      // Фильтры доступности
      const isFlVendor = (v: { name: string; normalizedName?: string }) =>
        v.name === 'Flea Market' || v.normalizedName === 'flea-market';
      if (cantBuyTrader && item.buyFor?.some(b => !isFlVendor(b.vendor) && (b.priceRUB ?? b.price) > 0)) return false;
      if (cantBuyFlea && (item.eco.fleaBuy?.price || 0) > 0) return false;
      if (cantSellTrader && (item.eco.bestTraderSell?.price || 0) > 0) return false;
      if (cantSellFlea && (item.eco.fleaSell?.price || 0) > 0) return false;
      // Фильтр по торговцам (мульти-выбор из HubNav)
      if (selectedTraders.length > 0) {
        const passesTrader =
          item.buyFor?.some(o => selectedTraders.includes(o.vendor.normalizedName ?? '')) ||
          item.sellFor?.some(o => selectedTraders.includes(o.vendor.normalizedName ?? ''));
        if (!passesTrader) return false;
      }
      // Доступно мне: есть покупка у торговца ИЛИ барахолка (барахолка ≥ 15 ур.)
      if (availableOnly) {
        const hasTraderBuy = item.buyFor?.some(b => !isFlVendor(b.vendor) && (b.priceRUB ?? b.price) > 0);
        const fleaAccessible = (item.eco.fleaBuy?.price || 0) > 0 && playerLevel >= 15;
        if (!hasTraderBuy && !fleaAccessible) return false;
      }
      if (favoritesOnly && !favoriteIds.includes(item.id)) return false;
      return true;
    });

    // Для корневого роута (все предметы) не применяем сортировку по умолчанию —
    // только если пользователь явно изменил ключ или направление
    const shouldSort = slug !== '' || sortConfig.key !== 'vps' || sortConfig.direction !== 'desc';
    if (shouldSort) data.sort((a, b) => {
      let aValue: string | number = 0;
      let bValue: string | number = 0;
      const p = (x: typeof a) => x.properties || {};

      switch (sortConfig.key) {
        case 'name':              aValue = a.name || ''; bValue = b.name || ''; break;
        case 'sellTrader':        aValue = a.eco.bestTraderSell.price; bValue = b.eco.bestTraderSell.price; break;
        case 'sellFlea':          aValue = a.eco.fleaSell?.price || 0; bValue = b.eco.fleaSell?.price || 0; break;
        case 'buyFlea':           aValue = a.eco.fleaBuy?.price || 0; bValue = b.eco.fleaBuy?.price || 0; break;
        case 'buyMin':            aValue = a.eco.minPrice; bValue = b.eco.minPrice; break;
        case 'vps':               aValue = a.eco.vps; bValue = b.eco.vps; break;
        case 'size':              aValue = a.eco.slots; bValue = b.eco.slots; break;
        case 'class':             aValue = Number(p(a).class) || 0; bValue = Number(p(b).class) || 0; break;
        case 'durability':        aValue = Number(p(a).durability) || 0; bValue = Number(p(b).durability) || 0; break;
        case 'ergoPenalty':       aValue = Number(p(a).ergoPenalty) || 0; bValue = Number(p(b).ergoPenalty) || 0; break;
        case 'speedPenalty':      aValue = Number(p(a).speedPenalty) || 0; bValue = Number(p(b).speedPenalty) || 0; break;
        case 'capacity':          aValue = Number(p(a).capacity) || 0; bValue = Number(p(b).capacity) || 0; break;
        case 'weight':            aValue = a.weight ?? 0; bValue = b.weight ?? 0; break;
        case 'blindnessProtection': aValue = Number(p(a).blindnessProtection) || 0; bValue = Number(p(b).blindnessProtection) || 0; break;
        case 'ambientVolume':       aValue = p(a).ambientVolume || 0; bValue = p(b).ambientVolume || 0; break;
        case 'distanceModifier':    aValue = Number(p(a).distanceModifier) || 0; bValue = Number(p(b).distanceModifier) || 0; break;
        case 'deafening':         aValue = p(a).deafening || ''; bValue = p(b).deafening || ''; break;
        case 'blocksHeadset':     aValue = p(a).blocksHeadset ? 1 : 0; bValue = p(b).blocksHeadset ? 1 : 0; break;
        case 'caliber':           aValue = p(a).caliber || ''; bValue = p(b).caliber || ''; break;
        case 'damage':            aValue = Number(p(a).damage) || 0; bValue = Number(p(b).damage) || 0; break;
        case 'penetration':       aValue = Number(p(a).penetrationPower) || 0; bValue = Number(p(b).penetrationPower) || 0; break;
        case 'armorDamage':       aValue = Number(p(a).armorDamage) || 0; bValue = Number(p(b).armorDamage) || 0; break;
        case 'fragmentation':     aValue = Number(p(a).fragmentationChance) || 0; bValue = Number(p(b).fragmentationChance) || 0; break;
        case 'ergonomics':        aValue = Number(p(a).ergonomics) || 0; bValue = Number(p(b).ergonomics) || 0; break;
        case 'recoil':            aValue = Number(p(a).recoilModifier) || 0; bValue = Number(p(b).recoilModifier) || 0; break;
        case 'recoilVertical':    aValue = Number(p(a).recoilVertical) || 0; bValue = Number(p(b).recoilVertical) || 0; break;
        case 'fireRate':          aValue = Number(p(a).fireRate) || 0; bValue = Number(p(b).fireRate) || 0; break;
        case 'fragments':         aValue = Number(p(a).fragments) || 0; bValue = Number(p(b).fragments) || 0; break;
        case 'fuse':              aValue = Number(p(a).fuse) || 0; bValue = Number(p(b).fuse) || 0; break;
        case 'sightingRange':     aValue = Number(p(a).sightingRange) || 0; bValue = Number(p(b).sightingRange) || 0; break;
        case 'gp':                aValue = (gpCoinBarters ?? {})[a.id] || 0; bValue = (gpCoinBarters ?? {})[b.id] || 0; break;
        case 'indicator': {
          const extractStatNum = (stat: ReturnType<typeof getDynamicTopIndicator>): number => {
            if (stat.kind === 'hidden') return 0;
            if (stat.kind === 'durability') return stat.current;
            if (stat.kind === 'custom') {
              const n = parseFloat(String(stat.value).replace(/[^0-9.\-]/g, ''));
              return isNaN(n) ? 0 : Math.abs(n);
            }
            return stat.value;
          };
          aValue = extractStatNum(getDynamicTopIndicator(a, slug));
          bValue = extractStatNum(getDynamicTopIndicator(b, slug));
          break;
        }
        default:                  aValue = a.eco.vps; bValue = b.eco.vps; break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [initialData, searchQuery, sortConfig, slug, activeArmorClasses, barterOnly, priceMin, priceMax, caliberFilter, gpCoinBarters, activeEyewearSubtype, selectedTraders,
      cantBuyTrader, cantBuyFlea, cantSellTrader, cantSellFlea, availableOnly, playerLevel, favoritesOnly, favoriteIds]);

  useEffect(() => { setVisibleCount(100); }, [processedItems]);
  const handleShowMore = () => setVisibleCount(prev => prev + 100);
  const displayedItems = processedItems.slice(0, visibleCount);

  // Запоминаем текущий раздел каталога (с видом/фильтрами из URL, но без focus) —
  // чтобы кнопка «База предметов» вернула пользователя ровно сюда.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('focus');
    const qs = params.toString();
    setCatalogReturnPath(`${pathname}${qs ? `?${qs}` : ''}`);
  }, [pathname, searchParams, setCatalogReturnPath]);

  // Снять подсветку через 2с.
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(t);
  }, [highlightId]);

  const renderSortableHeader = (label: string, sortKey: string, align: 'left' | 'center' | 'right' = 'left', customClass = '') => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th
        scope="col"
        className={`px-3 py-2 text-type-caption font-blender-medium uppercase tracking-widest cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-card-menu)_60%,transparent)] transition-colors group select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${isActive ? 'text-(--primary)' : 'text-text-muted'} ${customClass}`}
        onClick={() => handleColumnSort(sortKey)}
      >
        <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          {label}
          <span className="w-3 h-3 flex items-center justify-center">
            {isActive
              ? (sortConfig.direction === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
              : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />}
          </span>
        </div>
      </th>
    );
  };

  const tableVirtualizer = useVirtualizer({
    count: !isLoading && viewMode === 'table' ? processedItems.length : 0,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => (isMobile ? 150 : 57),
    overscan: 8,
  });
  const virtualTableRows = tableVirtualizer.getVirtualItems();
  const tablePaddingTop = virtualTableRows.length > 0 ? virtualTableRows[0].start : 0;
  const tablePaddingBottom = virtualTableRows.length > 0
    ? tableVirtualizer.getTotalSize() - virtualTableRows[virtualTableRows.length - 1].end
    : 0;

  // Card-reflow на мобилке: смена высоты строка↔карточка — сброс замеров
  useEffect(() => {
    tableVirtualizer.measure();
  }, [isMobile, tableVirtualizer]);

  // Возврат со страницы предмета (?focus=<id>): прокрутить к предмету и подсветить.
  useEffect(() => {
    if (!focusId || isLoading) return;
    if (focusedRef.current === focusId) return;
    const index = processedItems.findIndex((i) => i.id === focusId);
    if (index < 0) return;

    if (viewMode === 'table') {
      focusedRef.current = focusId;
      setHighlightId(focusId);
      requestAnimationFrame(() => tableVirtualizer.scrollToIndex(index, { align: 'center' }));
      return;
    }

    // Сетка: сначала убедиться, что плитка отрендерена (visibleCount), затем скролл.
    if (index >= visibleCount) {
      setVisibleCount(Math.ceil((index + 1) / 100) * 100);
      return; // дождёмся ререндера — эффект перезапустится по visibleCount
    }
    const el = document.getElementById(`eft-item-${focusId}`);
    if (!el) return; // ещё не в DOM — повторим на следующем ререндере
    focusedRef.current = focusId;
    setHighlightId(focusId);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusId, isLoading, viewMode, processedItems, visibleCount, tableVirtualizer]);

  // Dynamic colspan for skeleton/padding rows (+1 for GP column)
  const dynamicColCount =
    slug === 'headphones' ? 8 :
    slug === 'helmets' ? 9 :
    slug === 'armor' ? 10 :
    slug === 'components' ? 8 :
    slug === 'eyewear' ? 7 :
    (slug === 'facecovers' || slug === 'masks') ? 7 :
    slug === 'rigs' ? 8 :
    slug === 'backpacks' ? 8 :
    CONTAINER_SLUGS.has(slug) ? 8 :
    GUN_SLUGS.has(slug) ? 10 :
    slug === 'ammo' ? 9 :
    slug === 'grenades' ? 9 :
    slug === 'sights' ? 9 :
    slug === 'pistolgrips' ? 7 :
    ERGO_RECOIL_MOD_SLUGS.has(slug) ? 8 :
    8; // default

  return (
    <div className="w-full flex flex-col gap-6">

      <div className={`sticky top-0 z-40 border-b border-lines-hover/20 bg-[color-mix(in_srgb,var(--color-base)_88%,transparent)] backdrop-blur-md transition-all duration-300${showAdvanced ? ' pb-3' : ''}`}>
        <CategoryControlBar
          categorySlug={categorySlug}
          searchQuery={searchQuery}
          sortConfig={sortConfig}
          activeArmorClasses={activeArmorClasses}
          barterOnly={barterOnly}
          availableOnly={availableOnly}
          favoritesOnly={favoritesOnly}
          isSaved={isSaved}
          showAdvanced={showAdvanced}
          activeAdvancedCount={activeAdvancedCount}
          onSearchChange={setSearchQuery}
          onDropdownSort={handleDropdownSort}
          onArmorClassToggle={toggleArmorClass}
          onBarterOnlyChange={setBarterOnly}
          onAvailableOnlyChange={setAvailableOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          onSaveFilters={handleSaveFilters}
          onToggleAdvanced={() => setShowAdvanced(v => !v)}
        />

        {showAdvanced && (
          <AdvancedFiltersPanel
            categorySlug={slug}
            priceMin={priceMin}
            priceMax={priceMax}
            caliberFilter={caliberFilter}
            availableCalibers={availableCalibers}
            cantBuyTrader={cantBuyTrader}
            cantBuyFlea={cantBuyFlea}
            cantSellTrader={cantSellTrader}
            cantSellFlea={cantSellFlea}
            onPriceMinChange={setPriceMin}
            onPriceMaxChange={setPriceMax}
            onCaliberChange={setCaliberFilter}
            onCantBuyTraderChange={setCantBuyTrader}
            onCantBuyFleaChange={setCantBuyFlea}
            onCantSellTraderChange={setCantSellTrader}
            onCantSellFleaChange={setCantSellFlea}
            onReset={resetAdvancedFilters}
          />
        )}
      </div>

      {/* Избранное — стрип над сеткой */}
      {!favoritesOnly && favoriteIds.length > 0 && (
        <FavoritesStrip favoriteIds={favoriteIds} items={initialData} />
      )}

      {/* Eyewear subtype bar */}
      {slug === 'eyewear' && (
        <EyewearSubtypeBar
          active={activeEyewearSubtype}
          onChange={setActiveEyewearSubtype}
          counts={eyewearCounts}
        />
      )}

      {/* Пустой стейт */}
      {!isLoading && processedItems.length === 0 && (
        <div className="relative flex w-full h-100 flex-col items-center justify-center overflow-hidden rounded-lg border border-lines-hover bg-card-menu shadow-lg animate-[fade-in-up_0.5s_ease-out]">
          <div className="pointer-events-none absolute inset-0 opacity-10 bg-hazard-pattern animate-hazard" />
          <div className="relative z-10 flex flex-col items-center text-center px-4">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-lines-hover bg-(--color-base) shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <PackageX className="h-8 w-8 text-text-muted" />
            </div>
            <h3 className="mb-2 font-blender-medium text-xl uppercase tracking-widest text-text-primary">Данные не найдены</h3>
            <p className="mb-8 max-w-md font-blender-book text-xs text-text-secondary">
              База данных пуста или запрос не дал результатов. Попробуйте изменить параметры фильтрации или строку поиска.
            </p>
            <button
              onClick={resetFilters}
              className="group relative inline-flex items-center justify-center overflow-hidden rounded border border-lines-hover bg-(--color-base) px-8 py-2 transition-all duration-300 hover:border-(--primary) hover:shadow-[0_0_15px_color-mix(in_srgb,var(--primary)_20%,transparent)]"
            >
              <div className="absolute inset-0 w-0 bg-(--primary) opacity-10 transition-all duration-300 ease-out group-hover:w-full" />
              <span className="relative z-10 font-blender-medium text-type-label uppercase tracking-widest text-text-secondary transition-colors duration-300 group-hover:text-(--primary)">
                Сбросить фильтры
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Skeleton — сетка */}
      {isLoading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-sm:justify-items-center [&>*]:max-sm:max-w-64 animate-[fade-in-up_0.3s_ease-out]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="tactical-card-base p-4 flex flex-col h-62.5 animate-pulse border-lines-hover">
              <div className="flex justify-between items-start mb-4">
                <div className="h-5 w-24 bg-lines-hover/50 rounded" />
                <div className="h-3 w-12 bg-lines-hover/30 rounded" />
              </div>
              <div className="w-full h-24 mb-4 bg-lines-hover/30 rounded-sm" />
              <div className="h-5 w-3/4 bg-lines-hover/50 rounded mb-3" />
              <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-lines-hover/50">
                <div className="h-8 w-full bg-lines-hover/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skeleton — таблица */}
      {isLoading && viewMode === 'table' && (
        <div className="overflow-x-auto animate-[fade-in-up_0.3s_ease-out]">
          <table className="w-full text-sm text-left whitespace-nowrap font-blender-book">
            <thead className="border-b border-lines-hover">
              <tr>{Array.from({ length: dynamicColCount }).map((_, i) => <th key={i} className="px-3 py-2 h-10" />)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: 15 }).map((_, i) => (
                <tr key={i} className="border-b border-lines-hover last:border-0 animate-pulse">
                  <td className="px-4 py-2 border-r border-lines-hover/50"><div className="w-12 h-12 bg-lines-hover/50 rounded-sm mx-auto" /></td>
                  <td className="px-3 py-2"><div className="flex flex-col gap-2"><div className="h-4 w-3/4 bg-lines-hover/50 rounded" /><div className="h-3 w-1/2 bg-lines-hover/30 rounded" /></div></td>
                  {Array.from({ length: dynamicColCount - 2 }).map((_, j) => (
                    <td key={j} className="px-3 py-2"><div className="h-4 w-16 bg-lines-hover/50 rounded mx-auto" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Вид: сетка */}
      {!isLoading && viewMode === 'grid' && processedItems.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-sm:justify-items-center [&>*]:max-sm:max-w-64">
            {displayedItems.map((item) => {
              const eftItem = toEftItem(
                item,
                slug,
                questCountMap.get(item.id),
                barterDataMap ?? emptyBarterMap,
                craftDataMap ?? emptyCraftMap,
                questIndicatorMap,
              );
              return (
                <EftItemTile.Root
                  key={item.id}
                  item={eftItem}
                  categorySlug={slug}
                  anchorId={`eft-item-${item.id}`}
                  highlighted={highlightId === item.id}
                >
                  <EftItemTile.Header />
                  <EftItemTile.Media />
                  <EftItemTile.Name />
                  <EftItemTile.Pricing />
                </EftItemTile.Root>
              );
            })}
          </div>
          {visibleCount < processedItems.length && (
            <div className="flex justify-center w-full mt-8 mb-12">
              <button
                onClick={handleShowMore}
                className="px-6 py-2.5 bg-zinc-900/80 border border-zinc-700 text-zinc-400 text-sm font-medium font-['Blender_Pro'] uppercase tracking-wider rounded hover:bg-zinc-800 hover:border-zinc-500 hover:text-gray-100 transition-all duration-200 active:scale-95"
              >
                Показать еще ({processedItems.length - visibleCount})
              </button>
            </div>
          )}
        </>
      )}

      {/* Вид: таблица */}
      {!isLoading && viewMode === 'table' && processedItems.length > 0 && (
        <div ref={tableContainerRef} className="overflow-auto max-h-[calc(100vh-260px)]">
          {isMobile ? (
            <div className="relative">
              {tablePaddingTop > 0 && <div style={{ height: tablePaddingTop }} />}
              {virtualTableRows.map((virtualRow) => {
                const item = processedItems[virtualRow.index];
                const sell = item.eco.bestSell as { price: number; priceRUB?: number };
                return (
                  <ItemCard
                    key={item.id}
                    data-index={virtualRow.index}
                    ref={tableVirtualizer.measureElement}
                    href={`/eft/items/item/${item.normalizedName}`}
                    iconLink={item.image512pxLink}
                    shortName={item.shortName}
                    name={item.name}
                    backgroundColor={item.backgroundColor}
                    stats={[
                      { label: 'Покупка', value: item.eco.minPrice },
                      { label: 'Продажа', value: sell.priceRUB ?? sell.price, tone: 'positive' },
                      { label: 'Выг/слот', value: item.eco.vps, tone: 'accent' },
                    ]}
                    specs={getCardSpecs(item, categorySlug || '')}
                  />
                );
              })}
              {tablePaddingBottom > 0 && <div style={{ height: tablePaddingBottom }} />}
            </div>
          ) : (
          <table className="w-full text-sm text-left whitespace-nowrap font-blender-book">
            <thead className="sticky top-0 z-10 bg-(--color-base) border-b border-lines-hover">
              <tr>
                <th scope="col" className="px-3 py-2 text-type-caption font-blender-medium text-text-muted uppercase tracking-widest w-16 text-center border-r border-lines-hover/50">
                  Визуал
                </th>
                {renderSortableHeader('Предмет', 'name', 'left', 'w-40 max-w-40 sm:w-55 sm:max-w-55 md:w-65 md:max-w-65 lg:w-75 lg:max-w-75 xl:w-64 xl:max-w-64')}

                {slug === 'headphones' ? (<>
                  {renderSortableHeader('Дистанция', 'distanceModifier', 'center')}
                  {renderSortableHeader('Покупка (Бар.)', 'buyFlea', 'right')}
                  {renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}
                  {renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : slug === 'helmets' ? (<>
                  {renderSortableHeader('Класс', 'class', 'center')}
                  {renderSortableHeader('Шум', 'deafening', 'center')}
                  {renderSortableHeader('Наушники', 'blocksHeadset', 'center')}
                  {renderSortableHeader('Прочн.', 'durability', 'center')}
                  {renderSortableHeader('Штрафы', 'ergoPenalty', 'left')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : slug === 'armor' ? (<>
                  {renderSortableHeader('Класс', 'class', 'center')}
                  {renderSortableHeader('Тип', 'name', 'center')}
                  {renderSortableHeader('Прочн.', 'durability', 'center')}
                  {renderSortableHeader('Штрафы', 'ergoPenalty', 'left')}
                  {renderSortableHeader('Вес', 'weight', 'center')}
                  {renderSortableHeader('Продать', 'sellTrader', 'right')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : slug === 'components' ? (<>
                  {renderSortableHeader('Класс', 'class', 'center')}
                  {renderSortableHeader('Тип', 'name', 'center')}
                  {renderSortableHeader('Прочн.', 'durability', 'center')}
                  {renderSortableHeader('Штрафы', 'ergoPenalty', 'left')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : slug === 'eyewear' ? (<>
                  {renderSortableHeader('Класс', 'class', 'center')}
                  {renderSortableHeader('Защита зрения', 'blindnessProtection', 'center')}
                  {renderSortableHeader('Штрафы', 'ergoPenalty', 'left')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : (slug === 'facecovers' || slug === 'masks') ? (<>
                  {renderSortableHeader('Класс', 'class', 'center')}
                  {renderSortableHeader('Защита зрения', 'blindnessProtection', 'center')}
                  {renderSortableHeader('Штрафы', 'ergoPenalty', 'left')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : slug === 'rigs' ? (<>
                  {renderSortableHeader('Класс', 'class', 'center')}
                  {renderSortableHeader('Вместимость', 'capacity', 'center')}
                  {renderSortableHeader('Прочн.', 'durability', 'center')}
                  {renderSortableHeader('Штрафы', 'ergoPenalty', 'left')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : slug === 'backpacks' ? (<>
                  {renderSortableHeader('Слоты', 'capacity', 'center')}
                  {renderSortableHeader('Вес', 'weight', 'center')}
                  {renderSortableHeader('Слот/кг', 'capacity', 'center')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                  {renderSortableHeader('Цена/слот', 'buyMin', 'right')}
                </>) : CONTAINER_SLUGS.has(slug) ? (<>
                  {renderSortableHeader('Вместимость', 'capacity', 'center')}
                  {renderSortableHeader('Размер', 'size', 'center')}
                  {renderSortableHeader('Соотношение', 'capacity', 'center')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                  {renderSortableHeader('Цена/слот', 'buyMin', 'right')}
                </>) : GUN_SLUGS.has(slug) ? (<>
                  {renderSortableHeader('Калибр', 'caliber', 'center')}
                  {renderSortableHeader('Эрго', 'ergonomics', 'center')}
                  {renderSortableHeader('Отдача В/Г', 'recoilVertical', 'center')}
                  {renderSortableHeader('RPM', 'fireRate', 'center')}
                  {renderSortableHeader('Размер', 'size', 'center')}
                  {renderSortableHeader('Продать', 'sellTrader', 'right')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : slug === 'ammo' ? (<>
                  {renderSortableHeader('Калибр', 'caliber', 'center')}
                  {renderSortableHeader('Урон', 'damage', 'center')}
                  {renderSortableHeader('Пробитие', 'penetration', 'center')}
                  {renderSortableHeader('Урон броне', 'armorDamage', 'center')}
                  {renderSortableHeader('Фрагм.', 'fragmentation', 'center')}
                  {renderSortableHeader('Покупка', 'buyMin', 'right')}
                </>) : slug === 'grenades' ? (<>
                  {renderSortableHeader('Тип', 'name', 'center')}
                  {renderSortableHeader('Осколки', 'fragments', 'center')}
                  {renderSortableHeader('Взрыватель', 'fuse', 'center')}
                  {renderSortableHeader('Радиус', 'name', 'center')}
                  {renderSortableHeader('Продать', 'sellTrader', 'right')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : slug === 'sights' ? (<>
                  {renderSortableHeader('Эрго', 'ergonomics', 'center')}
                  {renderSortableHeader('Увеличение', 'name', 'center')}
                  {renderSortableHeader('Дальность', 'sightingRange', 'center')}
                  {renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}
                  {renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : slug === 'pistolgrips' ? (<>
                  {renderSortableHeader('Эрго', 'ergonomics', 'center')}
                  {renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}
                  {renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : ERGO_RECOIL_MOD_SLUGS.has(slug) ? (<>
                  {renderSortableHeader('Эрго', 'ergonomics', 'center')}
                  {renderSortableHeader('Отдача', 'recoil', 'center')}
                  {renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}
                  {renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}
                  {renderSortableHeader('Мин. цена', 'buyMin', 'right')}
                </>) : (<>
                  {renderSortableHeader('Размер', 'size', 'center', 'w-24')}
                  {renderSortableHeader('Продать (Торг.)', 'sellTrader', 'right')}
                  {renderSortableHeader('Продать (Бар.)', 'sellFlea', 'right')}
                  {renderSortableHeader('Купить (Мин.)', 'buyMin', 'right')}
                  {renderSortableHeader('Цена / Слот', 'vps', 'right')}
                </>)}
                {/* GP — универсальная последняя колонка */}
                {renderSortableHeader('ГП Реф', 'gp', 'center', 'w-14')}
              </tr>
            </thead>
            <tbody>
              {tablePaddingTop > 0 && <tr><td style={{ height: tablePaddingTop }} colSpan={dynamicColCount} /></tr>}
              {virtualTableRows.map((virtualRow) => {
                const item = processedItems[virtualRow.index];
                return (
                  <CategoryTableRow
                    key={item.id}
                    item={item}
                    categorySlug={categorySlug}
                    gpCount={gpCoinBarters?.[item.id]}
                    highlighted={highlightId === item.id}
                    data-index={virtualRow.index}
                    ref={tableVirtualizer.measureElement}
                  />
                );
              })}
              {tablePaddingBottom > 0 && <tr><td style={{ height: tablePaddingBottom }} colSpan={dynamicColCount} /></tr>}
            </tbody>
          </table>
          )}
        </div>
      )}

      {/* Сравнение — выезжающий снизу drawer */}
      <CompareDrawer
        items={initialData}
        categorySlug={categorySlug}
        getSpecs={(it) => getCardSpecs({ ...it, eco: getEconomics(it) }, categorySlug || '')}
      />

      {/* Toast: фильтры сохранены */}
      {isSaved && (
        <div className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-100 flex items-center gap-3 rounded border border-lines-hover bg-[color-mix(in_srgb,var(--color-card-menu)_90%,transparent)] p-3 shadow-[0_8px_30px_rgba(0,0,0,0.8)] animate-[fade-in-up_0.3s_ease-out_both] backdrop-blur-md">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-nvg-green text-(--color-base) shadow-[0_0_10px_color-mix(in_srgb,var(--color-nvg-green)_40%,transparent)]">
            <Check className="h-5 w-5 stroke-3" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-blender-medium text-type-label uppercase tracking-widest text-text-primary leading-none mb-1">Настройки сохранены</span>
            <span className="font-blender-book text-xs text-text-secondary leading-none">Текущие фильтры установлены по умолчанию</span>
          </div>
        </div>
      )}
    </div>
  );
}
