'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PackageX, Coins, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCompactNumber } from '@/lib/formatters';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';

// в”Ђв”Ђв”Ђ Types в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

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

// в”Ђв”Ђв”Ђ Category Filters в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

const CATEGORIES = [
  { id: 'headphones', label: 'РќР°СѓС€РЅРёРєРё',    icon: '/icons/eft/03-items/gear/cat-headphones.svg',        types: ['headphones'] },
  { id: 'helmets',    label: 'РЁР»РµРјС‹',       icon: '/icons/eft/03-items/gear/cat-helmets.svg',            types: ['helmet'] },
  { id: 'armor',      label: 'Р‘СЂРѕРЅСЏ',        icon: '/icons/eft/03-items/gear/cat-armor.svg',              types: ['armor'] },
  { id: 'plates',     label: 'РџР»РёС‚С‹',        icon: '/icons/eft/03-items/gear/cat-gearcomps.svg',          types: ['armorPlate'] },
  { id: 'rigs',       label: 'Р Р°Р·РіСЂСѓР·РєРё',    icon: '/icons/eft/03-items/gear/cat-tactical-rigs.svg',      types: ['rig'] },
  { id: 'backpacks',  label: 'Р СЋРєР·Р°РєРё',      icon: '/icons/eft/03-items/gear/cat-backpacks.svg',          types: ['backpack'] },
  { id: 'masks',      label: 'РњР°СЃРєРё',         icon: '/icons/eft/03-items/gear/cat-masks.svg',              types: ['wearable'] },
  { id: 'glasses',    label: 'РћС‡РєРё',          icon: '/icons/eft/03-items/gear/cat-visors.svg',             types: ['glasses'] },
  { id: 'firearms',   label: 'РћСЂСѓР¶РёРµ',        icon: '/icons/eft/03-items/guns.svg',                        types: ['gun'] },
  { id: 'mods',       label: 'РњРѕРґС‹',          icon: '/icons/eft/03-items/guns/cat-gunmods.svg',            types: ['mods'] },
  { id: 'ammo',       label: 'РџР°С‚СЂРѕРЅС‹',       icon: '/icons/eft/03-items/guns/cat-ammo.svg',               types: ['ammo'] },
  { id: 'grenades',   label: 'Р“СЂР°РЅР°С‚С‹',       icon: '/icons/eft/03-items/guns/cat-grenades.svg',           types: ['grenade'] },
  { id: 'meds',       label: 'РњРµРґРёС†РёРЅР°',      icon: '/icons/eft/03-items/equipment/meds.svg',              types: ['meds', 'drug', 'stimulator', 'medical', 'injectors', 'pills'] },
  { id: 'keys',       label: 'РљР»СЋС‡Рё',         icon: '/icons/eft/03-items/equipment/keys.svg',              types: ['keys', 'keycard'] },
  { id: 'containers', label: 'РљРѕРЅС‚РµР№РЅРµСЂС‹',    icon: '/icons/eft/03-items/equipment/containers.svg',        types: ['container'] },
  { id: 'provisions', label: 'РџСЂРѕРІРёР·РёСЏ',      icon: '/icons/eft/03-items/equipment/provisions.svg',        types: ['provisions', 'food', 'drink'] },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

// в”Ђв”Ђв”Ђ Sub-components в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

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
      <span title={`${price.toLocaleString('ru-RU')} в‚Ѕ`} className={`cursor-help font-blender-medium text-xs ${amber ? 'text-(--primary) text-type-label' : 'text-text-primary'}`}>
        {formatCompactNumber(price)} в‚Ѕ
      </span>
      <VendorIcon vendor={vendor} />
    </div>
  );
}

// в”Ђв”Ђв”Ђ Main Component в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

interface LootRateClientProps { items: LootItem[] }

