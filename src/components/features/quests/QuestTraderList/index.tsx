'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { TaskRaw, QuestNodeStatus } from '@/types/quest';
import { QuestNode } from '@/components/features/quests/QuestNode';
import { QuestDrawer } from '@/components/features/quests/QuestDrawer';
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
}

const STATUS_ORDER: Record<QuestNodeStatus, number> = { active: 0, locked: 1, completed: 2 };

export function QuestTraderList({ tasks, traderNormalized, title }: Props) {
  const completedQuests = useQuestStore((s) => s.completedQuests);
  const togglePin = useQuestStore((s) => s.togglePin);
  const pinnedQuests = useQuestStore((s) => s.pinnedQuests);

  const profiles = usePlayerStore((s) => s.profiles);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const activeProfile = profiles.find((p) => p.id === activeId);
  const playerLevel = Number(activeProfile?.level ?? 1);
  const traderLevels = activeProfile?.traderLevels ?? {};

  const [selectedTask, setSelectedTask] = useState<TaskRaw | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

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

  const visible = onlyAvailable ? sorted.filter((t) => statusMap.get(t.id)?.status === 'active') : sorted;

  const handleToggle = (id: string) => useQuestStore.getState().toggleQuest(id);
  const handleForceComplete = (id: string) => {
    const st = useQuestStore.getState();
    if (!st.completedQuests.includes(id)) st.toggleQuest(id);
  };
  const noop = () => {};

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-16">
      <div className="w-full max-w-275 px-4 xl:px-0">

        {/* Шапка раздела */}
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 lg:gap-7">
            <div className="relative h-21 w-21 shrink-0 overflow-hidden rounded-md border border-lines-hover bg-(--color-darkbase)">
              <Image src={traderImg(traderNormalized)} alt={title} fill className="object-cover" sizes="84px" />
            </div>
            <div>
              <h1 className="text-[28px] font-blender-medium leading-none tracking-tighter uppercase text-text-primary">
                {title}
              </h1>
              <p className="mt-2 text-sm text-text-secondary font-blender-book">
                Доступно <span className="text-(--primary)">{counts.active}</span> · Заблокировано {counts.locked} · Готово{' '}
                <span className="text-success">{counts.done}</span> · Всего {counts.total}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOnlyAvailable((v) => !v)}
            className={`h-9 self-start rounded px-4 text-type-caption font-blender-medium uppercase tracking-widest transition-colors lg:self-auto ${
              onlyAvailable
                ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)'
                : 'border border-lines-hover bg-card-menu text-text-secondary hover:text-text-primary hover:border-(--primary)'
            }`}
          >
            Только доступные
          </button>
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
            Нет доступных заданий — снимите фильтр или повысьте уровень/прогресс.
          </p>
        )}
      </div>

      <QuestDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
    </main>
  );
}
