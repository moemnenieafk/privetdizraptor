export type EftProfitLevel = 'neutral' | 'profitable' | 'unprofitable';

export type EftTopStat =
  | { kind: 'capacity';   value: number }
  | { kind: 'durability'; current: number; max: number }
  | { kind: 'hearing';    value: number }
  | { kind: 'weight';     value: number }
  | { kind: 'uses';       value: number }
  | { kind: 'custom';     label: string; value: string | number }
  | { kind: 'hidden' };

export interface EftAmmoOverlay {
  damage:      number;
  penetration: number;
}

export function calcEftProfitLevel(profit: number): EftProfitLevel {
  if (profit > 500) return 'profitable';
  if (profit < -500) return 'unprofitable';
  return 'neutral';
}

export interface EftVendor {
  name: string;
  normalizedName?: string;
}

import type { EftCurrency } from '@/lib/formatters';
export type { EftCurrency };

export interface EftPriceEntry {
  price: number;
  priceRUB?: number;
  currency?: EftCurrency;
  vendor?: EftVendor;
  loyaltyLevel?: number;
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
  buyPriceNative?: number;
  buyCurrency?: EftCurrency;
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
  buyPriceNative?: number;
  buyCurrency?: EftCurrency;
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
  topStat?:        EftTopStat;
  armorClass?:     number;
  ammoOverlay?:    EftAmmoOverlay;
  minPlayerLevel?: number;
  questCount?:     number;
  inventoryCount?: number;
}
