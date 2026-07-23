'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PackageX, Coins, Search, X, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { formatCompactNumber } from '@/lib/formatters';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { itemIconUrl } from '@/lib/item-icon';
import { type LootTier, TIER_COLOR, TIER_ORDER, tierOf } from '@/lib/loot-tier.util';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LootItem {
  id: string;
  name: string;
  shortName: string;
  width: number;
  height: number;
  image512pxLink?: string;
  backgroundColor?: string;
  types: string[];
  slots: number;
  traderSell: number;
  traderSellVendor?: { name: string; normalizedName?: string };
  fleaSell: number;
  vps: number;
  minBuy: number;
  minBuyVendor?: { name: string; normalizedName?: string };
  minBuyCurrency?: string;
  minBuyRawPrice?: number;
}

type SortKey = 'name' | 'size' | 'trader' | 'flea' | 'vps' | 'buy';
type SortDir = 'asc' | 'desc';

// ─── Category Filters ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'headphones', label: 'Наушники',    icon: '/icons/eft/03-items/gear/cat-headphones.svg',        types: ['headphones'] },
  { id: 'helmets',    label: 'Шлемы',       icon: '/icons/eft/03-items/gear/cat-helmets.svg',            types: ['helmet'] },
  { id: 'armor',      label: 'Броня',        icon: '/icons/eft/03-items/gear/cat-armor.svg',              types: ['armor'] },
  { id: 'plates',     label: 'Плиты',        icon: '/icons/eft/03-items/gear/cat-gearcomps.svg',          types: ['armorPlate'] },
  { id: 'rigs',       label: 'Разгрузки',    icon: '/icons/eft/03-items/gear/cat-tactical-rigs.svg',      types: ['rig'] },
  { id: 'backpacks',  label: 'Рюкзаки',      icon: '/icons/eft/03-items/gear/cat-backpacks.svg',          types: ['backpack'] },
  { id: 'masks',      label: 'Маски',         icon: '/icons/eft/03-items/gear/cat-masks.svg',              types: ['wearable'] },
  { id: 'glasses',    label: 'Очки',          icon: '/icons/eft/03-items/gear/cat-visors.svg',             types: ['glasses'] },
  { id: 'firearms',   label: 'Оружие',        icon: '/icons/eft/03-items/guns.svg',                        types: ['gun'] },
  { id: 'mods',       label: 'Моды',          icon: '/icons/eft/03-items/guns/cat-gunmods.svg',            types: ['mods'] },
  { id: 'ammo',       label: 'Патроны',       icon: '/icons/eft/03-items/guns/cat-ammo.svg',               types: ['ammo'] },
  { id: 'grenades',   label: 'Гранаты',       icon: '/icons/eft/03-items/guns/cat-grenades.svg',           types: ['grenade'] },
  { id: 'meds',       label: 'Медицина',      icon: '/icons/eft/03-items/equipment/meds.svg',              types: ['meds', 'drug', 'stimulator', 'medical', 'injectors', 'pills'] },
  { id: 'keys',       label: 'Ключи',         icon: '/icons/eft/03-items/equipment/keys.svg',              types: ['keys', 'keycard'] },
  { id: 'containers', label: 'Контейнеры',    icon: '/icons/eft/03-items/equipment/containers.svg',        types: ['container'] },
  { id: 'provisions', label: 'Провизия',      icon: '/icons/eft/03-items/equipment/provisions.svg',        types: ['provisions', 'food', 'drink'] },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function VendorIcon({ vendor }: { vendor?: { name: string; normalizedName?: string } }) {
  if (!vendor || vendor.name === '-') return null;
  if (vendor.name === 'Flea Market' || vendor.normalizedName === 'flea-market')
    return <Coins className="h-3.5 w-3.5 shrink-0 text-yellow-500/70" />;
   
  return <img src={`/images/traders/eft/${vendor.normalizedName}.webp`} alt={vendor.name} title={vendor.name} className="h-3.5 w-3.5 shrink-0 rounded-xs object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
}

