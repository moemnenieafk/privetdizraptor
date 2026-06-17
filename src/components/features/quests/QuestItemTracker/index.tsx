'use client';

import type { TaskRaw, TaskObjectiveItem } from '@/types/quest';
import { useQuestStore } from '@/store/useQuestStore';

interface Props {
  task: TaskRaw;
}

export function QuestItemTracker({ task }: Props) {
  const taskProgress  = useQuestStore((s) => s.itemProgress[task.id]);
  const incrementItem = useQuestStore((s) => s.incrementItem);
  const decrementItem = useQuestStore((s) => s.decrementItem);

  const itemObjs = task.objectives.filter(
    (o): o is TaskObjectiveItem => o.__typename === 'TaskObjectiveItem',
  );

  if (itemObjs.length === 0) return null;

  const totalNeeded = itemObjs.reduce((sum, o) => sum + o.count, 0);
  const totalFound  = itemObjs.reduce((sum, o) => sum + (taskProgress?.[o.id] ?? 0), 0);
  const pct = totalNeeded > 0 ? Math.round((totalFound / totalNeeded) * 100) : 0;

  return (
    <div className="flex flex-col gap-0">
      {itemObjs.map((obj, idx) => {
        const found = taskProgress?.[obj.id] ?? 0;
        const done  = found >= obj.count;
        return (
          <div
            key={obj.id}
            className={`flex items-center gap-2 py-1.5 ${
              idx < itemObjs.length - 1 ? 'border-b border-lines-hover' : ''
            }`}
          >
            <img
              src={obj.item.image512pxLink}
              alt={obj.item.shortName}
              width={24}
              height={24}
              className="rounded-xs object-contain shrink-0"
            />
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-[10px] font-blender-medium uppercase text-text-primary truncate">
                {obj.item.shortName}
              </span>
              {obj.foundInRaid && (
                <span className="text-[8px] font-blender-medium uppercase text-(--primary)">
                  НАЙДЕНО В РЕЙДЕ
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                className="flex items-center justify-center w-5 h-5 rounded-xs border border-lines-hover bg-lines-hover/50 text-text-secondary hover:border-(--primary)/50 hover:text-(--primary) transition-colors text-xs font-blender-medium"
                onClick={() => decrementItem(task.id, obj.id)}
                aria-label="Уменьшить"
              >
                −
              </button>
              <span className="text-xs font-blender-medium w-8 text-center text-text-primary">
                {found}/{obj.count}
              </span>
              <button
                className="flex items-center justify-center w-5 h-5 rounded-xs border border-lines-hover bg-lines-hover/50 text-text-secondary hover:border-(--primary)/50 hover:text-(--primary) transition-colors text-xs font-blender-medium"
                onClick={() => incrementItem(task.id, obj.id, obj.count)}
                aria-label="Увеличить"
              >
                +
              </button>
            </div>

            <div className="w-3 h-3 shrink-0 flex items-center justify-center">
              {done && (
                <span className="icon-bg icon-eft-quests-complete w-3 h-3" style={{ color: 'var(--color-success)' }} />
              )}
            </div>
          </div>
        );
      })}

      <div className="h-0.5 w-full bg-lines-hover rounded-full mt-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            pct >= 100 ? 'bg-(--color-success)' : 'bg-(--primary)'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
