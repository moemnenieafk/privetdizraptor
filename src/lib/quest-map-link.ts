import { INTERACTIVE_MAP_SLUGS } from '@/data/eft-map-config';
import type { TaskRaw } from '@/types/quest';

/**
 * Чистые хелперы связи квест↔карта (БЕЗ импорта EFT_QUESTS) — безопасны для клиентских
 * компонентов (QuestDetail, ноды QuestMap). Тяжёлый каталог квестов живёт в lib/map-quests.
 */

/** Базовый slug карты: срезаем суффиксы вариантов рейда (день/ночь/21+). */
export function baseMapSlug(slug: string): string {
  return slug.replace(/-(21|day|night)$/i, '');
}

/** normalizedName карт (базовые), на которых есть объективы задачи. */
export function taskMapSlugs(task: TaskRaw): string[] {
  const set = new Set<string>();
  for (const o of task.objectives) {
    for (const m of o.maps ?? []) set.add(baseMapSlug(m.normalizedName));
  }
  return [...set];
}

/** Первый slug объективов задачи, у которого есть интерактивная карта локации (или null). */
export function firstInteractiveMapSlug(task: TaskRaw): string | null {
  for (const s of taskMapSlugs(task)) if (INTERACTIVE_MAP_SLUGS.includes(s)) return s;
  return null;
}
