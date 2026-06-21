'use client';

import { useState, useMemo } from 'react';
import { useQuestStore, getActiveItemRequirements } from '@/store/useQuestStore';
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
  const incrementItem   = useQuestStore((s) => s.incrementItem);
  const decrementItem   = useQuestStore((s) => s.decrementItem);

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

  const filtered = useMemo(() => {
    let list = grouped;
    if (filterFiR)  list = list.filter((g) => g.foundInRaid);
    if (filterDone) list = list.filter((g) => g.totalFound < g.totalNeeded);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (g) =>
          g.item.name.toLowerCase().includes(q) ||
          g.item.shortName.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sortMode === 'name')    return a.item.name.localeCompare(b.item.name, 'ru');
      if (sortMode === 'count')   return b.totalNeeded - a.totalNeeded;
      // progress: started (0 < found < total) first, then unstarted
      const aPct = a.totalFound / (a.totalNeeded || 1);
      const bPct = b.totalFound / (b.totalNeeded || 1);
      if (bPct !== aPct) return bPct - aPct;
      return a.item.name.localeCompare(b.item.name, 'ru');
    });
  }, [grouped, filterFiR, filterDone, query, sortMode]);

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
        <div className="relative flex-1 min-w-48 max-w-72">
          <span className="icon-bg icon-eft-search absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск предмета..."
            className="w-full pl-7 pr-3 h-7 rounded-xs border border-lines-hover bg-card-menu text-type-caption font-blender-book text-text-primary placeholder:text-text-muted focus:outline-none focus:border-(--primary)/60 transition-colors"
          />
        </div>

        {/* Sort */}
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="h-7 px-2 rounded-xs border border-lines-hover bg-card-menu text-type-caption font-blender-medium uppercase text-text-secondary focus:outline-none focus:border-(--primary)/60 cursor-pointer"
        >
          <option value="progress">По прогрессу</option>
          <option value="name">По названию</option>
          <option value="count">По количеству</option>
        </select>

        {/* Filter chips */}
        <button
          onClick={() => setFilterFiR((v) => !v)}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-xs border text-type-caption font-blender-medium uppercase tracking-wider transition-colors cursor-pointer ${
            filterFiR
              ? 'bg-(--primary)/15 border-(--primary)/50 text-(--primary)'
              : 'border-lines-hover bg-card-menu text-text-muted hover:border-(--primary)/30 hover:text-text-secondary'
          }`}
        >
          <span className="icon-bg icon-eft-fir w-3 h-3" />
          Найдено в рейде
        </button>

        <button
          onClick={() => setFilterDone((v) => !v)}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-xs border text-type-caption font-blender-medium uppercase tracking-wider transition-colors cursor-pointer ${
            filterDone
              ? 'bg-(--primary)/15 border-(--primary)/50 text-(--primary)'
              : 'border-lines-hover bg-card-menu text-text-muted hover:border-(--primary)/30 hover:text-text-secondary'
          }`}
        >
          Незавершённые
        </button>

        <span className="ml-auto text-type-caption font-blender-medium uppercase text-text-muted">
          {filtered.length} предметов
        </span>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-text-muted">
          <span className="icon-bg icon-eft-quests-active w-8 h-8 opacity-30" />
          <p className="text-type-caption font-blender-medium uppercase tracking-widest">
            {query ? 'Предметы не найдены' : 'Все предметы собраны'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((group) => {
            const pct = group.totalNeeded > 0
              ? Math.round((group.totalFound / group.totalNeeded) * 100)
              : 0;
            const done = group.totalFound >= group.totalNeeded;

            return (
              <div
                key={group.item.id}
                className={`flex flex-col gap-2.5 rounded-xs border p-3 transition-colors ${
                  done
                    ? 'border-success/30 bg-success/5'
                    : 'border-lines-hover bg-card-menu'
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-2.5">
                  <img
                    src={group.item.image512pxLink}
                    alt={group.item.name}
                    width={40}
                    height={40}
                    className="rounded-xs object-contain bg-lines-hover/30 shrink-0"
                  />
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-type-caption font-blender-medium uppercase text-text-primary leading-tight line-clamp-2">
                      {group.item.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-type-caption font-blender-medium uppercase text-text-muted border border-lines-hover rounded-xs px-1 py-px">
                        {group.item.shortName}
                      </span>
                      {group.foundInRaid && (
                        <span className="text-type-caption font-blender-medium uppercase text-(--primary)">
                          FiR
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Total progress badge */}
                  <div className={`shrink-0 text-type-caption font-blender-medium tabular-nums ${done ? 'text-success' : 'text-text-primary'}`}>
                    {group.totalFound} <span className="text-text-muted text-type-caption">/ {group.totalNeeded}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-0.5 w-full rounded-full bg-lines-hover">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-success' : 'bg-(--primary)'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Quest list */}
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
                          className="rounded-xs shrink-0 opacity-70"
                        />
                        <span
                          className={`flex-1 text-type-caption font-blender-book truncate ${
                            questDone ? 'line-through text-text-muted' : 'text-text-secondary'
                          }`}
                        >
                          {quest.questName}
                        </span>
                        <span className="text-type-caption font-blender-medium text-text-muted shrink-0">
                          ×{quest.needed}
                        </span>
                        {/* Counter */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => decrementItem(quest.questId, quest.objectiveId)}
                            disabled={quest.found <= 0}
                            className="flex items-center justify-center w-5 h-5 rounded-xs border border-lines-hover bg-lines-hover/50 text-text-secondary hover:border-(--primary)/50 hover:text-(--primary) disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-blender-medium cursor-pointer"
                          >
                            −
                          </button>
                          <span className={`text-type-caption font-blender-medium w-6 text-center tabular-nums ${questDone ? 'text-success' : 'text-text-primary'}`}>
                            {quest.found}
                          </span>
                          <button
                            onClick={() => incrementItem(quest.questId, quest.objectiveId, quest.needed)}
                            disabled={quest.found >= quest.needed}
                            className="flex items-center justify-center w-5 h-5 rounded-xs border border-lines-hover bg-lines-hover/50 text-text-secondary hover:border-(--primary)/50 hover:text-(--primary) disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-blender-medium cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
