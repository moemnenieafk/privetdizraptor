'use client';

import { useMemo, useState } from 'react';
import { calcFleaFee } from '@/lib/barter-calc';

export interface PriceSlotItem {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  width: number;
  height: number;
  basePrice: number;
  backgroundColor?: string;
  bestTraderSell: number;
  bestTraderName: string;
  fleaSell: number;
  changeLast48h?: number;
}

type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

const TIER_THRESHOLDS: { tier: Tier; min: number }[] = [
  { tier: 'S', min: 40_000 },
  { tier: 'A', min: 20_000 },
  { tier: 'B', min: 10_000 },
  { tier: 'C', min: 5_000 },
  { tier: 'D', min: 0 },
];

const TIER_COLOR: Record<Tier, string> = {
  S: 'text-success',
  A: 'text-(--primary)',
  B: 'text-sky-400',
  C: 'text-text-secondary',
  D: 'text-text-muted',
};

// Семантика цветов подложки предметов EFT (для лёгкого левого акцента строки).
const BG_HEX: Record<string, string> = {
  violet: '#4C2A55', yellow: '#666628', orange: '#3C1900', blue: '#1C4156',
  green: '#152D00', red: '#631D1D', black: '#1D1D1D', grey: '#7F7F7F',
};

function tierOf(pps: number): Tier {
  return (TIER_THRESHOLDS.find((t) => pps >= t.min)?.tier ?? 'D');
}
const fmt = (n: number) => n.toLocaleString('ru-RU');

