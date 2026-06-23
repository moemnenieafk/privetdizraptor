'use client';

import { useMemo, useState } from 'react';
import { useHideoutStore } from '@/store/useHideoutStore';
import { HideoutLevelsPanel, type HideoutStationInfo } from '@/components/features/hideout/HideoutLevelsPanel';

export interface HideoutNeedItem {
  itemId: string;
  itemName: string;
  itemShort: string;
  itemIcon: string;
  total: number;
  sources: { station: string; stationName: string; level: number; count: number }[];
}

type SortKey = 'total' | 'name';

export function HideoutNeededClient({ needs, stations }: { needs: HideoutNeedItem[]; stations: HideoutStationInfo[] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const levels = useHideoutStore((s) => s.levels);

  const anyBuilt = useMemo(() => Object.values(levels).some((v) => v > 0), [levels]);

  // «Осталось»: оставляем только источники для уровней ВЫШЕ уже построенного; пустые предметы убираем.
  const remaining = useMemo(() => {
    return needs
      .map((n) => {
        const sources = n.sources.filter((s) => s.level > (levels[s.station] ?? 0));
        return { ...n, sources, total: sources.reduce((a, b) => a + b.count, 0) };
      })
      .filter((n) => n.sources.length > 0);
  }, [needs, levels]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? remaining.filter((n) => n.itemName.toLowerCase().includes(q) || n.itemShort.toLowerCase().includes(q))
      : remaining;
    return [...list].sort((x, y) =>
      sortKey === 'name' ? x.itemName.localeCompare(y.itemName) : y.total - x.total || x.itemName.localeCompare(y.itemName),
    );
  }, [remaining, search, sortKey]);

  const overall = useMemo(() => {
    const units = remaining.reduce((s, n) => s + n.total, 0);
    return { items: remaining.length, units };
  }, [remaining]);

  return (
    <div className="flex flex-col gap-5">
      <HideoutLevelsPanel stations={stations} />

      {/* Сводка */}
      <div className="rounded-md border border-lines-hover bg-card-menu p-4">
        <span className="text-sm font-blender-medium uppercase tracking-widest text-text-primary">
          {anyBuilt ? 'Осталось собрать' : 'На полную застройку'}: <span className="text-(--primary)">{overall.items}</span> предметов · {overall.units.toLocaleString('ru-RU')} шт.
        </span>
        <p className="mt-1 text-type-caption text-text-muted font-blender-book">
          {anyBuilt
            ? 'С учётом построенных уровней (панель «Моё убежище»). Разверни строку — по каким станциям/уровням осталось.'
            : 'Сумма по всем апгрейдам убежища (валюта исключена). Отметь построенное в «Моё убежище» — покажу остаток.'}
        </p>
      </div>

      {/* Поиск + сортировка */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск предмета…"
          className="h-9 min-w-50 flex-1 rounded border border-lines-hover bg-card-menu px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-(--primary)"
        />
        {([
          { k: 'total', label: 'По кол-ву' },
          { k: 'name', label: 'По названию' },
        ] as { k: SortKey; label: string }[]).map((s) => (
          <button
            key={s.k}
            type="button"
            onClick={() => setSortKey(s.k)}
            className={`h-9 rounded px-3 text-type-caption font-blender-medium uppercase tracking-widest transition-colors ${
              sortKey === s.k
                ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)'
                : 'border border-lines-hover bg-card-menu text-text-secondary hover:text-text-primary'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Список */}
      <div className="overflow-hidden rounded-md border border-lines-hover divide-y divide-lines-hover">
        {visible.map((n) => {
          const expanded = expandedId === n.itemId;
          return (
            <div key={n.itemId}>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : n.itemId)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-card-menu/60"
              >
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-lines-hover bg-(--color-darkbase)">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {n.itemIcon && <img src={n.itemIcon} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" />}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-blender-medium text-text-primary">{n.itemName}</span>
                  <span className="text-type-caption text-text-muted font-blender-book">
                    {n.sources.length} {n.sources.length === 1 ? 'апгрейд' : 'апгрейд(ов)'}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-blender-medium tabular-nums text-text-secondary">×{n.total.toLocaleString('ru-RU')}</span>
                <span className={`shrink-0 text-type-caption ${expanded ? 'text-(--primary)' : 'text-text-muted'}`}>{expanded ? '▾' : '▸'}</span>
              </button>

              {expanded && (
                <div className="bg-(--color-darkbase) px-3 py-2">
                  <ul className="flex flex-col gap-1.5">
                    {n.sources.map((s, i) => (
                      <li key={`${s.station}-${s.level}-${i}`} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-text-secondary font-blender-book">
                          {s.stationName} <span className="text-text-muted">· ур. {s.level}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-text-primary">×{s.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="py-12 text-center text-sm text-text-muted font-blender-book">
            {anyBuilt ? 'Всё для текущих целей собрано — подними уровни в «Моё убежище».' : 'Ничего не найдено — измени запрос.'}
          </p>
        )}
      </div>
    </div>
  );
}
