/**
 * Статик рендер-конфиг интерактивных карт EFT (Phase 4).
 *
 * Эти параметры (проекция мира→картинка, поворот, границы холста, этажи) НЕ приходят
 * из tarkov.dev GraphQL — это конфигурация НАШЕГО Leaflet-рендера. Значения портированы
 * из open-source the-hideout/tarkov-dev (MIT, `src/data/maps.json`) и сверены 2026-06-23.
 *
 * Координаты маркеров (см. `map_markers`) — это сырые Unity world-coords {x,y,z}, где
 * (x,z) = горизонтальная плоскость, y = высота (для мульти-этажа). На рендере:
 *   imgX = x * transform[0] + transform[1]
 *   imgY = z * transform[2] + transform[3]
 * затем поворот на `coordinateRotation`. `bounds` = углы холста L.CRS.Simple [[y1,x1],[y2,x2]].
 *
 * Подложки-картинки (SVG) — авторский арт (атрибуция в `author`/`authorLink`), зеркалятся
 * в Storage cta-media по ключу `maps/eft/{slug}.svg` (см. scripts/upload-map-assets.ts).
 */

export interface MapLayerConfig {
  name: string;
  /** id <g>-группы внутри SVG (этаж). */
  svgLayer?: string;
  /** Видим ли слой по умолчанию. */
  show: boolean;
  /** [min, max] игровой высоты (game-Y) для фильтра маркеров по этажу. */
  height?: [number, number];
  /** Статичная карта: basename SVG этого этажа в /public/images/maps/eft (без .svg). */
  image?: string;
}

export interface EftMapConfig {
  /** slug (= maps.normalizedName). */
  slug: string;
  /** Имя файла-подложки в репо the-hideout (для скачивания/заливки). null — нет SVG-подложки. */
  svgFile: string | null;
  /**
   * Статичная карта (наш собственный арт в /public, не геометрия tarkov.dev): рисуем подложку
   * с зумом/паном БЕЗ маркеров/слоёв/поиска. SVG читается из /images/maps/eft/{slug}.svg
   * напрямую (Next), без Storage/CDN и без записи в map_assets (синк её пропускает).
   */
  staticMap?: boolean;
  /** Отображаемое имя (для статичных карт — их нет в БД, имя берём отсюда). */
  displayName?: string;
  /** Имя наземного этажа в переключателе (по умолчанию «Поверхность»). */
  groundName?: string;
  author: string | null;
  authorLink: string | null;
  minZoom: number;
  maxZoom: number;
  /** [scaleX, offsetX, scaleZ, offsetZ] — world(x,z) → image-space. null если нет проекции. */
  transform: [number, number, number, number] | null;
  /** Поворот холста, градусы: 0 / 90 / 180 / 270. */
  coordinateRotation: number;
  /** Углы холста L.CRS.Simple: [[y1,x1],[y2,x2]]. */
  bounds: [[number, number], [number, number]] | null;
  /** Отдельные границы для SVG-подложки, если отличаются от bounds (редко). */
  svgBounds?: [[number, number], [number, number]] | null;
  /** [min,max] game-Y дефолтного (наземного) этажа. */
  heightRange: [number, number] | null;
  /** id <g>-группы наземного этажа в SVG. */
  svgLayer: string | null;
  /** Дополнительные этажи (мульти-этаж, v2). */
  layers: MapLayerConfig[];
}

const SHEBUKA = "Shebuka";
const SHEBUKA_LINK = "https://github.com/the-hideout/tarkov-dev-svg-maps/";

