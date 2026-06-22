export interface BarterVendor {
  name: string;
  normalizedName: string;
}

export interface BarterPrice {
  price: number;
  priceRUB?: number | null;
  vendor: BarterVendor;
}

// Shared base: compatible with both items() and barters() API responses
export interface BarterItemBase {
  id: string;
  name: string;
  shortName: string;
  image512pxLink: string;
  backgroundColor: string;
  width: number;
  height: number;
  sellFor: BarterPrice[];
  buyFor?: BarterPrice[];
  normalizedName?: string;
  basePrice?: number;
}

// Full item from items(types:[barter]) query — has normalizedName + buyFor required
export interface BarterSearchResult extends BarterItemBase {
  normalizedName: string;
  buyFor: BarterPrice[];
}

export interface StashItem {
  uid: string;
  id: string;
  name: string;
  shortName: string;
  image512pxLink: string;
  backgroundColor: string;
  width: number;
  height: number;
  col: number;
  row: number;
  fleaPrice: number | null;
  bestTraderPriceRub: number | null;
}

export interface BarterTradeItem {
  item: BarterItemBase;
  count: number;
}

export interface BarterTrade {
  id: string;
  trader: { name: string; normalizedName: string };
  level: number;
  taskUnlock: { id: string } | null;
  requiredItems: BarterTradeItem[];
  rewardItems: BarterTradeItem[];
}

export type BarterVerdict = 'profitable' | 'neutral' | 'unprofitable';

export interface BarterCalculation {
  totalComponentsCost: number;
  targetItemFleaPrice: number;
  instantProfit: number;
  calculatedSavings: number;
  isFleaArbitrageProfitable: boolean;
  roi: number;
  /** Комиссия барахолки за продажу награды (налог флии). */
  fleaCommission: number;
  /** Честная прибыль «в карман»: лучшее из (трейдер-продажа) и (флиа − налог) минус ингредиенты. */
  netProfit: number;
  /** Вердикт по netProfit с порогом ±500 ₽. */
  verdict: BarterVerdict;
}

export interface StashEconomics {
  totalFleaValue: number;
  totalTraderValue: number;
  arbitrageCount: number;
  arbitrageProfit: number;
}
