'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowRight, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { ProcessedBarter, ProcessedBarterSlot } from './page';
import { formatCompactNumber } from '@/lib/formatters';

// в”Ђв”Ђв”Ђ Types в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type SortKey = 'profit' | 'roi' | 'trader' | 'level' | 'cost' | 'value';
type SortDir = 'asc' | 'desc';

// в”Ђв”Ђв”Ђ Helpers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

const TRADER_NAMES: Record<string, string> = {
  prapor: 'РџСЂР°РїРѕСЂ', therapist: 'РўРµСЂР°РїРµРІС‚', fence: 'РЎРєСѓРїС‰РёРє',
  skier: 'Р›С‹Р¶РЅРёРє', peacekeeper: 'РњРёСЂРѕС‚РІРѕСЂРµС†', mechanic: 'РњРµС…Р°РЅРёРє',
  ragman: 'Р‘Р°СЂР°С…РѕР»СЊС‰РёРє', jaeger: 'Р•РіРµСЂСЊ', ref: 'Р РµС„',
  lightkeeper: 'РњР°СЏРє', 'btr-driver': 'Р‘РўР ',
};

function TraderAvatar({ normalizedName, name, size = 24 }: { normalizedName: string; name: string; size?: number }) {
  return (
     
    <img
      src={`/images/traders/eft/${normalizedName}.webp`}
      alt={name}
      title={TRADER_NAMES[normalizedName] || name}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-xs object-cover"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

function ItemThumb({ slot }: { slot: ProcessedBarterSlot }) {
  return (
    <div
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xs border border-lines-hover bg-card-menu"
      title={`${slot.item.name}\n${slot.count > 1 ? `Г—${slot.count} = ` : ''}${(slot.unitPrice * slot.count).toLocaleString('ru-RU')} в‚Ѕ`}
    >
      { }
      <img
        src={`/images/items/eft/${slot.item.id}.webp`}
        alt={slot.item.shortName}
        className="h-9 w-9 object-contain p-0.5"
        onError={(e) => {
          if (!e.currentTarget.dataset.tried) {
            e.currentTarget.dataset.tried = 'true';
            e.currentTarget.src = slot.item.image512pxLink || '/images/placeholder.webp';
          }
        }}
      />
      {slot.count > 1 && (
        <span className="absolute bottom-0 right-0.5 font-blender-medium text-[9px] leading-none text-(--primary)">
          Г—{slot.count}
        </span>
      )}
    </div>
  );
}

function SlotsCell({ slots, totalRub, isReward }: { slots: ProcessedBarterSlot[]; totalRub: number; isReward: boolean }) {
  const MAX_SHOW = 5;
  const visible = slots.slice(0, MAX_SHOW);
  const rest = slots.length - MAX_SHOW;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {visible.map((s, i) => <ItemThumb key={i} slot={s} />)}
        {rest > 0 && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xs border border-lines-hover bg-card-menu">
            <span className="font-blender-medium text-[10px] text-text-muted">+{rest}</span>
          </div>
        )}
      </div>
      {totalRub > 0 && (
        <span className={`font-blender-medium text-[10px] ${isReward ? 'text-nvg-green' : 'text-text-muted'}`}>
          {formatCompactNumber(totalRub)} в‚Ѕ
        </span>
      )}
    </div>
  );
}

// в”Ђв”Ђв”Ђ Main Component в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

interface BartersClientProps {
  barters: ProcessedBarter[];
}

