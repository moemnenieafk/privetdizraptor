// Типы полезной нагрузки клэй-карты. Форма повторяет форму данных из
// scripts/eft-map-layers/export-clay-web.py — правило §4.4.

/** Полигон приходит ПЛОСКИМ массивом [x,z, x,z, …] в игровых метрах. */
export type FlatPolygon = number[];

export interface ClayFloor {
  /** Имя этажа как в слоях: underground / main / 2nd / 3rd / 4th. */
  name: string;
  /** Уровень относительно земли: −1 подвал, 0 наземный, 1 второй… */
  level: number;
  /** Отметка пола этажа в метрах (level × шаг этажа). */
  z0: number;
  /** Высота объёма стен внутри этажа. */
  wallH: number;
  /** Толщина плиты пола. */
  plateH: number;
  /** Сечения стен — планировка этажа. */
  walls: FlatPolygon[];
  /** Контуры помещений — из них строится плита пола. */
  plates: FlatPolygon[];
}

export interface ClayStairProto {
  key: string;
  posOffset: number;
  posCount: number;
  idxOffset: number;
  idxCount: number;
}

export interface ClayStairInstance {
  /** Индекс прототипа в `protos`. */
  p: number;
  /** Позиция (x, y, z) в игровых метрах. */
  t: [number, number, number];
  /** Кватернион (x, y, z, w). Отдан покомпонентно, а не матрицей: порядок
   *  хранения матрицы — классический источник многочасовых ошибок. */
  q: [number, number, number, number];
  /** Масштаб. */
  s: [number, number, number];
  /** Кто нашёл лестницу: `имя` / `геометрия` / `оба`. */
  src?: string | null;
  /** Имя из клиента, если лестницу нашли по имени. */
  name?: string | null;
}

export interface ClayStairs {
  /** Имя бинаря рядом с JSON: Float32 позиции, затем Uint32 индексы. */
  bin: string;
  protos: ClayStairProto[];
  instances: ClayStairInstance[];
}

export interface ClayDistrict {
  map: string;
  district: string;
  label: string;
  generated: string;
  source: string;
  /** Окно района в игровых метрах: [x0, z0, x1, z1]. */
  bounds: [number, number, number, number];
  storey: number;
  floors: ClayFloor[];
  stairs: ClayStairs | null;
}
