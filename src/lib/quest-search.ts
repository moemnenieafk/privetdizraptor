import type { TaskRaw, QuestBarterLite } from '@/types/quest';

/**
 * Поисковый текст квеста для левого дровера «Поиск по заданию». Индексируем то, что квест
 * ТРЕБУЕТ и что ДАЁТ/ОТКРЫВАЕТ (спека «редизайн шелла», вопрос 6):
 *   1) название квеста
 *   2) предметы-цели (найти/сдать/пометить)
 *   3) предметы-награды (finishRewards)
 *   4) предметы открываемых квестом бартеров (bartersByQuest)
 * Крафт-анлоки пока не индексируются — нет связи «квест→крафт» в зеркале (долг, см. спеку).
 */
export function buildQuestSearchText(task: TaskRaw, barters?: QuestBarterLite[]): string {
  const parts: string[] = [task.name, task.normalizedName];
  for (const o of task.objectives) {
    if (o.item) parts.push(o.item.name, o.item.shortName);
    if (o.markerItem) parts.push(o.markerItem.name, o.markerItem.shortName);
  }
  for (const r of task.finishRewards?.items ?? []) {
    if (r.item) parts.push(r.item.name, r.item.shortName);
  }
  for (const b of barters ?? []) {
    for (const ri of b.rewardItems) parts.push(ri.name, ri.shortName);
  }
  return parts.filter(Boolean).join(' • ').toLowerCase();
}

/** Разбор запроса на термины (по запятой/пробелу), термы короче 2 символов отбрасываем. */
export function parseSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** Мульти-поиск = ИЛИ: индекс матчится, если ЛЮБОЙ терм — подстрока. */
export function matchesTerms(indexText: string, terms: string[]): boolean {
  if (terms.length === 0) return false;
  return terms.some((term) => indexText.includes(term));
}
