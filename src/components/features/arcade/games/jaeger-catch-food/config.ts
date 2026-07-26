// Константы game04 «Егерь ловит покушать» (ретро-LCD «Ну, погоди!»). Всё тюнимое — здесь.
// Ассеты в /images/arcade/game03 (нумерация паков V4DYA), код-id игры — jaeger-catch-food.

export const ASSET_BASE = '/images/arcade/game03';

export type Pos = 'ul' | 'dl' | 'ur' | 'dr';
export const POSITIONS: readonly Pos[] = ['ul', 'dl', 'ur', 'dr'];

// Поза Егеря по позиции корзины = отдельный спрайт.
export const JAEGER_SPRITE: Record<Pos, string> = {
  ul: 'jaegerupleft',
  dl: 'jaegerdownleft',
  ur: 'jaegerupright',
  dr: 'jaegerdownright',
};

// Точные прямые траектории от V4DYA (SVG trajectory-*.svg, viewBox 3840×2867 = система координат
// арта). Переведены в лог. 640×480 (×640/3840, ×480/2867). start за краем экрана (предмет
// вкатывается с крыши) → catch у корзины Егеря. Прямая линия (предмет скатывается + вращается).
export interface Ramp {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
}
export const RAMPS: Record<Pos, Ramp> = {
  ul: { sx: -22, sy: 122, cx: 192, cy: 238 },
  dl: { sx: -22, sy: 222, cx: 192, cy: 337 },
  ur: { sx: 662, sy: 122, cx: 448, cy: 238 },
  dr: { sx: 662, sy: 222, cx: 448, cy: 337 },
};

// Пороги квадрантов для тач-управления (лево/право и верх/низ по позициям корзин).
export const QUAD_X = 320;
export const QUAD_Y = 288;
// Блок предмета ≈ ¼ роста Егеря (Егерь ~1400px во фрейме 3840×2867 → ~234px на канвасе 640×480;
// 234/4 ≈ 60). Относительные размеры предметов заданы padding'ом внутри 512²-блоков.
export const ITEM_SIZE = 60;
export const ITEM_TURNS = 2.4; // оборотов вращения предмета за спуск (скатывается «по кругу»)

// ─── Предметы (ассеты V4DYA по подпапкам) ───
// food/ + drink/ — обычный лут (+1); bonus/btc — редкий (+5); damage/ — гранаты (штраф).
export const FOOD = [
  'ekopure', 'emelya', 'galetu', 'goroshek', 'iskra', 'kirieshki', 'kolbaca', 'lapsha', 'mre',
  'olivie', 'pashtet', 'saira', 'sgushenka', 'shproti', 'slickers', 'sushenoemyaso',
  'tushenka-malenkaya', 'tushonka',
] as const;
export const DRINK = ['aquamari', 'hotrod', 'kvas', 'maxenergy', 'moloko', 'ratcola', 'tarcola'] as const;
export const LOOT_SPRITES: readonly string[] = [...FOOD, ...DRINK];
export const BONUS_SPRITE = 'btc';
export const DAMAGE_SPRITES = ['m67', 'rgd5'] as const;

// Роутинг ассета по подпапке; backplate/jaeger*/траектории — в корне (нет в DIR).
const DIR: Record<string, string> = {};
for (const n of FOOD) DIR[n] = 'food';
for (const n of DRINK) DIR[n] = 'drink';
DIR[BONUS_SPRITE] = 'bonus';
for (const n of DAMAGE_SPRITES) DIR[n] = 'damage';
export const assetSrc = (name: string) => `${ASSET_BASE}/${DIR[name] ? `${DIR[name]}/` : ''}${name}.webp`;

export type ItemCategory = 'food' | 'bonus' | 'damage';
export const SCORE_NORMAL = 1;
export const SCORE_BONUS = 5;
export const GRENADE_CHANCE = 0.18; // доля штрафной гранаты среди не-bonus спавнов
export const BTC_MIN = 25; // 1 бонус на 25–75 спавнов (GDD §3)
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
