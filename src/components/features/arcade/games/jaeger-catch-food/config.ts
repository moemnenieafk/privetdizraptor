// Константы game04 «Егерь ловит покушать» (ретро-LCD «Ну, погоди!»). Всё тюнимое — здесь.
// Ассеты в /images/arcade/game03 (нумерация паков V4DYA), код-id игры — jaeger-catch-food.

export const ASSET_BASE = '/images/arcade/game03';
export const assetSrc = (name: string) => `${ASSET_BASE}/${name}.webp`;

export type Pos = 'ul' | 'dl' | 'ur' | 'dr';
export const POSITIONS: readonly Pos[] = ['ul', 'dl', 'ur', 'dr'];

// Поза Егеря по позиции корзины = отдельный спрайт.
export const JAEGER_SPRITE: Record<Pos, string> = {
  ul: 'jaegerupleft',
  dl: 'jaegerdownleft',
  ur: 'jaegerupright',
  dr: 'jaegerdownright',
};

// Геометрия скатов (лог. 640×480): start (верх ската) → catch (у корзины Егеря).
export interface Ramp {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
}
export const RAMPS: Record<Pos, Ramp> = {
  ul: { sx: 46, sy: 52, cx: 250, cy: 250 },
  dl: { sx: 22, sy: 198, cx: 250, cy: 338 },
  ur: { sx: 594, sy: 52, cx: 390, cy: 250 },
  dr: { sx: 618, sy: 198, cx: 390, cy: 338 },
};

export const JAEGER_CX = 320;
export const JAEGER_CY = 336;
export const JAEGER_H = 190; // высота спрайта Егеря (лог. px)
export const ITEM_SIZE = 44;

// ─── Предметы ───
export type LootKind = 'tushonka' | 'iskra' | 'lapsha';
export const LOOT: readonly LootKind[] = ['tushonka', 'iskra', 'lapsha'];
export type ItemKind = LootKind | 'btc' | 'm67';

export const SCORE_NORMAL = 1;
export const SCORE_BTC = 5;
export const GRENADE_CHANCE = 0.18; // доля штрафной гранаты среди не-btc спавнов
export const BTC_MIN = 25; // 1 биткоин на 25–75 спавнов (GDD §3)
export const BTC_MAX = 75;

// ─── Жизни ───
export const MAX_MISSES = 3;

// ─── Скорость/плотность от счёта (GDD §4) ───
export function rollMsFor(score: number): number {
  if (score < 6) return 5000;
  if (score < 11) return 5000 - ((score - 5) / 5) * 1800; // 6–10: плавно 5000→3200
  if (score < 21) return 3000; // средняя
  if (score < 31) return 2300; // высокая
  if (score < 51) return 1800; // очень высокая
  return 1450; // максимальный темп
}
export function concurrencyFor(score: number): number {
  if (score < 11) return 1;
  if (score < 21) return 2;
  if (score < 31) return 3;
  return 4;
}
export const SPAWN_STAGGER_MS = 420; // мин. пауза между спавнами даже при высокой плотности

// ─── Управление (регистронезависимо, lat + ru) ───
export const KEY_MAP: Record<Pos, readonly string[]> = {
  ul: ['q', 'й'],
  dl: ['s', 'ы'],
  ur: ['p', 'з'],
  dr: ['l', 'д'],
};
