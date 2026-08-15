/** Императивный API Leaflet-вьюера, который MapFrame получает через onReady. */
export interface MapViewerApi {
  /** Плавно центрировать на игровых координатах {x,z}. */
  flyTo(pos: { x: number; z: number }, zoom?: number): void;
  /** Подсветить зону (контур в игровых координатах) пульсирующим полигоном; null — снять. */
  highlightZone(outline: { x: number; z: number }[] | null): void;
  /** Пообъектные пины цели квеста (точки в игровых координатах) с квест-иконкой; null — снять.
   *  Точнее зоны — показываем ВМЕСТО неё по ?quest=, если у квеста есть possibleLocations. */
  showObjectivePoints(points: { x: number; z: number; label?: string }[] | null): void;
  /** Вернуть стартовый вид (fitBounds). */
  fitView(): void;
  /** Переключить видимость слоя маркеров (extract/spawn/transit/hazard). */
  toggleLayer(key: string): void;
  /** Подлёт к набору точек (fit + пульс-подсветка) — спавны босса и т.п. */
  focusPoints(points: { x: number; z: number }[]): void;
  /** ПКМ по типу/слою: подлёт к ближайшему объекту, повтор — к следующему по циклу (как в Легенде). */
  cycleToLayer(keys: string[]): void;
  /** «Позиция по Скриншоту»: открыть файл-пикер PNG → поза из имени → черновик метки + визард. */
  pickScreenshotMarker(): void;
}

/** Статистика босса для BottomBar. */
export interface MapBossStat {
  id: string;
  name: string;
  spawnChance: number | null;
  /** Иконка босса (`/images/bosses/eft/…`) или null (нет ассета → лейбл без иконки). */
  icon: string | null;
  /** Точки возможных спавнов босса (spawnLocations ∩ spawn-зоны) — для подлёта по клику. */
  spawns: { x: number; z: number }[];
}

/** Квест с объективом на карте (для поиска, фильтров и прогресса). */
export interface MapQuestLite {
  id: string;
  name: string;
  /** normalizedName трейдера — аватар (traderImg) + цвет-тинт строки (--trader-*). */
  trader: string;
  minPlayerLevel: number;
  kappaRequired: boolean;
  lightkeeperRequired: boolean;
}

/** Зона объектива квеста на карте (для перелёта/подсветки по ?quest=id). */
export interface MapQuestZone {
  questId: string;
  position: { x: number; z: number } | null;
  outline: { x: number; z: number }[];
}
