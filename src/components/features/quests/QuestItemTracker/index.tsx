'use client';

import type { TaskRaw, TaskObjectiveItem } from '@/types/quest';
import { useQuestStore } from '@/store/useQuestStore';
import { TrackCell } from '@/components/ui/kit/TrackCell';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { isFirStashObjective, syncStashDelta } from '@/lib/quest-stash-sync';
import ITEM_BG from '@/data/quests/item-backgrounds.json';

// Тарковский фон ячейки по id предмета: обычные — свой цвет, квест-предметы → #686628 (yellow).
const itemBg = (id: string): string => getTarkovBackgroundColor((ITEM_BG as Record<string, string>)[id] ?? 'yellow');

interface Props {
  task: TaskRaw;
}

// FiR-глиф в углу ячейки (низ-лево) — как везде в трекинге (StashCell/схрон): аутентичный
// значок «найдено в рейде» в золоте FiR. Семантика читается прямо на иконке предмета.
const FIR_CORNER = (
  <span title="Найдено в рейде" className="flex h-5 w-5 items-center justify-center">
    <span aria-hidden className="icon-eft-quests-side icon-mask h-3 w-3 bg-fir" />
  </span>
);

export function QuestItemTracker({ task }: Props) {
  const taskProgress  = useQuestStore((s) => s.itemProgress[task.id]);
  const incrementItem = useQuestStore((s) => s.incrementItem);
  const decrementItem = useQuestStore((s) => s.decrementItem);
  const setItemCount  = useQuestStore((s) => s.setItemCount);

  const itemObjs = task.objectives.filter(
    (o): o is TaskObjectiveItem & { item: NonNullable<TaskObjectiveItem['item']> } =>
      o.__typename === 'TaskObjectiveItem' && o.item != null,
  );

  if (itemObjs.length === 0) return null;

  // Дедуп по предмету: один физический предмет, нужный в нескольких целях
  // (классика «найти → сдать один и тот же груз»), — ОДНА строка, а не задвоение.
  // Счётчик ведёт все цели этого предмета синхронно (каждый inc кэпится своим count),
  // поэтому автозавершение — проверяющее КАЖДУЮ item-цель — остаётся целым.
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
  // Прямой ввод числа (клик по бейджу X/Y): ставим всем целям предмета min(their count, n).
  const setRow = (r: Row, n: number) => r.objs.forEach((o) => setItemCount(task.id, o.id, Math.min(o.count, Math.max(0, n))));

  const totalNeeded = rows.reduce((sum, r) => sum + r.count, 0);
  const totalFound  = rows.reduce((sum, r) => sum + rowFound(r), 0);
  const pct = totalNeeded > 0 ? Math.round((totalFound / totalNeeded) * 100) : 0;

  return (
    <div className="flex flex-col gap-0">
      {rows.map((row, idx) => (
        <div
          key={row.item.id}
          className={`flex items-center gap-3 py-2 ${idx < rows.length - 1 ? 'border-b border-lines-hover' : ''}`}
        >
          {/* Канон-ячейка трекинга: иконка + рарити-фон + счётчик X/Y + ЛКМ +1 / ПКМ −1.
              FiR — угловым глифом (низ-лево), а не текстом под именем — семантика на самой ячейке. */}
          <TrackCell
            iconSrc={row.item.image512pxLink}
            alt={row.item.shortName}
            have={rowFound(row)}
            need={row.count}
            onInc={(delta) => {
              const before = rowFound(row);
              if (delta > 0) incRow(row); else decRow(row);
              const after = delta > 0 ? Math.min(row.count, before + 1) : Math.max(0, before - 1);
              // FiR-предмет (найдено в рейде, не квест-предмет) → зеркалим сбор в Схрон.
              if (isFirStashObjective(row.objs[0])) syncStashDelta(row.item.id, after - before);
            }}
            onSetTotal={(n) => {
              const before = rowFound(row);
              setRow(row, n);
              if (isFirStashObjective(row.objs[0])) syncStashDelta(row.item.id, Math.min(row.count, Math.max(0, n)) - before);
            }}
            bgColor={itemBg(row.item.id)}
            bottomLeft={row.foundInRaid ? FIR_CORNER : undefined}
          />
          <span className="min-w-0 flex-1 truncate text-base font-blender-book text-text-primary">
            {row.item.shortName}
          </span>
        </div>
      ))}

      <div className="mt-2 h-0.5 w-full rounded-full bg-lines-hover">
        <div
          className={`h-full rounded-full transition-all duration-300 ${pct >= 100 ? 'bg-success' : 'bg-(--primary)'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
