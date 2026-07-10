import type { PrestigeObjective } from '@/data/prestige';

export interface ObjectiveState {
  id: string;
  kind: PrestigeObjective['kind'];
  label: string;
  current: number;
  target: number;
  done: boolean;
  /** Доля выполнения 0..1 (для count — частичная). */
  ratio: number;
  /** id предметов-целей (фигурки) для кросс-линка на страницу предмета. */
  items?: string[];
}

export interface PrestigePathState {
  objectives: ObjectiveState[];
  /** Общий прогресс к следующему престижу, 0..100. */
  percent: number;
  doneCount: number;
  total: number;
  /** Короткая сводка «осталось» по невыполненным целям. */
  remaining: string;
}

/**
 * Считает состояние одной цели.
 * @param value для count/flag — сохранённое значение (flag: 0/1); для level игнорируется.
 */
export function evalObjective(
  obj: PrestigeObjective,
  value: number,
  playerLevel: number,
): ObjectiveState {
  if (obj.kind === 'level') {
    const ratio = Math.min(1, playerLevel / obj.minLevel);
    return {
      id: obj.id,
      kind: obj.kind,
      label: obj.label,
      current: Math.min(playerLevel, obj.minLevel),
      target: obj.minLevel,
      done: playerLevel >= obj.minLevel,
      ratio,
    };
  }
  if (obj.kind === 'flag') {
    const done = value > 0;
    return { id: obj.id, kind: obj.kind, label: obj.label, current: done ? 1 : 0, target: 1, done, ratio: done ? 1 : 0 };
  }
  const current = Math.min(value, obj.target);
  return {
    id: obj.id,
    kind: obj.kind,
    label: obj.label,
    current,
    target: obj.target,
    done: current >= obj.target,
    ratio: obj.target > 0 ? current / obj.target : 1,
    items: obj.items,
  };
}

export function computePrestigePath(
  objectives: PrestigeObjective[],
  getValue: (objId: string) => number,
  playerLevel: number,
): PrestigePathState {
  const states = objectives.map((o) => evalObjective(o, getValue(o.id), playerLevel));
  const total = states.length;
  const percent = total === 0 ? 0 : Math.round((states.reduce((a, s) => a + s.ratio, 0) / total) * 100);
  const doneCount = states.filter((s) => s.done).length;

  const gaps: string[] = [];
  for (const s of states) {
    if (s.done) continue;
    if (s.kind === 'level') gaps.push(`ур. ${s.target} (сейчас ${s.current})`);
    else if (s.kind === 'count') gaps.push(`${s.label.split(':')[0].split('(')[0].trim().toLowerCase()} ${s.target - s.current}`);
  }
  const remaining = gaps.slice(0, 2).join(' · ');

  return { objectives: states, percent, doneCount, total, remaining };
}
