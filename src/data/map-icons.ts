/**
 * Иконки локаций EFT для навигации/фильтров (единая точка правды).
 * Раньше словарь жил инлайном в QuestFilterBar — вынесен сюда, чтобы переиспользовать
 * в индексе карт, MapTopBar и фильтре квестов (DRY). Классы-маски — в src/styles/icons.css.
 */

/** slug (= maps.normalizedName) → CSS-класс маски иконки локации. */
export const MAP_ICON_CSS: Record<string, string> = {
  'customs':           'icon-eft-maps-customs',
  'woods':             'icon-eft-maps-woods',
  'factory':           'icon-eft-maps-factory',
  'shoreline':         'icon-eft-maps-shoreline',
  'interchange':       'icon-eft-maps-interchange',
  'reserve':           'icon-eft-maps-reserve',
  'lighthouse':        'icon-eft-maps-lighthouse',
  'the-lab':           'icon-eft-maps-lab',
  'labs':              'icon-eft-maps-lab',
  'lab':               'icon-eft-maps-lab',
  'ground-zero':       'icon-eft-maps-groundzero',
  'streets-of-tarkov': 'icon-eft-maps-streets',
  'streets':           'icon-eft-maps-streets',
  'terminal':          'icon-eft-maps-terminal',
  'transits':          'icon-eft-maps-transits',
  'openworld':         'icon-eft-maps-openworld',
  'icebreaker':        'icon-eft-maps-icebreaker',
  'the-labyrinth':     'icon-eft-maps-labyrinth',
  'labyrinth':         'icon-eft-maps-labyrinth',
  'end-of-line':       'icon-eft-end-of-line-map-icon',
};

/** Канонический порядок карт в навигации/фильтрах. */
export const MAP_ORDER = [
  'the-lab', 'ground-zero', 'streets-of-tarkov', 'interchange', 'customs',
  'factory', 'woods', 'reserve', 'lighthouse', 'shoreline',
  'terminal', 'the-labyrinth', 'icebreaker', 'end-of-line',
];

/** CSS-класс иконки для slug (undefined → нет иконки, показываем текстовый фолбэк). */
export function mapIconClass(slug: string): string | undefined {
  return MAP_ICON_CSS[slug];
}

/** Индекс карты в каноническом порядке (для сортировки); неизвестные — в конец. */
export function mapOrderIndex(slug: string): number {
  const i = MAP_ORDER.indexOf(slug);
  return i === -1 ? 999 : i;
}
