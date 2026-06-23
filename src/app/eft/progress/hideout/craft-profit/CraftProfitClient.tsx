'use client';

import { useMemo, useState } from 'react';

export interface CraftSlot {
  item: { id: string; name: string; shortName: string; image512pxLink?: string };
  count: number;
  unitPrice: number;
}

export interface ProcessedCraft {
  id: string;
  stationName: string;
  stationNormalized: string;
  stationIcon: string | null;
  level: number;
  duration: number;
  required: CraftSlot[];
  reward: CraftSlot[];
  totalCost: number;
  totalValue: number;
  profit: number;
  profitPerHour: number;
  roi: number;
}

type SortKey = 'pph' | 'profit' | 'roi' | 'duration';

function fmtRub(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}М`;
  if (a >= 1_000) return `${sign}${Math.round(a / 1_000)}к`;
  return `${sign}${a}`;
}

function fmtDur(sec: number): string {
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}ч ${m ? `${m}м` : ''}`.trim() : `${m}м`;
}

function pphColor(pph: number): string {
  if (pph > 20_000) return 'text-success';
  if (pph > 5_000) return 'text-(--primary)';
  if (pph > 0) return 'text-text-secondary';
  return 'text-text-muted';
}

export function CraftProfitClient({ crafts }: { crafts: ProcessedCraft[] }) {
  const [search, setSearch] = useState('');
  const [onlyProfitable, setOnlyProfitable] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('pph');
  const [activeStation, setActiveStation] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Станции: иконка, имя, счётчик, лучший ₽/час
  const stations = useMemo(() => {
    const map = new Map<string, { key: string; name: string; icon: string | null; count: number; maxPph: number }>();
    for (const c of crafts) {
      const key = c.stationNormalized || c.stationName;
      const e = map.get(key) ?? { key, name: c.stationName, icon: c.stationIcon, count: 0, maxPph: -Infinity };
      e.count++;
      e.maxPph = Math.max(e.maxPph, c.profitPerHour);
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.maxPph - a.maxPph);
  }, [crafts]);

  const sortFn = useMemo(() => {
    const by: Record<SortKey, (c: ProcessedCraft) => number> = {
      pph: (c) => c.profitPerHour,
      profit: (c) => c.profit,
      roi: (c) => c.roi,
      duration: (c) => -c.duration,
    };
    return (a: ProcessedCraft, b: ProcessedCraft) => by[sortKey](b) - by[sortKey](a);
  }, [sortKey]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      crafts.filter((c) => {
        if (onlyProfitable && c.profit <= 0) return false;
        if (activeStation && (c.stationNormalized || c.stationName) !== activeStation) return false;
        if (q) {
          const hit = c.reward.some((r) => r.item.name.toLowerCase().includes(q) || r.item.shortName.toLowerCase().includes(q));
          if (!hit) return false;
        }
        return true;
      }),
    [crafts, onlyProfitable, activeStation, q],
  );

  // Группировка по станции (отсортированной по лучшему ₽/час)
  const groups = useMemo(() => {
    const byStation = new Map<string, ProcessedCraft[]>();
    for (const c of filtered) {
      const key = c.stationNormalized || c.stationName;
      const arr = byStation.get(key) ?? [];
      arr.push(c);
      byStation.set(key, arr);
    }
    return stations
      .filter((s) => byStation.has(s.key))
      .map((s) => ({ station: s, rows: byStation.get(s.key)!.sort(sortFn) }));
  }, [filtered, stations, sortFn]);

  const summary = useMemo(() => {
    const profitable = crafts.filter((c) => c.profit > 0);
    const maxPph = profitable.reduce((m, c) => Math.max(m, c.profitPerHour), 0);
    const daySum = profitable.reduce((s, c) => s + c.profit, 0);
    return { count: profitable.length, maxPph, daySum };
  }, [crafts]);

  const SORTS: { key: SortKey; label: string }[] = [
    { key: 'pph', label: '₽/час' },
    { key: 'profit', label: 'Прибыль' },
    { key: 'roi', label: 'ROI' },
    { key: 'duration', label: 'Время' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Контролы */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по результату крафта…"
            className="h-9 min-w-50 flex-1 rounded border border-lines-hover bg-card-menu px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-(--primary)"
          />
          <button
            type="button"
            onClick={() => setOnlyProfitable((v) => !v)}
            className={`h-9 rounded px-3 text-type-caption font-blender-medium uppercase tracking-widest transition-colors ${
              onlyProfitable
                ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)'
                : 'border border-lines-hover bg-card-menu text-text-secondary hover:text-text-primary'
            }`}
          >
            Только прибыльные
          </button>
          <div className="flex items-center gap-1">
            <span className="text-type-caption uppercase tracking-widest text-text-muted">Сорт:</span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSortKey(s.key)}
                className={`h-9 rounded px-2.5 text-type-caption font-blender-medium uppercase tracking-widest transition-colors ${
                  sortKey === s.key ? 'bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Чипы станций */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveStation(null)}
            className={`flex h-9 items-center gap-2 rounded px-3 text-type-caption font-blender-medium uppercase tracking-widest transition-colors ${
              activeStation === null ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)' : 'border border-lines-hover bg-card-menu text-text-secondary hover:text-text-primary'
            }`}
          >
            Все ({crafts.length})
          </button>
          {stations.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveStation((cur) => (cur === s.key ? null : s.key))}
              title={s.name}
              className={`flex h-9 items-center gap-2 rounded px-3 text-type-caption font-blender-medium uppercase tracking-widest transition-colors ${
                activeStation === s.key ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)' : 'border border-lines-hover bg-card-menu text-text-secondary hover:text-text-primary'
              }`}
            >
              {s.icon && (
                <span
                  aria-hidden="true"
                  className={`h-4 w-4 ${activeStation === s.key ? 'bg-(--primary)' : 'bg-text-secondary'}`}
                  style={{ WebkitMaskImage: `url(${s.icon})`, maskImage: `url(${s.icon})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }}
                />
              )}
              {s.name} ({s.count})
            </button>
          ))}
        </div>

        <p className="text-type-caption text-text-muted font-blender-book">
          Прибыльных крафтов: {summary.count} · лучший ₽/час: {fmtRub(summary.maxPph)} · цены продажи без вычета налога барахолки.
        </p>
      </div>

      {/* Группы по станциям */}
      {groups.map(({ station, rows }) => (
        <section key={station.key} className="overflow-hidden rounded-md border border-lines-hover">
          <header className="flex items-center gap-3 bg-card-menu px-4 py-3">
            {station.icon && (
              <span
                aria-hidden="true"
                className="h-6 w-6 bg-(--primary)"
                style={{ WebkitMaskImage: `url(${station.icon})`, maskImage: `url(${station.icon})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }}
              />
            )}
            <h2 className="text-sm font-blender-medium uppercase tracking-widest text-text-primary">{station.name}</h2>
            <span className="text-type-caption uppercase tracking-widest text-text-muted">{rows.length} крафт. · макс {fmtRub(station.maxPph)}/ч</span>
          </header>

          <div className="divide-y divide-lines-hover">
            {rows.map((c) => {
              const expanded = expandedId === c.id;
              const rewardName = c.reward[0]?.item.name ?? '—';
              return (
                <div key={c.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : c.id)}
                    className="grid w-full grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-card-menu/60"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 text-type-caption ${expanded ? 'text-(--primary)' : 'text-text-muted'}`}>{expanded ? '▾' : '▸'}</span>
                      <span className="truncate text-sm font-blender-medium text-text-primary">{rewardName}</span>
                      <span className="shrink-0 rounded-xs border border-lines-hover px-1.5 text-type-caption text-text-muted">ур.{c.level}</span>
                    </span>
                    <span className="w-16 text-right text-sm text-text-secondary tabular-nums">{fmtDur(c.duration)}</span>
                    <span className="w-20 text-right text-sm text-text-secondary tabular-nums">{fmtRub(c.totalCost)}→{fmtRub(c.totalValue)}</span>
                    <span className={`w-16 text-right text-sm font-blender-medium tabular-nums ${c.profit > 0 ? 'text-text-primary' : 'text-text-muted'}`}>{c.profit > 0 ? '+' : ''}{fmtRub(c.profit)}</span>
                    <span className={`w-20 text-right text-sm font-blender-medium tabular-nums ${pphColor(c.profitPerHour)}`}>{fmtRub(c.profitPerHour)}/ч</span>
                  </button>

                  {expanded && (
                    <div className="grid gap-4 bg-(--color-darkbase) px-4 py-3 sm:grid-cols-2">
                      <CraftSlots title="Вход" slots={c.required} />
                      <CraftSlots title="Выход" slots={c.reward} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <p className="py-16 text-center text-sm text-text-muted font-blender-book">Ничего не найдено — измените фильтры.</p>
      )}
    </div>
  );
}

function CraftSlots({ title, slots }: { title: string; slots: CraftSlot[] }) {
  return (
    <div>
      <p className="mb-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {slots.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-lines-hover bg-card-menu">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.item.image512pxLink && <img src={s.item.image512pxLink} alt={s.item.shortName} className="h-full w-full object-contain p-0.5" loading="lazy" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-text-secondary font-blender-book">{s.item.name}</span>
            <span className="shrink-0 text-text-muted tabular-nums">×{s.count}</span>
            <span className="w-16 shrink-0 text-right text-text-secondary tabular-nums">{fmtRub(s.unitPrice * s.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