export function LootRateClient({ items }: LootRateClientProps) {
  const [activeCategories, setActiveCategories] = useState<Set<CategoryId>>(new Set());
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('vps');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const parentRef = useRef<HTMLDivElement>(null);

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
  }, [items, activeCategories, search, sortKey, sortDir]);

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

      {/* в”Ђв”Ђ Р¤РёР»СЊС‚СЂС‹ РєР°С‚РµРіРѕСЂРёР№ (РёРєРѕРЅРєРё) в”Ђв”Ђ */}
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
            <span className="font-blender-medium text-type-caption uppercase leading-none tracking-widest text-text-muted">РЎР±СЂРѕСЃ</span>
          </button>
        )}
      </div>

      {/* в”Ђв”Ђ РљРѕРЅС‚СЂРѕР»-Р±Р°СЂ в”Ђв”Ђ */}
      <div className="sticky top-0 z-40 flex items-center gap-3 bg-(--color-base) py-3">
        <div className="relative flex h-10 flex-1 items-center rounded border border-lines-hover bg-(--color-base) px-3 transition-colors focus-within:border-(--primary)">
          <Search className="mr-2 h-4 w-4 shrink-0 text-text-muted" />
          <input
            type="text"
            placeholder="РџРћРРЎРљ РџР Р•Р”РњР•РўРђ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent font-blender-medium text-type-label uppercase tracking-wider text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {search && <button onClick={() => setSearch('')} className="ml-2 text-text-muted hover:text-(--primary)"><X className="h-4 w-4" /></button>}
        </div>
        <span className="shrink-0 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          {processed.length.toLocaleString('ru-RU')} РїСЂРµРґРјРµС‚РѕРІ
        </span>
      </div>

      {/* в”Ђв”Ђ Р—Р°РіРѕР»РѕРІРѕРє С‚Р°Р±Р»РёС†С‹ в”Ђв”Ђ */}
      <div className="grid grid-cols-[48px_1fr_56px_120px_120px_100px] items-center gap-2 border-b border-lines-hover pb-2 pr-3">
        <span />
        <SortBtn label="РџСЂРµРґРјРµС‚" k="name" align="left" />
        <SortBtn label="Р Р°Р·РјРµСЂ" k="size" />
        <SortBtn label="РўРѕСЂРіРѕРІРµС†" k="trader" />
        <SortBtn label="Р‘Р°СЂР°С…РѕР»РєР°" k="flea" />
        <SortBtn label="в‚Ѕ/РЎР»РѕС‚" k="vps" />
      </div>

      {/* в”Ђв”Ђ Р’РёСЂС‚СѓР°Р»СЊРЅС‹Р№ СЃРїРёСЃРѕРє в”Ђв”Ђ */}
      {processed.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-text-muted">
          <PackageX className="h-8 w-8 opacity-40" />
          <span className="font-blender-medium text-sm uppercase tracking-widest">РџСЂРµРґРјРµС‚С‹ РЅРµ РЅР°Р№РґРµРЅС‹</span>
        </div>
      ) : (
        <div ref={parentRef} className="h-[calc(100vh-370px)] min-h-96 overflow-y-auto" style={{ contain: 'strict' }}>
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {rowVirtualizer.getVirtualItems().map(vRow => {
              const item = processed[vRow.index];
              const vpsColor = item.vps > 10000 ? 'text-nvg-green text-sm' : item.vps > 5000 ? 'text-(--primary) text-sm' : item.vps > 2000 ? 'text-text-primary text-xs' : 'text-text-muted text-xs';
              return (
                <div
                  key={vRow.key}
                  data-index={vRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
                >
                  <div className="grid grid-cols-[48px_1fr_56px_120px_120px_100px] items-center gap-2 border-b border-lines-hover/40 pr-3 py-1.5 transition-colors hover:bg-[color-mix(in_srgb,var(--color-card-menu)_60%,transparent)]">

                    {/* РР·РѕР±СЂР°Р¶РµРЅРёРµ */}
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-lines-hover/50">
                      <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }} />
                      { }
                      <img
                        src={`/images/items/eft/${item.id}.webp`}
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

                    {/* РќР°Р·РІР°РЅРёРµ */}
                    <Link href={`/eft/items/item/${item.id}`} className="group/link flex min-w-0 flex-col overflow-hidden">
                      <span className="block truncate font-blender-medium text-type-label uppercase leading-tight text-text-primary transition-colors group-hover/link:text-(--primary)" title={item.name}>
                        {item.name}
                      </span>
                      <span className="mt-0.5 block truncate font-blender-book text-type-caption text-text-muted">
                        {item.shortName}
                      </span>
                    </Link>

                    {/* Р Р°Р·РјРµСЂ */}
                    <div className="text-right">
                      <span className="font-blender-medium text-type-caption text-text-muted">
                        {item.width}Г—{item.height}
                      </span>
                      {item.slots > 1 && (
                        <div className="font-blender-medium text-type-caption text-text-muted/50">{item.slots} СЃР».</div>
                      )}
                    </div>

                    {/* РўРѕСЂРіРѕРІРµС† */}
                    <PriceCell price={item.traderSell} vendor={item.traderSellVendor} />

                    {/* Р‘Р°СЂР°С…РѕР»РєР° */}
                    <PriceCell price={item.fleaSell} vendor={{ name: 'Flea Market', normalizedName: 'flea-market' }} />

                    {/* Р¦РµРЅР°/РЎР»РѕС‚ */}
                    <div className="text-right">
                      {item.vps > 0
                        ? <span title={`${item.vps.toLocaleString('ru-RU')} в‚Ѕ/СЃР»РѕС‚`} className={`cursor-help font-blender-medium leading-none ${vpsColor}`}>{formatCompactNumber(item.vps)} в‚Ѕ</span>
                        : <PackageX className="ml-auto h-3 w-3 text-text-muted/30" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* РС‚РѕРі */}
      <div className="border-t border-lines-hover pt-3">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          РџРѕРєР°Р·Р°РЅРѕ {processed.length} РёР· {items.length} РїСЂРµРґРјРµС‚РѕРІ
        </span>
      </div>
    </div>
  );
}
