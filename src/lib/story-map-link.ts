import { STORY_WALKTHROUGHS } from '@/data/story-walkthroughs';
import type { WalkthroughStep, WalkthroughBlock } from '@/data/story-walkthroughs/types';
import { baseMapSlug } from '@/lib/quest-map-link';

/**
 * Связь сюжетная-история ↔ география (фаза A гибрида, решение V4DYA 2026-07-30).
 * Сюжетные квесты — наши редакторские (id `story-*`, нет objectives/quest_zone), контент в
 * `data/story-walkthroughs`. Гео-координат у чекпоинтов НЕТ — есть только `condition.mapIcon`
 * (на КАКОЙ карте). Здесь строим грубую принадлежность «карта → истории» из mapIcon, чтобы
 * чип СЮЖЕТ на /eft/maps/[slug] показывал релевантные истории. Точные пины (фаза B) —
 * отдельным опциональным полем координаты на чекпоинте, инкрементально.
 * Чистый helper (без БД), безопасен для клиентских компонентов drawer'а.
 */

// Суффикс icon-eft-maps-<x> → наш slug карты. Идентичность по умолчанию, здесь только алиасы,
// где имя иконки расходится со slug'ом карты (сверено по всем 11 гайдам).
const MAP_ICON_TO_SLUG: Record<string, string> = {
  streets: 'streets-of-tarkov',
  lab: 'the-lab',
  labyrinth: 'the-labyrinth',
  groundzero: 'ground-zero',
};

/** 'icon-eft-maps-woods' → 'woods'; 'icon-eft-maps-streets' → 'streets-of-tarkov'; иначе null. */
function mapIconToSlug(icon: string | undefined): string | null {
  const m = icon?.match(/^icon-eft-maps-(.+)$/);
  if (!m) return null;
  const key = m[1];
  return MAP_ICON_TO_SLUG[key] ?? key;
}

/** Все блоки шага, включая под-шаги и ветки развилок. */
function* allBlocks(step: WalkthroughStep): Generator<WalkthroughBlock> {
  yield* step.blocks;
  for (const ss of step.substeps ?? []) yield* ss.blocks;
  for (const br of step.branches ?? []) for (const ss of br.substeps) yield* ss.blocks;
}

export interface StoryOnMap {
  slug: string;
  title: string;
  iconClass: string;
  difficulty: { skulls: number; label: string };
  /** Сколько шагов истории имеют чекпоинт на этой карте (для сортировки/подписи). */
  stepHits: number;
}

// Реверс-индекс baseMapSlug → истории (строится один раз при загрузке модуля).
const INDEX: Map<string, StoryOnMap[]> = (() => {
  const idx = new Map<string, StoryOnMap[]>();
  for (const story of Object.values(STORY_WALKTHROUGHS)) {
    // slug карты → число шагов истории, что её касаются
    const hitsBySlug = new Map<string, number>();
    for (const step of story.steps) {
      const stepSlugs = new Set<string>();
      for (const b of allBlocks(step)) {
        const slug = mapIconToSlug(b.condition?.mapIcon);
        if (slug) stepSlugs.add(baseMapSlug(slug));
      }
      for (const s of stepSlugs) hitsBySlug.set(s, (hitsBySlug.get(s) ?? 0) + 1);
    }
    for (const [slug, stepHits] of hitsBySlug) {
      const arr = idx.get(slug) ?? [];
      arr.push({ slug: story.slug, title: story.title, iconClass: story.iconClass, difficulty: story.difficulty, stepHits });
      idx.set(slug, arr);
    }
  }
  // порядок: больше касаний карты → выше (крупнее история на этой локации).
  for (const arr of idx.values()) arr.sort((a, b) => b.stepHits - a.stepHits);
  return idx;
})();

/** Истории, у которых есть хотя бы один чекпоинт на карте `slug` (по mapIcon). */
export function storiesForMap(slug: string): StoryOnMap[] {
  return INDEX.get(baseMapSlug(slug)) ?? [];
}
