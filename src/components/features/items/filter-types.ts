/**
 * Общие типы фильтрации предметов.
 * Вынесены из бывшего компонента ItemsFilterPanel (удалён как мёртвый рендер-код);
 * сами типы живут — их использует useItemsFilter.
 */

export type SortOption =
  | "none"
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc"
  | "vps_desc";

export interface ArmorFilterState {
  minClass: number;
  maxClass: number;
}
