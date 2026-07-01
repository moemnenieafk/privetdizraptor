'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { TaskRaw, QuestNodeStatus } from '@/types/quest';
import { QuestNode } from '@/components/features/quests/QuestNode';
import { QuestDrawer } from '@/components/features/quests/QuestDrawer';
import { QuestNavTab } from '@/components/features/quests/QuestNavTab';
import type { QuestsHubNavTab } from '@/lib/quests-nav';
import { useQuestStore } from '@/store/useQuestStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { computeStatusMap } from '@/lib/quest-status';
import { traderImg } from '@/lib/trader-utils';

interface Props {
  tasks: TaskRaw[];
  /** normalizedName для портрета/цвета (btr-driver → btrdriver уже применено в роуте). */
  traderNormalized: string;
  /** RU-название трейдера для заголовка. */
  title: string;
  /** Разделы верхнего уровня (Сюжетные/Побочные/События) — первый блок навигации. */
  navSections?: QuestsHubNavTab[];
  /** Соседи-торговцы (11) — второй блок навигации. */
  navTraders?: QuestsHubNavTab[];
}

const STATUS_ORDER: Record<QuestNodeStatus, number> = { active: 0, locked: 1, completed: 2 };

export function QuestTraderList({ tasks, traderNormalized, title, navSections, navTraders }: Props) {
  const completedQuests = useQuestStore((s) => s.completedQuests);
  const togglePin = useQuestStore((s) => s.togglePin);
  const pinnedQuests = useQuestStore((s) => s.pinnedQuests);

  const profiles = usePlayerStore((s) => s.profiles);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const activeProfile = profiles.find((p) => p.id === activeId);
  const playerLevel = Number(activeProfile?.level ?? 1);
  const traderLevels = activeProfile?.traderLevels ?? {};

  const [selectedTask, setSelectedTask] = useState<TaskRaw | null>(null);
  const [filter, setFilter] = useState<'all' | QuestNodeStatus>('all');
  const [filterKappa, setFilterKappa] = useState(false);
  const [filterLK, setFilterLK] = useState(false);

  const statusMap = useMemo(
    () => computeStatusMap(tasks, new Set(completedQuests), playerLevel),
    [tasks, completedQuests, playerLevel],
  );
  const pinnedSet = useMemo(() => new Set(pinnedQuests), [pinnedQuests]);

  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const sa = statusMap.get(a.id)?.status ?? 'locked';
      const sb = statusMap.get(b.id)?.status ?? 'locked';
      if (STATUS_ORDER[sa] !== STATUS_ORDER[sb]) return STATUS_ORDER[sa] - STATUS_ORDER[sb];
      return a.minPlayerLevel - b.minPlayerLevel || a.name.localeCompare(b.name);
    });
  }, [tasks, statusMap]);

  const counts = useMemo(() => {
    let active = 0;
    let done = 0;
    for (const t of tasks) {
      const s = statusMap.get(t.id)?.status;
      if (s === 'active') active++;
      else if (s === 'completed') done++;
    }
    return { active, done, locked: tasks.length - active - done, total: tasks.length };
  }, [tasks, statusMap]);

  const statusFiltered = filter === 'all' ? sorted : sorted.filter((t) => statusMap.get(t.id)?.status === filter);
  const visible = (filterKappa || filterLK)
    ? statusFiltered.filter((t) => (filterKappa && t.kappaRequired) || (filterLK && t.lightkeeperRequired))
    : statusFiltered;

  // Быстрый фильтр = индикатор статусов. Клик по активному снимает (→ 'all').
  const FILTERS = [
    { key: 'active' as const, label: 'Доступно', count: counts.active, on: 'bg-(--primary) text-(--color-base)', off: 'text-(--primary) border-(--primary)' },
    { key: 'completed' as const, label: 'Завершено', count: counts.done, on: 'bg-success text-(--color-base)', off: 'text-success border-success' },
    { key: 'locked' as const, label: 'Заблокировано', count: counts.locked, on: 'bg-neutral-500 text-(--color-base)', off: 'text-text-muted border-lines-hover' },
  ];

  const handleToggle = (id: string) => useQuestStore.getState().toggleQuest(id);
  const handleForceComplete = (id: string) => {
    const st = useQuestStore.getState();
    if (!st.completedQuests.includes(id)) st.toggleQuest(id);
  };
  const noop = () => {};

  const hasNav = (navSections?.length ?? 0) > 0 || (navTraders?.length ?? 0) > 0;

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-16">
      <div className="w-full max-w-275 px-4 xl:px-0">

        {/* Шапка: [левая 522: фото + трейдер/фильтры] + gap 28 + [правая 522: навигация]. Мобилка — вертикальный стек. */}
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-[28px]">

          {/* Левая колонка 522 */}
          <div className="flex items-end gap-4 lg:gap-7 w-full lg:w-[522px] lg:shrink-0">
            <div className="relative h-21 w-21 shrink-0 overflow-hidden rounded-md border border-lines-hover bg-(--color-darkbase)">
              <Image src={traderImg(traderNormalized)} alt={title} fill className="object-cover" sizes="84px" />
            </div>

            {/* Текст: ряд 1 (имя + всего + Каппа/Смотритель) / ряд 2 (статус-фильтры) */}
            <div className="flex flex-1 flex-col gap-2 lg:min-w-0">
              <div className="flex h-9 items-center gap-3">
                <h1 className="text-[28px] font-blender-medium leading-none tracking-tighter uppercase text-text-primary">
                  {title}
                </h1>
                <span className="px-2 py-0.5 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] border border-(--primary)/40 rounded font-blender-medium text-sm text-(--primary) leading-snug">
                  {counts.total}
                </span>
                <div className="ml-auto flex items-center gap-2 pl-6">
                  <button
                    type="button"
                    onClick={() => setFilterKappa((v) => !v)}
                    title="Только квесты для Каппы"
                    className="flex h-9 w-9 items-center justify-center rounded border transition-colors"
                    style={filterKappa ? { borderColor: 'var(--color-kappa)', backgroundColor: 'var(--color-kappa)' } : { borderColor: 'var(--color-kappa)' }}
                  >
                    <span className="icon-mask icon-eft-profile-kappa h-5 w-5" style={{ backgroundColor: filterKappa ? 'var(--color-darkbase)' : 'var(--color-kappa)' }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLK((v) => !v)}
                    title="Только квесты для Смотрителя"
                    className="flex h-9 w-9 items-center justify-center rounded border transition-colors"
                    style={filterLK ? { borderColor: 'var(--color-lightkeeper)', backgroundColor: 'var(--color-lightkeeper)' } : { borderColor: 'var(--color-lightkeeper)' }}
                  >
                    <span className="icon-mask icon-eft-profile-lightkeeper h-5 w-5" style={{ backgroundColor: filterLK ? 'var(--color-darkbase)' : 'var(--color-lightkeeper)' }} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 lg:h-9 lg:grid-cols-3 lg:gap-2 lg:items-center">
                {FILTERS.map((f) => {
                  const isOn = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter((cur) => (cur === f.key ? 'all' : f.key))}
                      className={`h-7 rounded border px-3 text-center text-type-micro font-blender-medium uppercase tracking-widest transition-[background-color,border-color,color] ${
                        isOn ? `${f.on} border-transparent` : `bg-card-menu ${f.off} hover:brightness-125`
                      }`}
                    >
                      {f.label}: {f.count}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Правая колонка 522: навигация (метка + 2 дива 6×2) */}
          {hasNav && (
            <div className="flex w-full flex-col gap-2 lg:w-[522px] lg:shrink-0">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                    Навигация по разделу
                  </span>
                  <div className="h-px flex-1 bg-lines-hover" />
                </div>
                <div className="flex flex-wrap lg:flex-nowrap gap-3.5 lg:gap-2">
                  {navSections && navSections.length > 0 && (
                    <div className="grid grid-cols-6 gap-3.5 w-max lg:w-64 lg:gap-2">
                      {navSections.map((t) => <QuestNavTab key={t.id} tab={t} />)}
                    </div>
                  )}
                  {navTraders && navTraders.length > 0 && (
                    <div className="grid grid-cols-6 gap-3.5 w-max lg:w-64 lg:gap-2">
                      {navTraders.map((t) => <QuestNavTab key={t.id} tab={t} />)}
                    </div>
                  )}
                </div>
              </div>
            )}
        </header>

        {/* Сетка карточек QuestNode (фикс. ширина 348px) */}
        {visible.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-5">
            {visible.map((task) => {
              const entry = statusMap.get(task.id) ?? { status: 'locked' as QuestNodeStatus };
              return (
                <QuestNode
                  key={task.id}
                  data={{
                    task,
                    status: entry.status,
                    lockReason: entry.lockReason,
                    levelGap: entry.levelGap,
                    pinned: pinnedSet.has(task.id),
                    traderLevels,
                    onToggle: handleToggle,
                    onForceComplete: handleForceComplete,
                    onSelect: setSelectedTask,
                    onHover: noop,
                    onPin: togglePin,
                  }}
                />
              );
            })}
          </div>
        ) : (
          <p className="py-20 text-center text-sm text-text-muted font-blender-book">
            Нет заданий с этим статусом — выберите другой фильтр.
          </p>
        )}
      </div>

      <QuestDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
    </main>
  );
}