export const EFT_MAP_CONFIG: Record<string, EftMapConfig> = {
  customs: {
    slug: "customs",
    svgFile: "Customs.svg",
    author: SHEBUKA,
    authorLink: SHEBUKA_LINK,
    minZoom: 2,
    maxZoom: 6,
    transform: [0.239, 168.65, 0.239, 136.35],
    coordinateRotation: 180,
    bounds: [
      [698, -307],
      [-372, 237],
    ],
    heightRange: [-1000, 1000],
    svgLayer: "Ground_Level",
    layers: [
      { name: "Подземелье", svgLayer: "Underground_Level", show: false, height: [-1000, 0.5] },
      { name: "2-й этаж", svgLayer: "Second_Floor", show: false, height: [2.7, 6.5] },
      { name: "3-й этаж", svgLayer: "Third_Floor", show: false, height: [5.7, 1000] },
    ],
  },
  woods: {
    slug: "woods",
    svgFile: "Woods.svg",
    author: SHEBUKA,
    authorLink: SHEBUKA_LINK,
    minZoom: 2,
    maxZoom: 6,
    transform: [0.1855, 112.95, 0.1855, 167.85],
    coordinateRotation: 180,
    bounds: [
      [646, -914],
      [-761, 442],
    ],
    heightRange: null,
    svgLayer: "Ground_Level",
    layers: [],
  },
  shoreline: {
    slug: "shoreline",
    svgFile: "Shoreline.svg",
    author: SHEBUKA,
    authorLink: SHEBUKA_LINK,
    minZoom: 2,
    maxZoom: 6,
    transform: [0.16, 83.2, 0.16, 111.1],
    coordinateRotation: 180,
    bounds: [
      [504, -415],
      [-1056, 618],
    ],
    heightRange: [-1000, -1],
    svgLayer: "Ground_Level",
    layers: [
      { name: "Подземелье", svgLayer: "Underground_Level", show: false, height: [-1000, -5] },
      { name: "2-й этаж", svgLayer: "Second_Floor", show: false, height: [-1, 2] },
      { name: "3-й этаж", svgLayer: "Third_Floor", show: false, height: [2, 1000] },
    ],
  },
  reserve: {
    slug: "reserve",
    svgFile: "Reserve.svg",
    author: SHEBUKA,
    authorLink: SHEBUKA_LINK,
    minZoom: 2,
    maxZoom: 6,
    transform: [0.395, 122, 0.395, 137.65],
    coordinateRotation: 180,
    bounds: [
      [289, -293],
      [-303, 244],
    ],
    svgBounds: [
      [289, -274],
      [-303, 272],
    ],
    heightRange: [-7, 10000],
    svgLayer: "Ground_Level",
    layers: [
      { name: "Бункеры", svgLayer: "Bunkers", show: false, height: [-10000, -7.27] },
      { name: "2-й этаж", show: false, height: [22.1, 25.7] },
      { name: "3-й этаж", show: false, height: [25.7, 29.3] },
    ],
  },
  interchange: {
    slug: "interchange",
    svgFile: "Interchange.svg",
    author: SHEBUKA,
    authorLink: SHEBUKA_LINK,
    minZoom: 1,
    maxZoom: 6,
    transform: [0.265, 150.6, 0.265, 134.6],
    coordinateRotation: 180,
    bounds: [
      [598, -442],
      [-433, 426],
    ],
    heightRange: null,
    svgLayer: "Ground_Level",
    layers: [
      { name: "2-й этаж", svgLayer: "First_Floor", show: true, height: [25, 34] },
      { name: "3-й этаж", svgLayer: "Second_Floor", show: false, height: [34, 1000] },
    ],
  },
  lighthouse: {
    slug: "lighthouse",
    svgFile: "Lighthouse.svg",
    author: SHEBUKA,
    authorLink: SHEBUKA_LINK,
    minZoom: 1,
    maxZoom: 6,
    transform: [0.2, 0, 0.2, 0],
    coordinateRotation: 180,
    bounds: [
      [515, -998],
      [-545, 725],
    ],
    heightRange: null,
    svgLayer: "Ground_Level",
    layers: [],
  },
  factory: {
    slug: "factory",
    svgFile: "Factory.svg",
    author: SHEBUKA,
    authorLink: SHEBUKA_LINK,
    minZoom: 1,
    maxZoom: 6,
    transform: [1.629, 119.9, 1.629, 139.3],
    coordinateRotation: 90,
    bounds: [
      [77, -64.5],
      [-65.5, 67.4],
    ],
    heightRange: [-1, 3],
    svgLayer: "Ground_Floor",
    layers: [
      { name: "2-й этаж", svgLayer: "Second_Floor", show: false, height: [3, 6] },
      { name: "3-й этаж", svgLayer: "Third_Floor", show: false, height: [6, 10000] },
      { name: "Тоннели", svgLayer: "Basement", show: false, height: [-10000, -1] },
    ],
  },
  "streets-of-tarkov": {
    slug: "streets-of-tarkov",
    svgFile: "StreetsOfTarkov.svg",
    author: SHEBUKA,
    authorLink: SHEBUKA_LINK,
    minZoom: 1,
    maxZoom: 5,
    transform: [0.38, 0, 0.38, 0],
    coordinateRotation: 180,
    bounds: [
      [323, -295],
      [-280, 532],
    ],
    heightRange: [-6, 10],
    svgLayer: "Ground_Level",
    layers: [
      { name: "Подземелье", svgLayer: "Underground_Level", show: false, height: [-10000, -6] },
      { name: "2-й этаж", svgLayer: "Second_Floor", show: false, height: [10, 15] },
      { name: "3-й этаж", svgLayer: "Third_Floor", show: false, height: [15, 20] },
      { name: "4-й этаж", svgLayer: "Fourth_Floor", show: false, height: [20, 25] },
      { name: "5-й этаж", svgLayer: "Fifth_Floor", show: false, height: [25, 10000] },
    ],
  },
  "ground-zero": {
    slug: "ground-zero",
    svgFile: "GroundZero.svg",
    author: SHEBUKA,
    authorLink: SHEBUKA_LINK,
    minZoom: 1,
    maxZoom: 6,
    transform: [0.524, 167.3, 0.524, 65.1],
    coordinateRotation: 180,
    bounds: [
      [249, -124],
      [-99, 364],
    ],
    heightRange: [-1000, 28],
    svgLayer: "Ground_Level",
    layers: [
      { name: "Гараж", svgLayer: "Underground_Level", show: false, height: [-1000, 21] },
      { name: "2-й этаж", svgLayer: "Second_Floor", show: false, height: [28, 32.3] },
      { name: "3-й этаж", svgLayer: "Third_Floor", show: false, height: [32.3, 1000] },
    ],
  },
  terminal: {
    slug: "terminal",
    svgFile: "Terminal.svg",
    author: SHEBUKA,
    authorLink: SHEBUKA_LINK,
    minZoom: 2,
    maxZoom: 6,
    transform: [0.2, 0, 0.2, 0],
    coordinateRotation: 180,
    bounds: [
      [463, -580],
      [-433, 475],
    ],
    heightRange: null,
    svgLayer: "Ground_Level",
    layers: [],
  },
  "the-lab": {
    // Наш собственный трёхуровневый план Лаборатории (арт V4DYA, NIGHTFALL-перекраска).
    // Статичная карта: подложки из /public, без маркеров tarkov.dev (рисунок не геопривязан).
    // Каждый этаж — отдельный SVG; переключатель меняет подложку (см. MapViewerClient).
    slug: "the-lab",
    svgFile: "the-lab.svg",
    staticMap: true,
    displayName: "Лаборатория",
    groundName: "1-й уровень",
    author: "V4DYA",
    authorLink: null,
    // CRS.Simple по viewBox 5500×4200; transform-identity (маркеров нет → калибровка не нужна).
    minZoom: -4,
    maxZoom: 2,
    transform: [1, 0, 1, 0],
    coordinateRotation: 0,
    bounds: [
      [0, 0],
      [5500, 4200],
    ],
    heightRange: null,
    svgLayer: null,
    layers: [
      { name: "Подземелье", show: false, image: "the-lab-m1" },
      { name: "2-й уровень", show: false, image: "the-lab-2" },
    ],
  },
};

