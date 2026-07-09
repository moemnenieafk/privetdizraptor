'use client';

import { useMemo, useState } from 'react';
import { useQuestStore } from '@/store/useQuestStore';
import type { StashOverlay } from '@/lib/stash-overlay';

export interface NeededReq {
  questId: string;
  questName: string;
  trader: string;
  objectiveId: string;
  itemId: string;
  itemName: string;
  itemShort: string;
  itemIcon: string;
  needed: number;
  foundInRaid: boolean;
}

interface AggSource {
  questId: string;
  questName: string;
  trader: string;
  objectiveId: string;
  needed: number;
  found: number;
  fir: boolean;
}
interface Agg {
  itemId: string;
  itemName: string;
  itemShort: string;
  itemIcon: string;
  needed: number;
  found: number;
  firAny: boolean;
  sources: AggSource[];
}

export function NeededItemsClient({ reqs, overlay }: { reqs: NeededReq[]; overlay?: Map<string, StashOverlay> }) {
  const completedQuests = useQuestStore((s) => s.completedQuests);
  const itemProgress = useQuestStore((s) => s.itemProgress);
  const incrementItem = useQuestStore((s) => s.incrementItem);
  const decrementItem = useQuestStore((s) => s.decrementItem);
  const setItemCount = useQuestStore((s) => s.setItemCount);

  const [onlyFir, setOnlyFir] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const completed = useMemo(() => new Set(completedQuests), [completedQuests]);

  const aggs = useMemo(() => {
    const map = new Map<string, Agg>();
    for (const r of reqs) {
      if (completed.has(r.questId)) continue;
      const found = Math.min(r.needed, itemProgress[r.questId]?.[r.objectiveId] ?? 0);
      const a =
        map.get(r.itemId) ??
        { itemId: r.itemId, itemName: r.itemName, itemShort: r.itemShort, itemIcon: r.itemIcon, needed: 0, found: 0, firAny: false, sources: [] };
      a.needed += r.needed;
      a.found += found;
      a.firAny = a.firAny || r.foundInRaid;
      a.sources.push({ questId: r.questId, questName: r.questName, trader: r.trader, objectiveId: r.objectiveId, needed: r.needed, found, fir: r.foundInRaid });
      map.set(r.itemId, a);
    }
    return [...map.values()].sort((x, y) => {
      const rx = x.found / x.needed;
      const ry = y.found / y.needed;
      if (rx !== ry) return ry - rx; // ближе к завершению — выше
      return y.needed - x.needed;
    });
  }, [reqs, completed, itemProgress]);

  const visible = aggs.filter((a) => {
    if (onlyFir && !a.firAny) return false;
    if (hideDone && a.found >= a.needed) return false;
    return true;
  });

  const overall = useMemo(() => {
    const needed = aggs.reduce((s, a) => s + a.needed, 0);
    const found = aggs.reduce((s, a) => s + a.found, 0);
    return { needed, found, pct: needed > 0 ? Math.round((found / needed) * 100) : 0, items: aggs.length };
  }, [aggs]);

  const stashSummary = useMemo(() => {
    if (!overlay) return null;
    let inStash = 0;
    let toObtain = 0;
    for (const ov of overlay.values()) {
      inStash += ov.stashToQuest;
      toObtain += ov.questSoftToObtain;
    }
    return inStash > 0 ? { inStash, toObtain } : null;
  }, [overlay]);

  return (
    <div className="flex flex-col gap-5">
      {/* Общий прогресс */}
      <div className="rounded-md border border-lines-hover bg-card-menu p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-blender-medium uppercase tracking-widest text-text-primary">
            Всего нужно {overall.needed} · собрано <span className="text-success">{overall.found}</span> · {overall.items} предметов
          </span>
          <span className="text-sm font-blender-medium text-(--primary)">{overall.pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-lines-hover">
          <div className="h-full bg-(--primary) transition-all" style={{ width: `${overall.pct}%` }} />
        </div>
        {stashSummary && (
          <p className="mt-2 text-type-caption font-blender-book text-text-muted">
            С учётом стэша (не-FiR): зачтено <span className="tabular-nums text-text-secondary">{stashSummary.inStash}</span> · докупить{' '}
            <span className="tabular-nums text-(--primary)">{stashSummary.toObtain}</span>
          </p>
        )}
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2">
        {[
          { on: onlyFir, set: () => setOnlyFir((v) => !v), label: 'Только найденное в рейде' },
          { on: hideDone, set: () => setHideDone((v) => !v), label: 'Скрыть готовые' },
        ].map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={f.set}
            className={`h-9 rounded px-3 text-type-caption font-blender-medium uppercase tracking-widest transition-colors ${
              f.on
                ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)'
                : 'border border-lines-hover bg-card-menu text-text-secondary hover:text-text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Список предметов */}
      <div className="overflow-hidden rounded-md border border-lines-hover divide-y divide-lines-hover">
        {visible.map((a) => {
          const expanded = expandedId === a.itemId;
          const done = a.found >= a.needed;
          const pct = a.needed > 0 ? Math.round((a.found / a.needed) * 100) : 0;
          const ov = overlay?.get(a.itemId);
          return (
            <div key={a.itemId}>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : a.itemId)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-card-menu/60"
              >
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-lines-hover bg-(--color-darkbase)">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.itemIcon && <img src={a.itemIcon} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm font-blender-medium ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>{a.itemName}</span>
                    {a.firAny && <span className="shrink-0 text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">Найдено в рейде</span>}
                  </div>
                  <div className="mt-1 h-1 w-full max-w-60 overflow-hidden rounded-full bg-lines-hover">
                    <div className={`h-full ${done ? 'bg-success' : 'bg-(--primary)'}`} style={{ width: `${pct}%` }} />
                  </div>
                  {ov && ov.stashToQuest > 0 && (
                    <div className="mt-1 flex items-center gap-1.5 text-type-caption font-blender-book">
                      <span className="text-text-muted">в стэше</span>
                      <span className="tabular-nums text-text-secondary">{ov.stashToQuest}</span>
                      <span className="text-text-muted">· докупить</span>
                      <span className="tabular-nums text-(--primary)">{ov.questSoftToObtain}</span>
                    </div>
                  )}
                </div>
                <span className={`shrink-0 text-sm font-blender-medium tabular-nums ${done ? 'text-success' : 'text-text-secondary'}`}>
                  {a.found}/{a.needed}
                </span>
                <span className={`shrink-0 text-type-caption ${expanded ? 'text-(--primary)' : 'text-text-muted'}`}>{expanded ? '▾' : '▸'}</span>
              </button>

              {expanded && (
                <div className="bg-(--color-darkbase) px-3 py-2">
                  <ul className="flex flex-col gap-1.5">
                    {a.sources.map((s) => (
                      <li key={`${s.questId}-${s.objectiveId}`} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-text-secondary font-blender-book">
                          <span className="text-text-muted">{s.trader}</span> · {s.questName}
                          {s.fir && <span className="ml-1 text-type-caption uppercase tracking-widest text-(--primary)">Найдено в рейде</span>}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => decrementItem(s.questId, s.objectiveId)}
                            className="flex h-6 w-6 items-center justify-center rounded-xs border border-lines-hover text-text-secondary hover:border-(--primary) hover:text-(--primary)"
                          >−</button>
                          {/* Ручной ввод: для больших количеств (деньги/патроны) кликать ± нереально */}
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={s.needed}
                            value={s.found}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(s.needed, Math.floor(Number(e.target.value) || 0)));
                              setItemCount(s.questId, s.objectiveId, v);
                            }}
                            onFocus={(e) => e.currentTarget.select()}
                            className="h-6 w-20 rounded-xs border border-lines-hover bg-(--color-base) text-center font-blender-medium text-xs tabular-nums text-text-primary focus:border-(--primary) focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <span className="whitespace-nowrap text-text-muted tabular-nums">/ {s.needed}</span>
                          <button
                            type="button"
                            onClick={() => incrementItem(s.questId, s.objectiveId, s.needed)}
                            className="flex h-6 w-6 items-center justify-center rounded-xs border border-lines-hover text-text-secondary hover:border-(--primary) hover:text-(--primary)"
                          >+</button>
                        </div>
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
            Нет предметов — отметьте активные квесты на карте/в списках или снимите фильтры.
          </p>
        )}
      </div>
    </div>
  );
}
