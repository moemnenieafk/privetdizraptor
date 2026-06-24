import { EFT_QUESTS } from '@/data/quests';
import { baseMapSlug, taskMapSlugs } from '@/lib/quest-map-link';
import type { MapQuestLite } from '@/components/features/maps/map-frame-types';

export { baseMapSlug, taskMapSlugs };

/** Квесты, у которых есть хотя бы один объектив на карте `slug` (для поиска/прогресса). */
export function questsForMap(slug: string): MapQuestLite[] {
  const base = baseMapSlug(slug);
  const out: MapQuestLite[] = [];
  for (const t of EFT_QUESTS) {
    if (taskMapSlugs(t).includes(base)) {
      out.push({ id: t.id, name: t.name, trader: t.trader.normalizedName });
    }
  }
  return out;
}
