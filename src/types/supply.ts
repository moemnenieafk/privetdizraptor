export interface SupplyItem {
  name: string;
  normalizedName: string;
  avg24hPrice: number;
  basePrice: number;
  changeLast48hPercent: number;
  low24hPrice: number;
  high24hPrice: number;
  range24hPercent: number;
  bestTraderBuy: { price: number; vendorName: string; vendorNormalizedName: string } | null;
  buybackRatio: number;
  profitScore: number;
}
