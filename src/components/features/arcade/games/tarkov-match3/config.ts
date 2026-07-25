// Константы game02 «Три в ряд / Tarkov Match-3» (MVP). Баланс тюним после тестов.
// Ассеты: /images/arcade/game02/items/<name>.webp (1000×1000).

export const ASSET_BASE = '/images/arcade/game02/items';
export const itemSrc = (name: string) => `${ASSET_BASE}/${name}.webp`;

// ─── Базовые фишки (повязки) ───
export const COLORS = ['red', 'blue', 'yellow', 'green'] as const;
export type ChipColor = (typeof COLORS)[number];

// ─── Спец-фишки ───
export type SpecialKind = 'rshg-horizontal' | 'rshg-vertical' | 'zaryad' | 'rgo' | 'kerman';

// ─── Инструменты (панель снизу, не тратят ход) ───
export type ToolKind = 'tool' | 'pestik-horizontal' | 'pestik-vertical' | 'vodka';
export const TOOLS: readonly ToolKind[] = ['tool', 'pestik-horizontal', 'pestik-vertical', 'vodka'];
export const TOOL_LABEL: Record<ToolKind, string> = {
  tool: 'Мультитул',
  'pestik-horizontal': 'Пестик —',
  'pestik-vertical': 'Пестик |',
  vodka: 'Водка',
};

// ─── Экономика / энергия ───
export const SCORE_PER_CHIP = 1; // 1 разрушенная фишка = 1 ₽
export const ENERGY_MAX = 5;
export const ENERGY_REGEN_MS = 30 * 60 * 1000; // +1 ⚡ каждые 30 мин
export const ENERGY_REFILL_PRICE = 500; // полное 5/5 за 500 ₽
export const CONTINUE_PRICES = [100, 200, 400]; // «Купить +5 ходов» (3-я и далее = 400)
export const CONTINUE_MOVES = 5;

// ─── Анимации (мс) ───
export const SWAP_MS = 140;
export const CLEAR_MS = 180;
export const FALL_MS = 90; // на клетку падения

// ─── Уровни (MVP §7) ───
export interface LevelGoal {
  readonly type: 'rubles' | 'wood';
  readonly target: number; // ₽ либо число блоков wood
}
export interface LevelDef {
  readonly id: number;
  readonly rows: number;
  readonly cols: number;
  readonly moves: number;
  readonly goal: LevelGoal;
  /** Строки (0-индекс снизу? — задаём сверху вниз), заполняемые wood на старте. */
  readonly woodRows: readonly number[];
  readonly brief: string;
}

export const LEVELS: readonly LevelDef[] = [
  {
    id: 1,
    rows: 9,
    cols: 8,
    moves: 30,
    goal: { type: 'rubles', target: 50 },
    woodRows: [],
    brief: 'Прапор просит наличку. Собери 50 ₽ за 30 ходов.',
  },
  {
    id: 2,
    rows: 9,
    cols: 9,
    moves: 30,
    goal: { type: 'wood', target: 18 }, // 2 ряда × 9
    woodRows: [7, 8], // две нижние строки
    brief: 'Разбей деревянные ящики (нижние два ряда) за 30 ходов.',
  },
];

export function levelByIndex(i: number): LevelDef {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))];
}
