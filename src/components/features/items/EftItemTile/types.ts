export type EftProfitLevel = 'neutral' | 'profitable' | 'unprofitable';

export function calcEftProfitLevel(profit: number): EftProfitLevel {
  if (profit > 500) return 'profitable';
  if (profit < -500) return 'unprofitable';
  return 'neutral';
}

export interface EftVendor {
  name: string;
  normalizedName?: string;
}

export interface EftPriceEntry {
  price: number;
  currency?: string;
  vendor?: EftVendor;
}

export interface EftCraftIngredient {
  id: string;
  name: string;
  iconLink?: string;
  count: number;
}

export interface EftCraftData {
  stationLevel: number;
  stationName?: string;
  ingredients: EftCraftIngredient[];
  durationLabel: string;
  buyPrice: number;
  turnoverPerHour: number;
  profit: number;
  profitPerHour: number;
}

export interface EftBarterItem {
  id: string;
  name: string;
  iconLink?: string;
  count: number;
}

export interface EftBarterData {
  trader: EftVendor;
  items: EftBarterItem[];
  buyPrice: number;
  savings: number;
  profit: number;
  commission: number;
}

export type EftQuestStatus = 'not_started' | 'in_progress' | 'completed';

export interface EftQuestObjective {
  description: string;
  completed?: boolean;
}

export type EftQuestData =
  | {
      type: 'task_progress';
      questName: string;
      questImageLink?: string;
      npcName: string;
      npcImageLink?: string;
      description: string;
      progress: string;
      status: EftQuestStatus;
    }
  | {
      type: 'unlock_trade';
      questName: string;
      questImageLink?: string;
      npcName: string;
      npcImageLink?: string;
      traderName: string;
      traderImageLink?: string;
      objectives: EftQuestObjective[];
      status: EftQuestStatus;
    };

export interface EftItemPricing {
  traderBuy?: EftPriceEntry;
  fleaBuy?: EftPriceEntry;
  traderSell?: EftPriceEntry;
  fleaSell?: EftPriceEntry;
}

export interface EftItemData {
  id: string;
  normalizedName: string;
  name: string;
  shortName: string;
  width: number;
  height: number;
  backgroundColor?: string;
  image512pxLink?: string;
  pricing: EftItemPricing;
  indicators?: {
    barter?: EftBarterData;
    craft?: EftCraftData;
    quest?: EftQuestData;
  };
}
