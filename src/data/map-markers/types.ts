/**
 * Ручной маркер статик-карты (поставлен в редакторе `/eft/maps/{slug}?edit=1`).
 *
 * Координаты {x,z} — в системе РЕНДЕРА (CRS-latlng карты), НЕ игровые: редактор пишет
 * clicked latlng как есть (x=lng, z=lat), рендер кладёт обратно через ll() → само-согласованно,
 * без возни с transform. `floor` — индекс этажа в buildMapFloors (0 = ground).
 * Это НАШИ кураторские данные (не tarkov.dev) → живут в git, синк их не трогает.
 */
export interface ManualMapMarker {
  id: string;
  /** extract | spawn | transit | hazard | lock | switch | loot | container. */
  type: string;
  /** Индекс этажа (buildMapFloors): 0 = наземный. */
  floor: number;
  x: number;
  z: number;
  label?: string;
  /** Для выходов: 'pmc' | 'scav' | 'all'. */
  faction?: string;
  /** Под-категория (spawn/loot/container) — ключ из data/map-markers/categories.ts. */
  category?: string;
  /** type='quest': BSG-id квеста (привязка к деталке/QuestMap). */
  questId?: string;
  /** type='quest': id конкретной цели (objective) квеста. */
  objectiveId?: string;
}
