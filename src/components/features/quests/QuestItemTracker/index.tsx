'use client';

import type { TaskRaw, TaskObjectiveItem } from '@/types/quest';
import { useQuestStore } from '@/store/useQuestStore';
import { FoundInRaidBadge } from '@/components/ui/FoundInRaidBadge';

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

  // Дедуп по предмету: один физический предмет, нужный в нескольких целях
  // (классика «найти → сдать один и тот же груз»), — ОДНА строка, а не задвоение.
  // Счётчик ведёт все цели этого предмета синхронно (каждый incrementItem кэпится своим
  // count), поэтому автозавершение — проверяющее КАЖДУЮ item-цель — остаётся целым.
  // found/count = max по группе → корректно и для редкого случая разного count (напр. ГазАн 2/1).
  type Row = { item: NonNullable<TaskObjectiveItem['item']>; count: number; foundInRaid: boolean; objIds: string[]; objs: typeof itemObjs };
  const rows: Row[] = [];
  const byItem = new Map<string, Row>();
  for (const o of itemObjs) {
    const ex = byItem.get(o.item.id);
    if (ex) {
      ex.count = Math.max(ex.count, o.count);
      ex.foundInRaid = ex.foundInRaid || !!o.foundInRaid;
      ex.objIds.push(o.id);
      ex.objs.push(o);
    } else {
      const r: Row = { item: o.item, count: o.count, foundInRaid: !!o.foundInRaid, objIds: [o.id], objs: [o] };
      byItem.set(o.item.id, r);
      rows.push(r);
    }
  }
  const rowFound = (r: Row) => Math.min(r.count, Math.max(0, ...r.objs.map((o) => taskProgress?.[o.id] ?? 0)));
  const incRow = (r: Row) => r.objs.forEach((o) => incrementItem(task.id, o.id, o.count));
  const decRow = (r: Row) => r.objs.forEach((o) => decrementItem(task.id, o.id));

  const totalNeeded = rows.reduce((sum, r) => sum + r.count, 0);
  const totalFound  = rows.reduce((sum, r) => sum + rowFound(r), 0);
  const pct = totalNeeded > 0 ? Math.round((totalFound / totalNeeded) * 100) : 0;

  return (
    <div className="flex flex-col gap-0">
      {rows.map((row, idx) => {
        const found = rowFound(row);
        const done  = found >= row.count;
        return (
          <div
            key={row.item.id}
            className={`flex items-center gap-2.5 py-2 ${
              idx < rows.length - 1 ? 'border-b border-lines-hover' : ''
            }`}
          >
            {/* Item image — card style 53×53 */}
            <div className="relative w-13.25 h-13.25 shrink-0">
              <div className="absolute inset-0 overflow-hidden rounded-sm border border-lines-hover">
                <div className="absolute inset-0 bg-(--color-darkbase)" />
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]" />
                <img
                  src={row.item.image512pxLink}
                  alt={row.item.shortName}
                  width={53}
                  height={53}
                  className="absolute inset-0 z-10 h-full w-full object-contain p-1"
                />
              </div>
            </div>

            {/* Name + FIR */}
            <div className="flex-1 flex flex-col min-w-0 gap-0.5">
              <span className="text-base font-blender-book text-text-primary truncate">
                {row.item.shortName}
              </span>
              {row.foundInRaid && <FoundInRaidBadge className="mt-0.5" />}
            </div>

            {/* Счётчик + галочка «готово» */}
            <div className="flex shrink-0 items-center gap-1.5">
              {done && (
                <span className="icon-bg icon-eft-quests-complete h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-success)' }} />
              )}
              <span className={`text-xs font-blender-medium tabular-nums ${done ? 'text-success' : 'text-text-primary'}`}>
                {found}/{row.count}
              </span>
            </div>

            {/* Кнопки +/− вертикальным стеком у края (Figma 3151:16859): + сверху, − снизу.
                SVG-глифы без фона, цвет text-secondary (#9696A1), ярче на ховере. */}
            <div className="flex shrink-0 flex-col gap-1">
              <button
                className="flex h-6 w-6 items-center justify-center text-text-secondary transition-colors hover:text-text-primary"
                onClick={() => incRow(row)}
                aria-label="Увеличить"
              >
                <span className="icon-increment-icon icon-mask h-4 w-4" />
              </button>
              <button
                className="flex h-6 w-6 items-center justify-center text-text-secondary transition-colors hover:text-text-primary"
                onClick={() => decRow(row)}
                aria-label="Уменьшить"
              >
                <span className="icon-decrement-icon icon-mask h-4 w-4" />
              </button>
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
