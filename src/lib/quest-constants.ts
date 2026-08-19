// Общие константы/хелперы квестов. Квест «Коллекционер» (Fence) — сдача предметов под контейнер Kappa;
// на него завязан отдельный трекер /eft/progress/collector (раздел «Прогресс»), кросс-линки на него
// живут в карточке квеста (QuestNode) и в детали ноды карты заданий (QuestDetail).
export const COLLECTOR_QUEST_ID = '5c51aac186f77432ea65c552';
export const COLLECTOR_TRACKER_HREF = '/eft/progress/collector';

/** Это квест «Коллекционер»? Матч по normalizedName (основной) с фолбэком на id. */
export function isCollectorTask(t: { id?: string; normalizedName?: string } | null | undefined): boolean {
  return !!t && (t.normalizedName === 'collector' || t.id === COLLECTOR_QUEST_ID);
}