/** Этаж карты для UI-переключателя: имя, id <g>-группы SVG (или null) и диапазон высоты. */
export interface MapFloor {
  name: string;
  /** id <g>-группы в SVG для затемнения соседних этажей; null — этаж без отдельной группы. */
  svgLayer: string | null;
  /** [min,max] game-Y для фильтра маркеров; null — без фильтра (показать все). */
  height: [number, number] | null;
  /** Статичная карта: URL подложки этого этажа в /public; null — общая подложка карты. */
  image: string | null;
}

/**
 * Список этажей карты: индекс 0 — наземный (svgLayer/heightRange конфига), далее — layers[].
 * Используется и фреймом (переключатель), и вьюером (затемнение/фильтр/смена подложки) — одна точка правды.
 */
export function buildMapFloors(cfg: EftMapConfig): MapFloor[] {
  const img = (base: string) => `/images/maps/eft/${base}.svg`;
  const ground: MapFloor = {
    name: cfg.groundName ?? 'Поверхность',
    svgLayer: cfg.svgLayer,
    height: cfg.heightRange,
    image: cfg.staticMap ? img(cfg.slug) : null,
  };
  const extra: MapFloor[] = cfg.layers.map((l) => ({
    name: l.name,
    svgLayer: l.svgLayer ?? null,
    height: l.height ?? null,
    image: cfg.staticMap && l.image ? img(l.image) : null,
  }));
  return [ground, ...extra];
}

/** slug → конфиг (или undefined, если карта не интерактивная / нет SVG-подложки). */
export function getMapConfig(slug: string): EftMapConfig | undefined {
  return EFT_MAP_CONFIG[slug];
}

/** Статичные карты (наш арт в /public) — для индекса и навигации (их нет в БД). */
export function getStaticMaps(): { slug: string; name: string }[] {
  return Object.values(EFT_MAP_CONFIG)
    .filter((c) => c.staticMap && c.svgFile)
    .map((c) => ({ slug: c.slug, name: c.displayName ?? c.slug }));
}

/** Все интерактивные карты с SVG-подложкой (для скрипта заливки и индекса). */
export const INTERACTIVE_MAP_SLUGS = Object.keys(EFT_MAP_CONFIG);