export function BartersClient({ barters }: BartersClientProps) {
  const [search, setSearch] = useState('');
  const [traderFilter, setTraderFilter] = useState<string>('all');
  const [profitableOnly, setProfitableOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('profit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const parentRef = useRef<HTMLDivElement>(null);

  // РЈРЅРёРєР°Р»СЊРЅС‹Рµ С‚РѕСЂРіРѕРІС†С‹
  const traders = useMemo(() => {
    const seen = new Set<string>();
    const list: { normalizedName: string; name: string }[] = [];
    barters.forEach(b => {
      if (!seen.has(b.trader.normalizedName)) {
        seen.add(b.trader.normalizedName);
        list.push(b.trader);
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [barters]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir(key === 'trader' ? 'asc' : 'desc');
    }
  };

  const processed = useMemo(() => {
    let result = [...barters];

    if (traderFilter !== 'all') {
      result = result.filter(b => b.trader.normalizedName === traderFilter);
    }
    if (profitableOnly) {
      result = result.filter(b => b.profit > 0);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(b =>
        b.trader.name.toLowerCase().includes(q) ||
        b.required.some(r => r.item.name.toLowerCase().includes(q) || r.item.shortName.toLowerCase().includes(q)) ||
        b.reward.some(r => r.item.name.toLowerCase().includes(q) || r.item.shortName.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;
      switch (sortKey) {
        case 'profit':  aVal = a.profit;  bVal = b.profit;  break;
        case 'roi':     aVal = a.roi;     bVal = b.roi;     break;
        case 'cost':    aVal = a.totalCost;  bVal = b.totalCost;  break;
        case 'value':   aVal = a.totalValue; bVal = b.totalValue; break;
        case 'level':   aVal = a.level;   bVal = b.level;   break;
        case 'trader':  aVal = a.trader.name; bVal = b.trader.name; break;
      }
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal - (bVal as number)) : ((bVal as number) - aVal);
    });

    return result;
  }, [barters, traderFilter, profitableOnly, search, sortKey, sortDir]);

  const rowVirtualizer = useVirtualizer({
    count: processed.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 8,
  });

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronDown className="h-3 w-3 text-text-muted/40" />;
    return sortDir === 'desc'
      ? <ChevronDown className="h-3 w-3 text-(--primary)" />
      : <ChevronUp className="h-3 w-3 text-(--primary)" />;
  };

  const SortableHeader = ({ label, k, className = '' }: { label: string; k: SortKey; className?: string }) => (
    <button
      onClick={() => handleSort(k)}
      className={`flex items-center gap-1 font-blender-medium text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary ${className}`}
    >
      {label}
      <SortIcon k={k} />
    </button>
  );

  const totalProfit = useMemo(() => processed.reduce((s, b) => s + (b.profit > 0 ? b.profit : 0), 0), [processed]);
  const profitableCount = useMemo(() => processed.filter(b => b.profit > 0).length, [processed]);

  return (
    <div className="flex flex-col gap-4">

      {/* в”Ђв”Ђ РљРѕРЅС‚СЂРѕР»-Р±Р°СЂ в”Ђв”Ђ */}
      <div className="sticky top-0 z-40 flex w-full flex-wrap items-center gap-2 bg-(--color-base) py-3">

        {/* РџРѕРёСЃРє */}
        <div className="relative flex h-10 min-w-48 flex-1 items-center rounded border border-lines-hover bg-(--color-base) px-3 transition-colors focus-within:border-(--primary)">
          <Search className="mr-2 h-4 w-4 shrink-0 text-text-muted" />
          <input
            type="text"
            placeholder="РџРћРРЎРљ РџРћ РџР Р•Р”РњР•РўРЈ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent font-blender-medium text-[12px] uppercase tracking-wider text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="ml-2 shrink-0 text-text-muted hover:text-(--primary)">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* РўРѕСЂРіРѕРІРµС† */}
        <div className="relative shrink-0">
          <select
            value={traderFilter}
            onChange={e => setTraderFilter(e.target.value)}
            className="h-10 w-44 cursor-pointer appearance-none rounded border border-lines-hover bg-card-menu pl-3 pr-8 font-blender-medium text-[11px] uppercase tracking-wider text-text-secondary transition-colors focus:border-(--primary) focus:outline-none"
          >
            <option value="all">Р’СЃРµ С‚РѕСЂРіРѕРІС†С‹</option>
            {traders.map(t => (
              <option key={t.normalizedName} value={t.normalizedName}>
                {TRADER_NAMES[t.normalizedName] || t.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>

        {/* РўРѕР»СЊРєРѕ РІС‹РіРѕРґРЅС‹Рµ */}
        <button
          onClick={() => setProfitableOnly(v => !v)}
          className={`flex h-10 shrink-0 items-center gap-2 rounded border px-3 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-200 ${
            profitableOnly
              ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-(--primary)'
              : 'border-lines-hover bg-card-menu text-text-muted hover:border-text-secondary hover:text-text-primary'
          }`}
        >
          <TrendingUp className="h-4 w-4 shrink-0" />
          <span>РўРѕР»СЊРєРѕ РІС‹РіРѕРґРЅС‹Рµ</span>
        </button>

        {/* РЎС‚Р°С‚РёСЃС‚РёРєР° */}
        <div className="ml-auto hidden items-center gap-4 xl:flex">
          <div className="flex flex-col items-end">
            <span className="font-blender-medium text-[9px] uppercase tracking-widest text-text-muted">Р’С‹РіРѕРґРЅС‹С… СЃРґРµР»РѕРє</span>
            <span className="font-blender-medium text-sm text-(--primary)">{profitableCount} / {processed.length}</span>
          </div>
          {totalProfit > 0 && (
            <div className="flex flex-col items-end">
              <span className="font-blender-medium text-[9px] uppercase tracking-widest text-text-muted">РњР°РєСЃ. РїСЂРёР±С‹Р»СЊ</span>
              <span className="font-blender-medium text-sm text-nvg-green">{formatCompactNumber(totalProfit)} в‚Ѕ</span>
            </div>
          )}
        </div>
      </div>

      {/* в”Ђв”Ђ Р—Р°РіРѕР»РѕРІРѕРє С‚Р°Р±Р»РёС†С‹ в”Ђв”Ђ */}
      <div className="grid grid-cols-[180px_1fr_32px_1fr_120px_80px] items-center gap-3 border-b border-lines-hover pb-2 pl-2">
        <SortableHeader label="РўРѕСЂРіРѕРІРµС† / РЈСЂ." k="trader" />
        <SortableHeader label="РќСѓР¶РЅС‹Рµ РїСЂРµРґРјРµС‚С‹" k="cost" />
        <span />
        <SortableHeader label="РџРѕР»СѓС‡Р°РµРјС‹Рµ РїСЂРµРґРјРµС‚С‹" k="value" />
        <SortableHeader label="РџСЂРёР±С‹Р»СЊ в‚Ѕ" k="profit" className="justify-end" />
        <SortableHeader label="ROI %" k="roi" className="justify-end" />
      </div>

      {/* в”Ђв”Ђ Р’РёСЂС‚СѓР°Р»СЊРЅС‹Р№ СЃРїРёСЃРѕРє в”Ђв”Ђ */}
      {processed.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-text-muted">
          <TrendingDown className="h-8 w-8 opacity-40" />
          <span className="font-blender-medium text-sm uppercase tracking-widest">Р‘Р°СЂС‚РµСЂС‹ РЅРµ РЅР°Р№РґРµРЅС‹</span>
        </div>
      ) : (
        <div ref={parentRef} className="h-[calc(100vh-320px)] min-h-96 overflow-y-auto" style={{ contain: 'strict' }}>
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {rowVirtualizer.getVirtualItems().map(vRow => {
              const b = processed[vRow.index];
              const isProfit = b.profit > 0;
              return (
                <div
                  key={vRow.key}
                  data-index={vRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
                >
                  <div
                    className={`grid grid-cols-[180px_1fr_32px_1fr_120px_80px] items-center gap-3 border-b border-lines-hover/40 px-2 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--color-card-menu)_60%,transparent)] ${
                      isProfit ? 'hover:border-lines-hover' : ''
                    }`}
                  >
                    {/* РўРѕСЂРіРѕРІРµС† + РЈСЂРѕРІРµРЅСЊ */}
                    <div className="flex items-center gap-2">
                      <TraderAvatar normalizedName={b.trader.normalizedName} name={b.trader.name} size={28} />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-blender-medium text-[11px] uppercase tracking-wide text-text-primary leading-tight">
                          {TRADER_NAMES[b.trader.normalizedName] || b.trader.name}
                        </span>
                        <div
                          className={`icon-eft-profile-rep-${Math.min(Math.max(b.level, 1), 4)} h-3.5 w-3.5 bg-text-muted mask-contain mask-center mask-no-repeat`}
                          title={`РЈСЂРѕРІРµРЅСЊ Р»РѕСЏР»СЊРЅРѕСЃС‚Рё ${b.level}`}
                        />
                      </div>
                    </div>

                    {/* Required */}
                    <SlotsCell slots={b.required} totalRub={b.totalCost} isReward={false} />

                    {/* Arrow */}
                    <ArrowRight className="h-4 w-4 shrink-0 text-text-muted/40" />

                    {/* Reward */}
                    <SlotsCell slots={b.reward} totalRub={b.totalValue} isReward />

                    {/* РџСЂРёР±С‹Р»СЊ */}
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={`font-blender-medium text-sm leading-none ${
                        isProfit ? 'text-(--primary)' : 'text-text-muted/60'
                      }`}>
                        {isProfit ? '+' : ''}{formatCompactNumber(b.profit)} в‚Ѕ
                      </span>
                      {b.totalCost > 0 && (
                        <span className="font-blender-medium text-[9px] text-text-muted">
                          РёР· {formatCompactNumber(b.totalCost)} в‚Ѕ
                        </span>
                      )}
                    </div>

                    {/* ROI */}
                    <div className="flex flex-col items-end">
                      <span className={`font-blender-medium text-sm leading-none ${
                        b.roi > 50 ? 'text-nvg-green' : b.roi > 0 ? 'text-(--primary)' : 'text-text-muted/60'
                      }`}>
                        {b.roi > 0 ? '+' : ''}{b.roi}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* РС‚РѕРіРѕ */}
      <div className="flex items-center justify-between border-t border-lines-hover pt-3">
        <span className="font-blender-medium text-[11px] uppercase tracking-widest text-text-muted">
          РџРѕРєР°Р·Р°РЅРѕ {processed.length} Р±Р°СЂС‚РµСЂРѕРІ
        </span>
        <span className="font-blender-medium text-[11px] uppercase tracking-widest text-text-muted">
          {profitableCount} РІС‹РіРѕРґРЅС‹С… ({processed.length > 0 ? Math.round((profitableCount / processed.length) * 100) : 0}%)
        </span>
      </div>
    </div>
  );
}
