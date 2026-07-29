import { EFT_QUESTS } from '@/data/quests';
import { baseMapSlug, taskMapSlugs } from '@/lib/quest-map-link';
import type { TaskRaw } from '@/types/quest';
import type { MapQuestLite } from '@/components/features/maps/map-frame-types';

export { baseMapSlug, taskMapSlugs };

/** Полные таски (TaskRaw), у которых есть хотя бы один объектив на карте `slug` — для master-detail
 * квест-панели (QuestDetail) в drawer'е поиска. Набор ограничен квестами карты, вся база не тащится. */
export function questTasksForMap(slug: string): TaskRaw[] {
  const base = baseMapSlug(slug);
  return EFT_QUESTS.filter((t) => taskMapSlugs(t).includes(base));
}

/** Лёгкий срез квестов карты (для списка/чипов/поиска). */
export function questsForMap(slug: string): MapQuestLite[] {
  return questTasksForMap(slug).map((t) => ({
    id: t.id,
    name: t.name,
    trader: t.trader.normalizedName,
    minPlayerLevel: t.minPlayerLevel,
    kappaRequired: t.kappaRequired,
    lightkeeperRequired: t.lightkeeperRequired,
  }));
}
