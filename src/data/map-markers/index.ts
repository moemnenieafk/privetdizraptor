import type { ManualMapMarker } from './types';

export type { ManualMapMarker } from './types';

/** Ручные маркеры статик-карт по slug. Новые карты добавляй сюда + свой файл.
 * Пусто: метки Ледокола сняты (2026-08-15) — переезжают в editorial_markers через Визард. */
const REGISTRY: Record<string, ManualMapMarker[]> = {};

export function getManualMarkers(slug: string): ManualMapMarker[] {
  return REGISTRY[slug] ?? [];
}
