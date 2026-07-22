"use client";

import { useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { PackageX, Check, X, ArrowUp, ArrowDown } from 'lucide-react';
import { EftItemTile } from '@/components/features/items/EftItemTile';
import type { EftItemData, EftBarterData, EftCraftData, EftQuestData } from '@/components/features/items/EftItemTile';
import { applyQuestProgress, type QuestProgressRef } from '@/lib/eft-indicators.economics';
import { useCategoryFilters } from '@/components/features/items/useCategoryFilters';
import { CategoryControlBar } from '@/components/features/items/CategoryControlBar';
import { getDynamicTopIndicator } from '@/lib/item-indicators.util';
import { formatCompactNumber } from '@/lib/formatters';
import { getEyewearSubtype, type EyewearSubtype } from '@/lib/eyewear-filter-config';
import { EyewearSubtypeBar } from '@/components/features/items/EyewearSubtypeBar';
import { SubcategoryBar } from '@/components/features/items/SubcategoryBar';
import { PriceRangeSlider } from '@/components/features/items/PriceRangeSlider';
import { getFilterConfig, type SubcategorySpec } from '@/lib/items-filter-config';
import { useItemsStore } from '@/store/useItemsStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { FavoritesStrip } from '@/components/features/items/FavoritesStrip';
import { CompareDrawer } from '@/components/features/items/CompareDrawer';

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
  bsgCategoryId?: string;
  minLevelForFlea?: number;
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
  /** Курс валют (₽ за $/€) — для переключателя валют в range-фильтре цены. */
  rates?: { usd: number | null; eur: number | null };
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
  const traderBuys = validBuy.filter(b => !isFlea(b));
  const bestTraderBuy = traderBuys.length
    ? traderBuys.reduce((min, curr) => rubVal(curr) < rubVal(min) ? curr : min, traderBuys[0])
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
    traderBuyPrice: bestTraderBuy ? rubVal(bestTraderBuy) : 0,
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
    minLevelForFlea: item.minLevelForFlea,
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

// ─── Advanced filters panel ───────────────────────────────────────────────────

type Currency = 'RUB' | 'USD' | 'EUR';

const CURRENCIES: { key: Currency; iconClass: string; tip: string }[] = [
  { key: 'RUB', iconClass: 'icon-eft-currency-ruble',  tip: 'Рубли' },
  { key: 'USD', iconClass: 'icon-eft-currency-dollar', tip: 'Доллары (Миротворец)' },
  { key: 'EUR', iconClass: 'icon-eft-currency-euro',   tip: 'Евро' },
];

// Универсальная ЛОГ-шкала цены: пол 100₽ → потолок 3M (open-ended сверху «3M+»).
// Нелинейность чинит скос (junk внизу / LEDX-выбросы вверху) и делает шкалу
// консистентной во всех категориях; деления читаются как 1k/10k/100k/1M.
const PRICE_CAP = 3_000_000;
const PRICE_FLOOR = 100;
const LN_RANGE = Math.log(PRICE_CAP / PRICE_FLOOR);
// 7 якорей, ~равномерно распределённых по лог-оси (гармоничные интервалы).
const TICK_ANCHORS = [0, 500, 3000, 20000, 100000, 500000, 3000000];

const niceRound = (n: number): number => {
  if (n <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
};
const priceToPos = (v: number): number =>
  v <= 0 ? 0 : Math.max(0, Math.min(1, Math.log(v / PRICE_FLOOR) / LN_RANGE));
const priceToValue = (pos: number): number =>
  pos <= 0 ? 0 : niceRound(PRICE_FLOOR * Math.exp(pos * LN_RANGE));

interface AdvancedFiltersPanelProps {
  categorySlug: string;
  priceMin: string;
  priceMax: string;
  currency: Currency;
  rates: { usd: number | null; eur: number | null };
  priceBases: Set<'buy' | 'sell'>;
  caliberFilter: string;
  availableCalibers: string[];
  onPriceMinChange: (v: string) => void;
  onPriceMaxChange: (v: string) => void;
  onCurrencyChange: (c: Currency) => void;
  onPriceBasisToggle: (b: 'buy' | 'sell') => void;
  onCaliberChange: (v: string) => void;
  subtypeBar: SubcategorySpec | null;
  activeSubcats: Set<string>;
  onSubcatToggle: (id: string) => void;
  onSubcatClear: () => void;
  onReset: () => void;
}


function AdvancedFiltersPanel({
  categorySlug,
  priceMin, priceMax, currency, rates, priceBases, caliberFilter,
  availableCalibers,
  subtypeBar, activeSubcats,
  onPriceMinChange, onPriceMaxChange, onCurrencyChange, onPriceBasisToggle, onCaliberChange,
  onSubcatToggle, onSubcatClear,
  onReset,
}: AdvancedFiltersPanelProps) {
  const showCaliber = categorySlug === 'ammo' || GUN_SLUGS.has(categorySlug);
  const hasActiveFilters = !!(priceMin || priceMax || caliberFilter || activeSubcats.size > 0);

  const lo = priceMin ? Number(priceMin) : 0;
  const hi = priceMax ? Number(priceMax) : PRICE_CAP;

  const rateFor = (c: Currency) => (c === 'USD' ? rates.usd : c === 'EUR' ? rates.eur : null);
  const rate = rateFor(currency);
  const formatPrice = (rub: number) => {
    if (currency === 'RUB' || !rate) return `${Math.round(rub).toLocaleString('ru-RU')} ₽`;
    const sym = currency === 'USD' ? '$' : '€';
    return `${sym}${Math.round(rub / rate).toLocaleString('ru-RU')}`;
  };
  const formatTick = (rub: number) => {
    const v = currency === 'RUB' || !rate ? rub : rub / rate;
    const num = formatCompactNumber(Math.round(v));
    return currency === 'RUB' || !rate ? `${num} ₽` : `${currency === 'USD' ? '$' : '€'}${num}`;
  };
  const ticks = TICK_ANCHORS.map((v) => ({ value: v, pos: priceToPos(v), label: formatTick(v) }));

  const handleRange = ([nextLo, nextHi]: [number, number]) => {
    onPriceMinChange(nextLo <= 0 ? '' : String(nextLo));
    onPriceMaxChange(nextHi >= PRICE_CAP ? '' : String(nextHi));
  };

  return (
    <div className="animate-[fade-in-up_0.2s_ease-out_both] flex flex-col gap-3 pt-3">

      {/* Одна строка: категории / валюта / диапазон цены */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">

        {/* Категории (подкатегории barter) */}
        {subtypeBar && (
          <SubcategoryBar
            label={subtypeBar.label}
            options={subtypeBar.options}
            active={activeSubcats}
            onToggle={onSubcatToggle}
            onClear={onSubcatClear}
          />
        )}

        {/* Валюта */}
        <div className="flex shrink-0 flex-col gap-2.5">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Валюта
          </span>
          <div className="flex items-center gap-1.5">
            {CURRENCIES.map(({ key, iconClass, tip }) => {
              const disabled = key !== 'RUB' && !rateFor(key);
              const isActive = currency === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => onCurrencyChange(key)}
                  title={disabled ? `${tip} — курс недоступен` : tip}
                  aria-pressed={isActive}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-[background-color,border-color] duration-200 disabled:cursor-not-allowed disabled:opacity-30 ${
                    isActive
                      ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]'
                      : 'border-lines-hover bg-card-menu hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                  }`}
                >
                  <span className={`${iconClass} h-4 w-4 mask-contain mask-no-repeat mask-center ${isActive ? 'bg-(--primary)' : 'bg-text-primary opacity-60'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Диапазон цен — независимые тогглы Купить↑ / Продать↓ (обе включены по умолчанию) */}
        <div className="flex shrink-0 flex-col gap-2.5">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Диапазон цен
          </span>
          <div className="flex items-center gap-1.5">
            {([
              { key: 'buy',  Icon: ArrowUp,   tip: 'Учитывать цену покупки (сколько платить)' },
              { key: 'sell', Icon: ArrowDown, tip: 'Учитывать цену продажи (сколько выручить)' },
            ] as const).map(({ key, Icon, tip }) => {
              const isActive = priceBases.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPriceBasisToggle(key)}
                  title={tip}
                  aria-pressed={isActive}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-colors duration-200 ${
                    isActive
                      ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)'
                      : 'border-lines-hover bg-card-menu text-text-muted hover:border-(--primary) hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Диапазон цены — тянется на всё свободное место; вместо заголовка — живые границы */}
        <div className="flex min-w-64 flex-1 flex-col gap-2.5">
          <div className="flex items-center justify-between font-blender-medium text-type-label leading-none text-(--primary)">
            <span>{formatPrice(lo)}</span>
            <span>{hi >= PRICE_CAP ? `${formatPrice(PRICE_CAP)}+` : formatPrice(hi)}</span>
          </div>
          <div className="px-1">
            <PriceRangeSlider
              value={[lo, hi]}
              onChange={handleRange}
              toPos={priceToPos}
              toValue={priceToValue}
              ticks={ticks}
            />
          </div>
        </div>
      </div>

      {/* Калибр + сброс — в одну линию */}
      {(showCaliber && availableCalibers.length > 0) || hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-3">
          {showCaliber && availableCalibers.length > 0 && (
            <div className="relative w-40">
              <select
                value={caliberFilter}
                onChange={(e) => onCaliberChange(e.target.value)}
                className="h-9 w-full cursor-pointer appearance-none rounded border border-lines-hover bg-card-menu pl-3 pr-8 font-blender-medium text-type-label uppercase tracking-wider text-text-secondary transition-colors focus:border-(--primary) focus:outline-none"
              >
                <option value="">Все калибры</option>
                {availableCalibers.map(c => (
                  <option key={c} value={c}>{c.replace('Caliber', '').trim()}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">▾</span>
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              title="Сбросить расширенные фильтры"
              className="flex h-7 items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-2 font-blender-medium text-type-micro uppercase tracking-widest text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/20 hover:text-red-300"
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              Сбросить
            </button>
          )}
        </div>
      ) : null}
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

// ─── Main component ───────────────────────────────────────────────────────────

export function ItemsCategoryClient({
  initialData,
  categorySlug,
  gpCoinBarters,
  barterDataMap,
  craftDataMap,
  questDataMap,
  questRefMap,
  rates = { usd: null, eur: null },
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
    favoritesOnly, setFavoritesOnly,
    handleDropdownSort,
    toggleArmorClass,
    handleSaveFilters,
    resetFilters,
    resetAdvancedFilters,
  } = useCategoryFilters();

  const [currency, setCurrency] = useState<'RUB' | 'USD' | 'EUR'>('RUB');
  // Базы диапазона цены — независимые тогглы, обе включены по умолчанию.
  const [priceBases, setPriceBases] = useState<Set<'buy' | 'sell'>>(() => new Set(['buy', 'sell']));
  const togglePriceBasis = (b: 'buy' | 'sell') =>
    setPriceBases(prev => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });

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
  const slug = categorySlug || '';
  const config = useMemo(() => getFilterConfig(slug), [slug]);

  // Пер-категорийные фильтры (barter): подкатегория (мульти) + «используется в».
  const [activeBarterSubcats, setActiveBarterSubcats] = useState<Set<string>>(new Set());
  const [usedIn, setUsedIn] = useState<string[]>([]);
  const [needMe, setNeedMe] = useState(false);

  const toggleUsedIn = (key: string) =>
    setUsedIn(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const toggleBarterSubcat = (id: string) =>
    setActiveBarterSubcats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const clearBarterSubcats = () => setActiveBarterSubcats(new Set());

  // Полный сброс: фильтры хука + локальные пер-категорийные (иначе «Сбросить» не спасает).
  const handleResetAll = () => {
    resetFilters();
    setActiveEyewearSubtype('all');
    setActiveBarterSubcats(new Set());
    setUsedIn([]);
    setNeedMe(false);
  };

  const availableCalibers = useMemo(() => {
    if (slug !== 'ammo' && !GUN_SLUGS.has(slug)) return [];
    const cals = new Set<string>();
    initialData.forEach(item => { if (item.properties?.caliber) cals.add(item.properties.caliber); });
    return Array.from(cals).sort();
  }, [initialData, slug]);

  const activeAdvancedCount = [priceMin, priceMax, caliberFilter]
    .filter(Boolean).length + activeBarterSubcats.size;

  const handleResetAdvanced = () => {
    resetAdvancedFilters();
    clearBarterSubcats();
  };

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
      // Подкатегория (мульти, напр. barter BSG). Пустой набор = все.
      if (config.subtypeBar && activeBarterSubcats.size > 0) {
        if (!item.bsgCategoryId || !activeBarterSubcats.has(item.bsgCategoryId)) return false;
      }
      // «Используется в» — предмет должен попасть хотя бы в один выбранный тип связи.
      if (usedIn.length > 0) {
        const inBarter = !!barterDataMap?.[item.id];
        const inCraft  = !!craftDataMap?.[item.id];
        // Квест: тот же источник, что и индикатор на плитке (серверные квест-данные +
        // прогресс). НЕ questCountMap — он строится из useQuestStore.tasks, который вне
        // карты квестов пуст, из-за чего фильтр не находил помеченные квестом предметы.
        const inQuest  = questIndicatorMap.has(item.id);
        const inGp     = !!gpCoinBarters?.[item.id];
        const match = usedIn.some(k =>
          (k === 'barter' && inBarter) ||
          (k === 'craft'  && inCraft)  ||
          (k === 'quest'  && inQuest)  ||
          (k === 'gp'     && inGp));
        if (!match) return false;
      }
      // «Нужно мне» — предмет нужен для НЕзавершённого квеста (по индикатору плитки).
      if (needMe) {
        const q = questIndicatorMap.get(item.id);
        if (!q || q.status === 'completed') return false;
      }
      // Advanced filters
      const pMin = priceMin !== '' ? Number(priceMin) : null;
      const pMax = priceMax !== '' ? Number(priceMax) : null;
      // Диапазон применяется, только если сдвинут хотя бы один край. Предмет проходит,
      // если цена ЛЮБОЙ включённой базы (покупка/продажа) попадает в [pMin, pMax].
      if (pMin !== null || pMax !== null) {
        const bases: number[] = [];
        if (priceBases.has('buy') && item.eco.minPrice > 0) bases.push(item.eco.minPrice);
        if (priceBases.has('sell') && rubVal(item.eco.bestSell) > 0) bases.push(rubVal(item.eco.bestSell));
        const ok = bases.some(pr => (pMin === null || pr >= pMin) && (pMax === null || pr <= pMax));
        if (!ok) return false;
      }
      if (caliberFilter && item.properties?.caliber !== caliberFilter) return false;
      const isFlVendor = (v: { name: string; normalizedName?: string }) =>
        v.name === 'Flea Market' || v.normalizedName === 'flea-market';
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
        case 'buyTrader':         aValue = a.eco.traderBuyPrice; bValue = b.eco.traderBuyPrice; break;
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
      availableOnly, playerLevel, favoritesOnly, favoriteIds,
      config, activeBarterSubcats, usedIn, needMe, priceBases, barterDataMap, craftDataMap, questIndicatorMap]);

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

  // Возврат со страницы предмета (?focus=<id>): прокрутить к предмету и подсветить.
  useEffect(() => {
    if (!focusId || isLoading) return;
    if (focusedRef.current === focusId) return;
    const index = processedItems.findIndex((i) => i.id === focusId);
    if (index < 0) return;

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
  }, [focusId, isLoading, processedItems, visibleCount]);

  return (
    <div className="w-full flex flex-col gap-6">

      {/* Sticky-панель фильтров: контент в контейнере, но фоновая подложка (сплошной фон
          сайта + нижняя линия) тянется на всю ширину вьюпорта через full-bleed псевдоэлемент. */}
      <div className={`sticky top-0 z-40 transition-all duration-300 before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2 before:bg-linear-to-b before:from-transparent before:to-[color-mix(in_srgb,var(--color-base)_84%,transparent)] before:backdrop-blur-md before:content-['']${showAdvanced ? ' pb-3' : ''}`}>
        <CategoryControlBar
          categorySlug={categorySlug}
          config={config}
          searchQuery={searchQuery}
          sortConfig={sortConfig}
          activeArmorClasses={activeArmorClasses}
          barterOnly={barterOnly}
          availableOnly={availableOnly}
          favoritesOnly={favoritesOnly}
          usedIn={usedIn}
          needMe={needMe}
          isSaved={isSaved}
          showAdvanced={showAdvanced}
          activeAdvancedCount={activeAdvancedCount}
          onSearchChange={setSearchQuery}
          onDropdownSort={handleDropdownSort}
          onArmorClassToggle={toggleArmorClass}
          onBarterOnlyChange={setBarterOnly}
          onAvailableOnlyChange={setAvailableOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          onUsedInToggle={toggleUsedIn}
          onNeedMeChange={setNeedMe}
          onSaveFilters={handleSaveFilters}
          onToggleAdvanced={() => setShowAdvanced(v => !v)}
        />

        {showAdvanced && (
          <AdvancedFiltersPanel
            categorySlug={slug}
            priceMin={priceMin}
            priceMax={priceMax}
            currency={currency}
            rates={rates}
            priceBases={priceBases}
            caliberFilter={caliberFilter}
            availableCalibers={availableCalibers}
            onPriceMinChange={setPriceMin}
            onPriceMaxChange={setPriceMax}
            onCurrencyChange={setCurrency}
            onPriceBasisToggle={togglePriceBasis}
            onCaliberChange={setCaliberFilter}
            subtypeBar={config.subtypeBar}
            activeSubcats={activeBarterSubcats}
            onSubcatToggle={toggleBarterSubcat}
            onSubcatClear={clearBarterSubcats}
            onReset={handleResetAdvanced}
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
              onClick={handleResetAll}
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
      {isLoading && (
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

      {/* Вид: сетка */}
      {!isLoading && processedItems.length > 0 && (
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
