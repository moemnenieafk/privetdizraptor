'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuestStore, getActiveItemRequirements } from '@/store/useQuestStore';
import { FillMedia } from '@/components/ui/FillMedia';
import { QtyControl } from '@/components/ui/QtyControl';
import type { TaskRaw } from '@/types/quest';

const TRADER_SLUG: Record<string, string> = { 'btr-driver': 'btrdriver' };
const traderImg = (n: string) => `/images/traders/eft/${TRADER_SLUG[n] ?? n}.webp`;

type SortMode = 'progress' | 'name' | 'count';

interface GroupedItem {
  item: { id: string; name: string; shortName: string; image512pxLink: string };
  foundInRaid: boolean;
  totalNeeded: number;
  totalFound: number;
  quests: Array<{
    questId: string;
    questName: string;
    objectiveId: string;
    needed: number;
    found: number;
    traderNormalizedName: string;
  }>;
}

interface Props {
  initialTasks: TaskRaw[];
}

export function ItemTrackerClient({ initialTasks }: Props) {
  const completedQuests = useQuestStore((s) => s.completedQuests);
  const itemProgress    = useQuestStore((s) => s.itemProgress);
  const setItemCount    = useQuestStore((s) => s.setItemCount);

  const [query, setQuery]           = useState('');
  const [sortMode, setSortMode]     = useState<SortMode>('progress');
  const [filterFiR, setFilterFiR]   = useState(false);
  const [filterDone, setFilterDone] = useState(true);

  const taskMap = useMemo(
    () => new Map(initialTasks.map((t) => [t.id, t])),
    [initialTasks],
  );

  const activeItems = useMemo(
    () => getActiveItemRequirements(initialTasks, completedQuests, itemProgress),
    [initialTasks, completedQuests, itemProgress],
  );

  const grouped = useMemo<GroupedItem[]>(() => {
    const map = new Map<string, GroupedItem>();
    for (const entry of activeItems) {
      const { item, questId, questName, objectiveId, needed, found, foundInRaid } = entry;
      const task = taskMap.get(questId);
      const traderNormalizedName = task?.trader.normalizedName ?? '';
      if (!map.has(item.id)) {
        map.set(item.id, { item, foundInRaid, totalNeeded: 0, totalFound: 0, quests: [] });
      }
      const g = map.get(item.id)!;
      g.totalNeeded += needed;
      g.totalFound  += found;
      if (foundInRaid) g.foundInRaid = true;
      g.quests.push({ questId, questName, objectiveId, needed, found, traderNormalizedName });
    }
    return [...map.values()];
  }, [activeItems, taskMap]);

  // Пул: фильтры, не зависящие от прогресса. «Незавершённые» и сортировка
  // применяются ТОЛЬКО в снимке порядка (см. ниже) — иначе карточка прыгает
  // под пальцем на каждом +/− и исчезает при 100%.
  const pool = useMemo(() => {
    let list = grouped;
    if (filterFiR) list = list.filter((g) => g.foundInRaid);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (g) =>
          g.item.name.toLowerCase().includes(q) ||
          g.item.shortName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [grouped, filterFiR, query]);

  const poolById = useMemo(
    () => new Map(pool.map((g) => [g.item.id, g])),
    [pool],
  );
  const poolSignature = useMemo(
    () => pool.map((g) => g.item.id).join('|'),
    [pool],
  );

  // Актуальный прогресс читаем из ref, чтобы он НЕ был зависимостью пересортировки.
  const poolRef = useRef(pool);
  poolRef.current = pool;

  const buildOrder = (): string[] => {
    const list = poolRef.current.filter(
      (g) => !filterDone || g.totalFound < g.totalNeeded,
    );
    return [...list]
      .sort((a, b) => {
        if (sortMode === 'name')  return a.item.name.localeCompare(b.item.name, 'ru');
        if (sortMode === 'count') return b.totalNeeded - a.totalNeeded;
        const aPct = a.totalFound / (a.totalNeeded || 1);
        const bPct = b.totalFound / (b.totalNeeded || 1);
        if (bPct !== aPct) return bPct - aPct;
        return a.item.name.localeCompare(b.item.name, 'ru');
      })
      .map((g) => g.item.id);
  };

  // Снимок порядка. Пересобирается при смене сортировки/фильтров/поиска/состава —
  // но не при изменении счётчиков.
  const [order, setOrder] = useState<string[]>(buildOrder);
  useEffect(() => {
    setOrder(buildOrder());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolSignature, sortMode, filterFiR, filterDone]);

  // Рендерим по снимку; новые предметы дописываем в хвост, чтобы не пропали.
  const filtered = useMemo(() => {
    const inOrder = order
      .map((id) => poolById.get(id))
      .filter((g): g is GroupedItem => Boolean(g));
    const seen = new Set(order);
    const fresh = pool.filter((g) => !seen.has(g.item.id));
    return [...inOrder, ...fresh];
  }, [order, poolById, pool]);

  // Собранные, которые «залипли» в снимке из-за фильтра «Незавершённые».
  const staleDone = filterDone
    ? filtered.filter((g) => g.totalFound >= g.totalNeeded).length
    : 0;

  const totalItems     = grouped.length;
  const completedItems = grouped.filter((g) => g.totalFound >= g.totalNeeded).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Stats strip */}
      <div className="flex items-center gap-4 text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">
        <span>Всего предметов: <span className="text-text-primary">{totalItems}</span></span>
        <span className="text-lines-hover">|</span>
        <span>Собрано: <span className="text-success">{completedItems}</span></span>
        <span className="text-lines-hover">|</span>
        <span>Осталось: <span className="text-(--primary)">{totalItems - completedItems}</span></span>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-48 max-w-72 flex-1">
          <span className="icon-bg icon-eft-search absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск предмета..."
            className="h-7 w-full rounded-xs border border-lines-hover bg-card-menu pl-7 pr-3 text-type-caption font-blender-book text-text-primary transition-colors placeholder:text-text-muted focus:border-(--primary)/60 focus:outline-none"
          />
        </div>

        {/* Sort */}
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="h-7 cursor-pointer rounded-xs border border-lines-hover bg-card-menu px-2 text-type-caption font-blender-medium uppercase text-text-secondary focus:border-(--primary)/60 focus:outline-none"
        >
          <option value="progress">По прогрессу</option>
          <option value="name">По названию</option>
          <option value="count">По количеству</option>
        </select>

        {/* Filter chips */}
        <button
          onClick={() => setFilterFiR((v) => !v)}
          className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-xs border px-2.5 text-type-caption font-blender-medium uppercase tracking-wider transition-colors ${
            filterFiR
              ? 'border-(--primary)/50 bg-(--primary)/15 text-(--primary)'
              : 'border-lines-hover bg-card-menu text-text-muted hover:border-(--primary)/30 hover:text-text-secondary'
          }`}
        >
          <span className="icon-bg icon-eft-fir h-3 w-3" />
          Найдено в рейде
        </button>

        <button
          onClick={() => setFilterDone((v) => !v)}
          className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-xs border px-2.5 text-type-caption font-blender-medium uppercase tracking-wider transition-colors ${
            filterDone
              ? 'border-(--primary)/50 bg-(--primary)/15 text-(--primary)'
              : 'border-lines-hover bg-card-menu text-text-muted hover:border-(--primary)/30 hover:text-text-secondary'
          }`}
        >
          Незавершённые
        </button>

        {staleDone > 0 && (
          <button
            onClick={() => setOrder(buildOrder())}
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-xs border border-success/50 bg-success/10 px-2.5 text-type-caption font-blender-medium uppercase tracking-wider text-success transition-colors hover:bg-success/20"
          >
            Убрать собранные ({staleDone})
          </button>
        )}

        <span className="ml-auto text-type-caption font-blender-medium uppercase text-text-muted">
          {filtered.length} предметов
        </span>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-text-muted">
          <span className="icon-bg icon-eft-quests-active h-8 w-8 opacity-30" />
          <p className="text-type-caption font-blender-medium uppercase tracking-widest">
            {query ? 'Предметы не найдены' : 'Все предметы собраны'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((group) => {
            const pct = group.totalNeeded > 0
              ? Math.round((group.totalFound / group.totalNeeded) * 100)
              : 0;
            const done = group.totalFound >= group.totalNeeded;
            const single = group.quests.length === 1;

            const fillAll  = () => group.quests.forEach((q) => setItemCount(q.questId, q.objectiveId, q.needed));
            const clearAll = () => group.quests.forEach((q) => setItemCount(q.questId, q.objectiveId, 0));

            return (
              <div
                key={group.item.id}
                className={`flex flex-col gap-2.5 rounded-xs border p-3 transition-colors ${
                  done ? 'border-success/30 bg-success/5' : 'border-lines-hover bg-card-menu'
                }`}
              >
                {/* Header — медиаконтейнер с вертикальной заливкой (бак модулей убежища) */}
                <div className="flex items-start gap-2.5">
                  <FillMedia
                    imageSrc={group.item.image512pxLink}
                    alt={group.item.name}
                    pct={pct}
                    done={done}
                    interactive={
                      single
                        ? {
                            value: group.quests[0].found,
                            max: group.quests[0].needed,
                            onChange: (n) => setItemCount(group.quests[0].questId, group.quests[0].objectiveId, n),
                          }
                        : undefined
                    }
                  />

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-type-caption font-blender-medium uppercase leading-tight line-clamp-2 text-text-primary">
                      {group.item.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-xs border border-lines-hover px-1 py-px text-type-caption font-blender-medium uppercase text-text-muted">
                        {group.item.shortName}
                      </span>
                      {group.foundInRaid && (
                        <span className="text-type-caption font-blender-medium uppercase text-(--primary)">
                          Найдено в рейде
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Total progress */}
                  <div className={`shrink-0 text-xs font-blender-medium tabular-nums ${done ? 'text-success' : 'text-text-primary'}`}>
                    {group.totalFound} <span className="text-text-muted">/ {group.totalNeeded}</span>
                  </div>
                </div>

                {/* Horizontal bar — быстрый скан */}
                <div className="h-0.5 w-full rounded-full bg-lines-hover">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-success' : 'bg-(--primary)'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {single ? (
                  /* Один квест → крупный ввод прямо в карточке (лечит ×N кликов) */
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <img src={traderImg(group.quests[0].traderNormalizedName)} alt="" width={12} height={12} className="shrink-0 rounded-xs opacity-70" />
                      <span className={`truncate text-type-caption font-blender-book ${done ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
                        {group.quests[0].questName}
                      </span>
                    </div>
                    <QtyControl
                      value={group.quests[0].found}
                      max={group.quests[0].needed}
                      onChange={(n) => setItemCount(group.quests[0].questId, group.quests[0].objectiveId, n)}
                      size="md"
                      showMax
                      showClear
                    />
                  </div>
                ) : (
                  /* Несколько квестов → агрегатные действия + строки */
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">Задания</span>
                      <span className="h-px flex-1 bg-lines-hover" />
                      <button
                        onClick={fillAll}
                        disabled={done}
                        className="h-6 cursor-pointer rounded-xs border border-(--primary)/50 bg-(--primary)/15 px-2 text-type-caption font-blender-medium uppercase tracking-wider text-(--primary) transition-colors hover:bg-(--primary)/25 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Всё
                      </button>
                      <button
                        onClick={clearAll}
                        disabled={group.totalFound === 0}
                        className="h-6 cursor-pointer rounded-xs border border-lines-hover px-2 text-type-caption font-blender-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Сброс
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {group.quests.map((quest) => {
                        const questDone = quest.found >= quest.needed;
                        return (
                          <div key={`${quest.questId}-${quest.objectiveId}`} className="flex items-center gap-2">
                            <img
                              src={traderImg(quest.traderNormalizedName)}
                              alt={quest.traderNormalizedName}
                              width={12}
                              height={12}
                              className="shrink-0 rounded-xs opacity-70"
                            />
                            <span className={`flex-1 truncate text-type-caption font-blender-book ${questDone ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
                              {quest.questName}
                            </span>
                            <span className="shrink-0 text-type-caption font-blender-medium text-text-muted">
                              ×{quest.needed}
                            </span>
                            <QtyControl
                              value={quest.found}
                              max={quest.needed}
                              onChange={(n) => setItemCount(quest.questId, quest.objectiveId, n)}
                              size="sm"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
