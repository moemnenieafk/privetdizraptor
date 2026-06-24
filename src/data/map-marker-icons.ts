/**
 * Таблица СООТВЕТСТВИЯ маркеров карты → иконки ЦТА (deliverable + источник легенды).
 *
 * Приоритет — собственные иконки ЦТА. Где их ещё нет (`icon: null`, `todo: true`) — нужно
 * нарисовать в стиле ЦТА (через /cta-design); до этого легенда показывает цветную фигуру-
 * плейсхолдер (`shape` → классы `.lg-*` / `.cta-legend` в globals.css). tarkov-market — только
 * визуальный референс что иконка должна изображать, в продакшен НЕ идёт.
 *
 * Этот файл — единственная точка правды для легенды и для будущего icon-based редизайна
 * маркеров (сейчас маркеры рендерятся цветными CSS-фигурами в MapViewerClient).
 */
export interface MapMarkerIcon {
  /** type из map_markers (+ суб-вид через sub). */
  kind: string;
  /** подвид: pmc / scav / boss / sniper. */
  sub?: string;
  /** подпись в легенде. */
  ru: string;
  /** путь к существующей иконке ЦТА или null (нужна отрисовка). */
  icon: string | null;
  /** CSS-класс цветной фигуры-плейсхолдера (текущие маркеры / пробелы без иконки). */
  shape?: string;
  /** требуется отрисовка иконки в стиле ЦТА. */
  todo?: boolean;
  /** показывать в легенде v1 (сейчас рендерятся extract / spawn / transit / hazard). */
  legendV1?: boolean;
}

export const MAP_MARKER_ICONS: MapMarkerIcon[] = [
  // — v1 (отображаются на карте сейчас) —
  { kind: 'extract', ru: 'Выход', icon: null, shape: 'lg-extract', todo: true, legendV1: true },
  { kind: 'spawn', ru: 'Спавн', icon: null, shape: 'lg-spawn', todo: true, legendV1: true },
  { kind: 'spawn', sub: 'boss', ru: 'Босс / снайпер', icon: '/icons/eft/05-gamesetting/bosses.svg', shape: 'lg-boss', legendV1: true },
  { kind: 'transit', ru: 'Переход', icon: '/icons/eft/01-maps/transits-map-icon.svg', legendV1: true },
  { kind: 'hazard', ru: 'Опасность', icon: null, shape: 'lg-hazard', todo: true, legendV1: true },

  // — v2 (зеркалятся в map_markers, ждут включения слоёв) —
  { kind: 'lock', ru: 'Замок / ключ', icon: '/icons/eft/03-items/equipment/keys/mechanical-keys.svg' },
  { kind: 'loot_container', ru: 'Контейнер', icon: '/icons/eft/03-items/equipment/containers.svg' },
  { kind: 'loot_loose', ru: 'Лут', icon: '/icons/eft/03-items/loot-tier.svg' },
  { kind: 'boss', ru: 'Босс', icon: '/icons/eft/05-gamesetting/bosses.svg' },
  { kind: 'quest_zone', ru: 'Зона квеста', icon: '/icons/eft/02-quests/quest-visit.svg' },
  { kind: 'stationary_weapon', ru: 'Стационарное оружие', icon: '/icons/eft/03-items/guns.svg', todo: true },
  { kind: 'switch', ru: 'Рычаг', icon: null, todo: true },
];

/** Записи легенды v1 (текущие отображаемые типы маркеров). */
export const LEGEND_V1 = MAP_MARKER_ICONS.filter((m) => m.legendV1);
