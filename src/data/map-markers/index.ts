import type { ManualMapMarker } from './types';
import { icebreakerMarkers } from './icebreaker';

export type { ManualMapMarker } from './types';

/** Ручные маркеры статик-карт по slug. Новые карты добавляй сюда + свой файл. */
const REGISTRY: Record<string, ManualMapMarker[]> = {
  icebreaker: icebreakerMarkers,
};

export function getManualMarkers(slug: string): ManualMapMarker[] {
  return REGISTRY[slug] ?? [];
}
