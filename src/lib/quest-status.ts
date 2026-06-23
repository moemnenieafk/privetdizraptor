import type { TaskRaw, QuestNodeStatus, QuestLockReason } from '@/types/quest';

export type QuestStatusEntry = {
  status: QuestNodeStatus;
  lockReason?: QuestLockReason;
  levelGap?: number;
};

/**
 * Статус квеста по прогрессу игрока: completed / active / locked (+ причина блокировки).
 * Чистая функция — используется и картой квестов, и списками трейдеров.
 */
export function computeStatusMap(
  tasks: TaskRaw[],
  completedSet: Set<string>,
  playerLevel: number,
): Map<string, QuestStatusEntry> {
  const map = new Map<string, QuestStatusEntry>();
  for (const task of tasks) {
    if (completedSet.has(task.id)) {
      map.set(task.id, { status: 'completed' });
      continue;
    }
    const prereqsOk = task.taskRequirements.every((r) => completedSet.has(r.task.id));
    const levelOk = playerLevel >= task.minPlayerLevel;
    if (prereqsOk && levelOk) {
      map.set(task.id, { status: 'active' });
    } else if (!prereqsOk && !levelOk) {
      map.set(task.id, { status: 'locked', lockReason: 'both', levelGap: task.minPlayerLevel - playerLevel });
    } else if (!prereqsOk) {
      map.set(task.id, { status: 'locked', lockReason: 'prereq' });
    } else {
      map.set(task.id, { status: 'locked', lockReason: 'level', levelGap: task.minPlayerLevel - playerLevel });
    }
  }
  return map;
}
