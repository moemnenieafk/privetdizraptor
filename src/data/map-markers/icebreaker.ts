import type { ManualMapMarker } from './types';

/**
 * Ручные маркеры Ледокола — поставлены через редактор (`/eft/maps/icebreaker?edit=1`).
 * Координаты в системе рендера CRS (см. ManualMapMarker). Пополняется экспортом из редактора.
 * tarkov.dev по этой карте отдаёт только спавны/боссов (нет выходов/лута), поэтому — вручную.
 */
export const icebreakerMarkers: ManualMapMarker[] = [];
