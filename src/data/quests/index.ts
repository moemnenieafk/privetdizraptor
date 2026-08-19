import type { TaskRaw } from '@/types/quest';
import regular from './eft-quests.json';
import pve from './eft-quests.pve.json';

/** Режим игры для набора квестов (профиль игрока: PVP→regular, PVE→pve). */
export type QuestMode = 'regular' | 'pve';

/** Квесты режима regular (PVP) — дефолт; сохраняем прежний экспорт для существующих потребителей. */
export const EFT_QUESTS = regular as unknown as TaskRaw[];
/** Квесты режима pve. */
export const EFT_QUESTS_PVE = pve as unknown as TaskRaw[];

/** Набор квестов по режиму профиля. По умолчанию — regular. */
export function getQuests(mode: QuestMode = 'regular'): TaskRaw[] {
  return mode === 'pve' ? EFT_QUESTS_PVE : EFT_QUESTS;
}
