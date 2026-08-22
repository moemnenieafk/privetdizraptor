// Типы «Схрона» (виртуальная сетка предметов). Общий контракт мета-предмета,
// который читает T01 из зеркала (items + prices) и потребляют ячейка/паккер.
// См. .autopilot/player-stash-grid/interfaces.md.

/** Мета предмета для отрисовки в сетке схрона (только зеркало, §4.11). */
export interface StashItemMeta {
  inGameId: string;
  name: string;
  shortName: string;
  /** Футпринт по колонкам (>=1). */
  gridWidth: number;
  /** Футпринт по рядам (>=1). */
  gridHeight: number;
  /** Имя цвета tarkov (orange/violet/blue/…) для getTarkovBackgroundColor. */
  backgroundColor: string | null;
}