export function PriceSlotClient({ items }: { items: PriceSlotItem[] }) {
  const [intelL3, setIntelL3] = useState(false);
  const [mgmt, setMgmt] = useState(0);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<Tier | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const feeMod = (1 - (intelL3 ? 0.3 : 0)) * (1 - 0.003 * Math.max(0, Math.min(50, mgmt)));

  const computed = useMemo(() => {
    return items
      .map((it) => {
        const slots = Math.max(1, it.width * it.height);
        const fleaFee = it.fleaSell > 0 ? Math.round(calcFleaFee(it.basePrice, it.fleaSell, 1) * feeMod) : 0;
        const fleaNet = it.fleaSell > 0 ? it.fleaSell - fleaFee : Number.NEGATIVE_INFINITY;
        const traderNet = it.bestTraderSell;
        const useFlea = fleaNet > traderNet;
        const bestNet = Math.max(traderNet, fleaNet === Number.NEGATIVE_INFINITY ? 0 : fleaNet);
        const pps = Math.round(bestNet / slots);
        return { it, slots, fleaFee, fleaNet, traderNet, useFlea, bestNet, pps, tier: tierOf(pps) };
      })
      .sort((a, b) => b.pps - a.pps);
  }, [items, feeMod]);

  const q = search.trim().toLowerCase();
  const visible = computed.filter((r) => {
    if (tierFilter && r.tier !== tierFilter) return false;
    if (q && !r.it.name.toLowerCase().includes(q) && !r.it.shortName.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Конфиг убежища + поиск */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-lines-hover bg-card-menu p-3">
          <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">Убежище:</span>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={intelL3} onChange={(e) => setIntelL3(e.target.checked)} className="accent-[var(--primary)]" />
            Развед-центр ур.3 (−30% налог)
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            Навык «Управление убежищем»:
            <input
              type="number"
              min={0}
              max={50}
              value={mgmt}
              onChange={(e) => setMgmt(Number(e.target.value) || 0)}
              className="h-8 w-16 rounded border border-lines-hover bg-(--color-darkbase) px-2 text-text-primary outline-none focus:border-(--primary)"
            />
            <span className="text-text-muted">(−{(0.3 * Math.max(0, Math.min(50, mgmt))).toFixed(1)}%)</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск предмета…"
            className="h-9 min-w-50 flex-1 rounded border border-lines-hover bg-card-menu px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-(--primary)"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTierFilter(null)}
              className={`h-9 rounded px-2.5 text-type-caption font-blender-medium uppercase tracking-widest transition-colors ${tierFilter === null ? 'bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Все
            </button>
            {(['S', 'A', 'B', 'C', 'D'] as Tier[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter((cur) => (cur === t ? null : t))}
                className={`h-9 w-9 rounded text-sm font-blender-medium transition-colors ${tierFilter === t ? 'bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] ' + TIER_COLOR[t] : `${TIER_COLOR[t]} opacity-70 hover:opacity-100`}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <p className="text-type-caption text-text-muted font-blender-book">
          Топ-{items.length} предметов по ₽/слот. ₽/слот = лучшая чистая выручка ÷ (Ш×В). Налог барахолки учтён, цены торговца — мгновенные.
        </p>
      </div>

      {/* Список */}
      <div className="overflow-hidden rounded-md border border-lines-hover">
        <div className="grid grid-cols-[2.5rem_1fr_3rem_6rem_2.5rem_5rem] items-center gap-2 border-b border-lines-hover bg-card-menu px-3 py-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">
          <span>#</span><span>Предмет</span><span className="text-center">Ш×В</span><span className="text-right">₽/слот</span><span className="text-center">Тир</span><span className="text-right">Маршрут</span>
        </div>
        <div className="divide-y divide-lines-hover">
          {visible.map((r, i) => {
            const expanded = expandedId === r.it.id;
            const accent = r.it.backgroundColor ? BG_HEX[r.it.backgroundColor] : undefined;
            return (
              <div key={r.it.id} style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : r.it.id)}
                  className="grid w-full grid-cols-[2.5rem_1fr_3rem_6rem_2.5rem_5rem] items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-card-menu/60"
                >
                  <span className="text-type-caption text-text-muted tabular-nums">{i + 1}</span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-lines-hover bg-(--color-darkbase)">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.it.icon && <img src={r.it.icon} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" />}
                    </span>
                    <span className="truncate text-sm font-blender-medium text-text-primary">{r.it.name}</span>
                  </span>
                  <span className="text-center text-sm text-text-secondary tabular-nums">{r.it.width}×{r.it.height}</span>
                  <span className="text-right text-sm font-blender-medium text-text-primary tabular-nums">{fmt(r.pps)} ₽</span>
                  <span className={`text-center text-sm font-blender-medium ${TIER_COLOR[r.tier]}`}>{r.tier}</span>
                  <span className={`text-right text-type-caption font-blender-medium uppercase tracking-widest ${r.useFlea ? 'text-(--primary)' : 'text-text-secondary'}`}>
                    {r.useFlea ? 'Барахолка' : 'Торговец'}
                  </span>
                </button>

                {expanded && (
                  <div className="grid gap-1.5 bg-(--color-darkbase) px-3 py-3 text-sm sm:grid-cols-2">
                    <Row label="Базовая цена" value={`${fmt(r.it.basePrice)} ₽`} />
                    <Row label="Лучший торговец" value={r.it.bestTraderSell > 0 ? `${r.it.bestTraderName}: ${fmt(r.it.bestTraderSell)} ₽` : '—'} />
                    <Row
                      label="Барахолка (чистыми)"
                      value={r.it.fleaSell > 0 ? `${fmt(r.it.fleaSell)} − ${fmt(r.fleaFee)} налог = ${fmt(Math.round(r.fleaNet))} ₽` : 'нет на барахолке'}
                    />
                    <Row
                      label="Изменение за 48ч"
                      value={r.it.changeLast48h != null ? `${r.it.changeLast48h > 0 ? '↑ +' : '↓ '}${r.it.changeLast48h}%` : '—'}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="py-12 text-center text-sm text-text-muted font-blender-book">Ничего не найдено — измените фильтр или дождитесь данных цен.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:justify-start">
      <span className="text-type-caption uppercase tracking-widest text-text-muted">{label}:</span>
      <span className="text-text-secondary font-blender-book tabular-nums">{value}</span>
    </div>
  );
}