function PriceCell({ price, vendor, amber = false }: { price: number; vendor?: { name: string; normalizedName?: string }; amber?: boolean }) {
  if (!price) return (
    <div className="flex items-center justify-end gap-1 text-text-muted/40">
      <PackageX className="h-3 w-3" />
    </div>
  );
  return (
    <div className="flex items-center justify-end gap-1.5">
      <span title={`${price.toLocaleString('ru-RU')} ₽`} className={`cursor-help font-blender-medium text-xs ${amber ? 'text-(--primary) text-type-label' : 'text-text-primary'}`}>
        {formatCompactNumber(price)} ₽
      </span>
      <VendorIcon vendor={vendor} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LootRateClientProps { items: LootItem[] }

export function LootRateClient({ items }: LootRateClientProps) {
  const [activeCategories, setActiveCategories] = useState<Set<CategoryId>>(new Set());
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('vps');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [tierMode, setTierMode] = useState(false);
  const [tierFilter, setTierFilter] = useState<LootTier | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const toggleTierMode = () => {
    setTierMode(prev => !prev);
    setTierFilter(null);
  };

  const toggleCategory = (id: CategoryId) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearCategories = () => setActiveCategories(new Set());

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  const processed = useMemo(() => {
    let result = [...items];

    if (activeCategories.size > 0) {
      const allowedTypes = new Set<string>();
      activeCategories.forEach(catId => {
        const cat = CATEGORIES.find(c => c.id === catId);
        cat?.types.forEach(t => allowedTypes.add(t));
      });
      result = result.filter(item => item.types.some(t => allowedTypes.has(t)));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.shortName.toLowerCase().includes(q));
    }

    if (tierMode && tierFilter) {
      result = result.filter(i => i.vps > 0 && tierOf(i.vps) === tierFilter);
    }

    result.sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      switch (sortKey) {
        case 'name':   av = a.name;       bv = b.name;       break;
        case 'size':   av = a.slots;      bv = b.slots;      break;
        case 'trader': av = a.traderSell; bv = b.traderSell; break;
        case 'flea':   av = a.fleaSell;   bv = b.fleaSell;   break;
        case 'vps':    av = a.vps;        bv = b.vps;        break;
        case 'buy':    av = a.minBuy;     bv = b.minBuy;     break;
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av - (bv as number)) : ((bv as number) - av);
    });

    return result;
  }, [items, activeCategories, search, sortKey, sortDir, tierMode, tierFilter]);

  const gridCols = tierMode
    ? 'grid-cols-[48px_1fr_56px_120px_120px_44px_100px]'
    : 'grid-cols-[48px_1fr_56px_120px_120px_100px]';

  const rowVirtualizer = useVirtualizer({
    count: processed.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 57,
    overscan: 10,
  });

  const SortBtn = ({ label, k, align = 'right' }: { label: string; k: SortKey; align?: string }) => {
    const active = sortKey === k;
    return (
      <button
        onClick={() => handleSort(k)}
        className={`flex items-center gap-1 font-blender-medium text-type-caption uppercase tracking-widest transition-colors hover:text-text-primary ${align === 'right' ? 'justify-end' : 'justify-start'} ${active ? 'text-(--primary)' : 'text-text-muted'}`}
      >
        {label}
        {active
          ? (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)
          : <ChevronDown className="h-3 w-3 opacity-30" />}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Фильтры категорий (иконки) ── */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => {
          const isActive = activeCategories.has(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              title={cat.label}
              className={`group flex flex-col items-center gap-1 rounded border px-2.5 py-1.5 transition-all duration-200 ${
                isActive
                  ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_20%,transparent)]'
                  : 'border-lines-hover bg-card-menu hover:border-text-secondary/50'
              }`}
            >
              <div
                className="h-5 w-5 shrink-0 mask-contain mask-center mask-no-repeat transition-colors"
                style={{
                  maskImage: `url(${cat.icon})`,
                  WebkitMaskImage: `url(${cat.icon})`,
                  backgroundColor: isActive ? 'var(--primary)' : 'var(--color-text-muted)',
                }}
              />
              <span className={`font-blender-medium text-type-caption uppercase leading-none tracking-widest transition-colors ${isActive ? 'text-(--primary)' : 'text-text-muted group-hover:text-text-secondary'}`}>
                {cat.label}
              </span>
            </button>
          );
        })}
        {activeCategories.size > 0 && (
          <button
            onClick={clearCategories}
            className="flex flex-col items-center gap-1 rounded border border-lines-hover/50 bg-card-menu px-2.5 py-1.5 transition-colors hover:border-red-500/50 hover:text-red-400"
          >
            <X className="h-5 w-5 text-text-muted" />
            <span className="font-blender-medium text-type-caption uppercase leading-none tracking-widest text-text-muted">Сброс</span>
          </button>
        )}
      </div>

      {/* ── Контрол-бар ── */}
      <div className="sticky top-0 z-40 flex flex-col gap-2 bg-(--color-base) py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 flex-1 items-center rounded border border-lines-hover bg-(--color-base) px-3 transition-colors focus-within:border-(--primary)">
            <Search className="mr-2 h-4 w-4 shrink-0 text-text-muted" />
            <input
              type="text"
              placeholder="ПОИСК ПРЕДМЕТА..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent font-blender-medium text-type-label uppercase tracking-wider text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            {search && <button onClick={() => setSearch('')} className="ml-2 text-text-muted hover:text-(--primary)"><X className="h-4 w-4" /></button>}
          </div>
          <button
            type="button"
            onClick={toggleTierMode}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded border px-3 font-blender-medium text-type-label uppercase tracking-widest transition-all duration-200 ${
              tierMode
                ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)'
                : 'border-lines-hover bg-card-menu text-text-muted hover:border-text-secondary/50 hover:text-text-secondary'
            }`}
          >
            <Layers className="h-4 w-4" />
            Тиры
          </button>
          <span className="shrink-0 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
            {processed.length.toLocaleString('ru-RU')} предметов
          </span>
        </div>
        {tierMode && (
          <div className="flex items-center gap-1">
            <span className="mr-1 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">Тир:</span>
            <button
              type="button"
              onClick={() => setTierFilter(null)}
              className={`h-8 rounded px-2.5 font-blender-medium text-type-caption uppercase tracking-widest transition-colors ${tierFilter === null ? 'bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Все
            </button>
            {TIER_ORDER.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(cur => (cur === t ? null : t))}
                className={`h-8 w-8 rounded font-blender-medium text-sm transition-colors ${tierFilter === t ? 'bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] ' + TIER_COLOR[t] : `${TIER_COLOR[t]} opacity-70 hover:opacity-100`}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Заголовок таблицы ── */}
      <div className={`grid ${gridCols} items-center gap-2 border-b border-lines-hover pb-2 pr-3`}>
        <span />
        <SortBtn label="Предмет" k="name" align="left" />
        <SortBtn label="Размер" k="size" />
        <SortBtn label="Торговец" k="trader" />
        <SortBtn label="Барахолка" k="flea" />
        {tierMode && <span className="text-center font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">Тир</span>}
        <SortBtn label="₽/Слот" k="vps" />
      </div>

      {/* ── Виртуальный список ── */}
      {processed.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-text-muted">
          <PackageX className="h-8 w-8 opacity-40" />
          <span className="font-blender-medium text-sm uppercase tracking-widest">Предметы не найдены</span>
        </div>
      ) : (
        <div ref={parentRef} className="h-[calc(100vh-370px)] min-h-96 overflow-y-auto" style={{ contain: 'strict' }}>
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {rowVirtualizer.getVirtualItems().map(vRow => {
              const item = processed[vRow.index];
              const vpsColor = item.vps > 10000 ? 'text-nvg-green text-sm' : item.vps > 5000 ? 'text-(--primary) text-sm' : item.vps > 2000 ? 'text-text-primary text-xs' : 'text-text-muted text-xs';
              const tier = item.vps > 0 ? tierOf(item.vps) : null;
              return (
                <div
                  key={vRow.key}
                  data-index={vRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
                >
                  <div className={`grid ${gridCols} items-center gap-2 border-b border-lines-hover/40 pr-3 py-1.5 transition-colors hover:bg-[color-mix(in_srgb,var(--color-card-menu)_60%,transparent)]`}>

                    {/* Изображение */}
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-lines-hover/50">
                      <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }} />
                      { }
                      <img
                        src={itemIconUrl(item.id)}
                        alt={item.shortName}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 z-10 h-full w-full object-contain p-0.5"
                        onError={(e) => {
                          if (!e.currentTarget.dataset.tried) {
                            e.currentTarget.dataset.tried = 'true';
                            e.currentTarget.src = item.image512pxLink || '/images/placeholder.webp';
                          }
                        }}
                      />
                    </div>

                    {/* Название */}
                    <Link href={`/eft/items/item/${item.id}`} className="group/link flex min-w-0 flex-col overflow-hidden">
                      <span className="block truncate font-blender-medium text-type-label uppercase leading-tight text-text-primary transition-colors group-hover/link:text-(--primary)" title={item.name}>
                        {item.name}
                      </span>
                      <span className="mt-0.5 block truncate font-blender-book text-type-caption text-text-muted">
                        {item.shortName}
                      </span>
                    </Link>

                    {/* Размер */}
                    <div className="text-right">
                      <span className="font-blender-medium text-type-caption text-text-muted">
                        {item.width}×{item.height}
                      </span>
                      {item.slots > 1 && (
                        <div className="font-blender-medium text-type-caption text-text-muted/50">{item.slots} сл.</div>
                      )}
                    </div>

                    {/* Торговец */}
                    <PriceCell price={item.traderSell} vendor={item.traderSellVendor} />

                    {/* Барахолка */}
                    <PriceCell price={item.fleaSell} vendor={{ name: 'Flea Market', normalizedName: 'flea-market' }} />

                    {/* Тир */}
                    {tierMode && (
                      <div className="text-center">
                        {tier
                          ? <span className={`font-blender-medium text-sm ${TIER_COLOR[tier]}`}>{tier}</span>
                          : <span className="text-type-caption text-text-muted/40">—</span>}
                      </div>
                    )}

                    {/* Цена/Слот */}
                    <div className="text-right">
                      {item.vps > 0
                        ? <span title={`${item.vps.toLocaleString('ru-RU')} ₽/слот`} className={`cursor-help font-blender-medium leading-none ${vpsColor}`}>{formatCompactNumber(item.vps)} ₽</span>
                        : <PackageX className="ml-auto h-3 w-3 text-text-muted/30" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Итог */}
      <div className="border-t border-lines-hover pt-3">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Показано {processed.length} из {items.length} предметов
        </span>
      </div>
    </div>
  );
}
