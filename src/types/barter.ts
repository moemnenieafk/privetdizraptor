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

export interface BarterCalculation {
  totalComponentsCost: number;
  targetItemFleaPrice: number;
  instantProfit: number;
  calculatedSavings: number;
  isFleaArbitrageProfitable: boolean;
  roi: number;
}

export interface StashEconomics {
  totalFleaValue: number;
  totalTraderValue: number;
  arbitrageCount: number;
  arbitrageProfit: number;
}
