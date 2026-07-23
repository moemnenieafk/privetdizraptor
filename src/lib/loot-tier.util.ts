// Единая тир-шкала «₽/слот» (S–D) для предметов EFT.
// Источник правды для /eft/progress/price-slot (чистая выручка/слот) и
// /eft/progress/loot-rate (vps — лучшая цена/слот). Пороги — в рублях за клетку.

export type LootTier = 'S' | 'A' | 'B' | 'C' | 'D';

export const TIER_THRESHOLDS: { tier: LootTier; min: number }[] = [
  { tier: 'S', min: 40_000 },
  { tier: 'A', min: 20_000 },
  { tier: 'B', min: 10_000 },
  { tier: 'C', min: 5_000 },
  { tier: 'D', min: 0 },
];

export const TIER_ORDER: LootTier[] = ['S', 'A', 'B', 'C', 'D'];

export const TIER_COLOR: Record<LootTier, string> = {
  S: 'text-success',
  A: 'text-(--primary)',
  B: 'text-sky-400',
  C: 'text-text-secondary',
  D: 'text-text-muted',
};

export function tierOf(pricePerSlot: number): LootTier {
  return TIER_THRESHOLDS.find((t) => pricePerSlot >= t.min)?.tier ?? 'D';
}
