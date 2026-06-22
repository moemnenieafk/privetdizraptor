// Типы результатов глобального тактического поиска (Tactical Search).

/** Базовая цена: общая сумма + цена за слот инвентаря. */
export interface SearchPriceEntry {
  price: number;
  perSlot: number;
}

/** Цена продажи торговцу — с привязкой к вендору (для аватарки). */
export interface SearchTraderPrice extends SearchPriceEntry {
  vendorName: string;
  vendorNormalizedName: string;
}

/** Предмет в выдаче поиска с предрасчитанными ценами для карточки. */
export interface SearchItemResult {
  id: string;
  normalizedName: string;
  name: string;
  shortName: string;
  types: string[];
  width: number;
  height: number;
  backgroundColor?: string;
  bsgCategoryId?: string;
  gridImageLink?: string;
  /** Лучший торговец-скупщик. */
  traderSell?: SearchTraderPrice;
  /** Продажа на барахолке. */
  fleaSell?: SearchPriceEntry;
}

/** Предмет-цель задания (для плиток в карточке поиска). */
export interface QuestSearchItem {
  id: string;
  shortName: string;
  image512pxLink: string;
  count: number;
  foundInRaid: boolean;
}

/** Задание в выдаче поиска. */
export interface QuestSearchResult {
  id: string;
  name: string;
  normalizedName: string;
  trader: { name: string; normalizedName: string };
  minPlayerLevel: number;
  kappaRequired: boolean;
  lightkeeperRequired: boolean;
  items: QuestSearchItem[];
}
