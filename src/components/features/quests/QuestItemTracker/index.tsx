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
    (o): o is TaskObjectiveItem & { item: NonNullable<TaskObjectiveItem['item']> } =>
      o.__typename === 'TaskObjectiveItem' && o.item != null,
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
            className={`flex items-center gap-2.5 py-2 ${
              idx < itemObjs.length - 1 ? 'border-b border-lines-hover' : ''
            }`}
          >
            {/* Item image — card style 53×53 */}
            <div className="relative w-13.25 h-13.25 shrink-0">
              <div className="absolute inset-0 overflow-hidden rounded-sm border border-lines-hover">
                <div className="absolute inset-0 bg-(--color-darkbase)" />
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]" />
                <img
                  src={obj.item.image512pxLink}
                  alt={obj.item.shortName}
                  width={53}
                  height={53}
                  className="absolute inset-0 z-10 h-full w-full object-contain p-1"
                />
              </div>
            </div>

            {/* Name + FIR */}
            <div className="flex-1 flex flex-col min-w-0 gap-0.5">
              <span className="text-base font-blender-book text-text-primary truncate">
                {obj.item.shortName}
              </span>
              {obj.foundInRaid && (
                <span className="text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">
                  НАЙДЕНО В РЕЙДЕ
                </span>
              )}
            </div>

            {/* Counter */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                className="flex items-center justify-center w-6 h-6 text-text-secondary hover:text-text-primary transition-colors duration-150"
                onClick={() => decrementItem(task.id, obj.id)}
                aria-label="Уменьшить"
              >
                <span className="icon-decrement-icon icon-mask w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-blender-medium w-9 text-center text-text-primary">
                {found}/{obj.count}
              </span>
              <button
                className="flex items-center justify-center w-6 h-6 text-text-secondary hover:text-text-primary transition-colors duration-150"
                onClick={() => incrementItem(task.id, obj.id, obj.count)}
                aria-label="Увеличить"
              >
                <span className="icon-increment-icon icon-mask w-3.5 h-3.5" />
              </button>
            </div>

            {/* Done check */}
            <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
              {done && (
                <span className="icon-bg icon-eft-quests-complete w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
              )}
            </div>
          </div>
        );
      })}

      <div className="h-0.5 w-full bg-lines-hover rounded-full mt-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            pct >= 100 ? 'bg-success' : 'bg-(--primary)'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
