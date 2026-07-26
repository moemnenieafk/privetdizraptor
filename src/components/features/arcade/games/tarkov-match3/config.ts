// Константы game02 «Три в ряд / Tarkov Match-3» (спека v0.3). Ассеты Димы разложены по подпапкам.

// ─── Роутинг ассетов по категориям (Дима реорганизовал items/*) ───
const ASSET_ROOT = '/images/arcade/game02/items';
const DIR: Record<string, string> = {
  // повязки
  red: 'povyazka', blue: 'povyazka', yellow: 'povyazka', green: 'povyazka',
  // спец-фишки
  'rshg-horizontal': 'kombo', 'rshg-vertical': 'kombo', zaryad: 'kombo', rgo: 'kombo', kerman: 'kombo',
  // блоки/препятствия
  wood: 'block', wood2: 'block', leaves: 'block',
  // инструменты
  tool: 'booster', 'pestik-horizontal': 'booster', 'pestik-vertical': 'booster', vodka: 'booster',
};
export const itemSrc = (name: string) => `${ASSET_ROOT}/${DIR[name] ? `${DIR[name]}/` : ''}${name}.webp`;

// ─── Базовые фишки (повязки) ───
export const COLORS = ['red', 'blue', 'yellow', 'green'] as const;
export type ChipColor = (typeof COLORS)[number];

// ─── Спец-фишки ───
export type SpecialKind = 'rshg-horizontal' | 'rshg-vertical' | 'zaryad' | 'rgo' | 'kerman';

// ─── Инструменты (панель снизу, не тратят ход; счётчики — старт 0, спека §5) ───
export type ToolKind = 'tool' | 'pestik-horizontal' | 'pestik-vertical' | 'vodka';
export const TOOLS: readonly ToolKind[] = ['tool', 'pestik-horizontal', 'pestik-vertical', 'vodka'];
export const TOOL_LABEL: Record<ToolKind, string> = {
  tool: 'Мультитул',
  'pestik-horizontal': 'Пестик —',
  'pestik-vertical': 'Пестик |',
  vodka: 'Водка',
};

// ─── Экономика / энергия (спека v0.3 §2, §6) ───
export const START_RUBLES = 2000;
export const SCORE_PER_CHIP = 1; // 1 разрушенная фишка = 1 ₽
export const LEVEL_REWARD = 10; // фикс-награда за уровень
export const ENERGY_MAX = 5;
export const ENERGY_REGEN_MS = 30 * 60 * 1000; // +1 ⚡ каждые 30 мин
export const ENERGY_REFILL_PRICE = 900; // полное 5/5 за 900 ₽
export const CONTINUE_PRICES = [100, 200, 400]; // «Докупить +5 ходов»
export const CONTINUE_MOVES = 5;

// ─── Тайминги анимаций (мс) ───
export const SWAP_MS = 150;
export const CLEAR_MS = 200;
export const FALL_MS_PER_CELL = 60; // скорость падения (с инерцией — см. ease в render)
export const REFILL_MS_PER_CELL = 60;
export const BONUS_STEP_MS = 160; // шаг детонации бонус-фазы
export const HINT_IDLE_MS = 5000; // бездействие до показа подсказки

// ─── Уровни (спека §8) ───
export type GoalType = 'wood' | 'wood2' | 'leaves';
export interface WoodSpec { r: number; c: number; hp: number }
export interface CellRC { r: number; c: number }
export interface LevelLayout {
  wood: WoodSpec[];
  leaves: CellRC[];
  holes: CellRC[];
  goalType: GoalType;
  goalTarget: number;
}
export interface LevelDef {
  readonly id: number;
  readonly rows: number;
  readonly cols: number;
  readonly moves: number;
  readonly brief: string;
  readonly build: () => LevelLayout;
}

// L1: 9×8, wood в нижних 4 строках (6–9 → 0-idx 5..8).
function buildL1(): LevelLayout {
  const wood: WoodSpec[] = [];
  for (let r = 5; r <= 8; r++) for (let c = 0; c < 8; c++) wood.push({ r, c, hp: 1 });
  return { wood, leaves: [], holes: [], goalType: 'wood', goalTarget: wood.length };
}
// L2: 9×9, wood лесенкой (строка r 1-idx 2..9 → cols 1..(r-1)).
function buildL2(): LevelLayout {
  const wood: WoodSpec[] = [];
  for (let r1 = 2; r1 <= 9; r1++) for (let c1 = 1; c1 <= r1 - 1; c1++) wood.push({ r: r1 - 1, c: c1 - 1, hp: 1 });
  return { wood, leaves: [], holes: [], goalType: 'wood', goalTarget: wood.length };
}
// L3: 9×9, wood2 пирамидой (9,7,5,3,1).
function buildL3(): LevelLayout {
  const wood: WoodSpec[] = [];
  const rowsSpec: Array<[number, number, number]> = [
    [9, 1, 9],
    [8, 2, 8],
    [7, 3, 7],
    [6, 4, 6],
    [5, 5, 5],
  ]; // [row1, colFrom1, colTo1]
  for (const [r1, cf, ct] of rowsSpec) for (let c1 = cf; c1 <= ct; c1++) wood.push({ r: r1 - 1, c: c1 - 1, hp: 2 });
  return { wood, leaves: [], holes: [], goalType: 'wood2', goalTarget: wood.length };
}
// L4: 9×9, leaves во внутреннем квадрате 7×7 (строки/столбцы 2..8 1-idx).
function buildL4(): LevelLayout {
  const leaves: CellRC[] = [];
  for (let r = 1; r <= 7; r++) for (let c = 1; c <= 7; c++) leaves.push({ r, c });
  return { wood: [], leaves, holes: [], goalType: 'leaves', goalTarget: leaves.length };
}
// L5: 9×9 с 8 дырами, grass(=leaves) во всех клетках кроме дыр (73).
function buildL5(): LevelLayout {
  const holes: CellRC[] = [
    { r: 0, c: 4 }, { r: 1, c: 4 }, { r: 4, c: 0 }, { r: 4, c: 1 },
    { r: 4, c: 7 }, { r: 4, c: 8 }, { r: 7, c: 4 }, { r: 8, c: 4 },
  ];
  const holeSet = new Set(holes.map((h) => h.r * 9 + h.c));
  const leaves: CellRC[] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!holeSet.has(r * 9 + c)) leaves.push({ r, c });
  return { wood: [], leaves, holes, goalType: 'leaves', goalTarget: leaves.length };
}

export const LEVELS: readonly LevelDef[] = [
  { id: 1, rows: 9, cols: 8, moves: 30, brief: 'Прапор просит ящики. Разбей все wood за 30 ходов.', build: buildL1 },
  { id: 2, rows: 9, cols: 9, moves: 27, brief: 'Разбей деревянные ящики (лесенка) за 27 ходов.', build: buildL2 },
  { id: 3, rows: 9, cols: 9, moves: 27, brief: 'Усиленные ящики: два удара каждый. Пирамида, 27 ходов.', build: buildL3 },
  { id: 4, rows: 9, cols: 9, moves: 30, brief: 'Выжги листву под фишками (центр 7×7) за 30 ходов.', build: buildL4 },
  { id: 5, rows: 9, cols: 9, moves: 30, brief: 'Поле с провалами. Выжги всю траву за 30 ходов.', build: buildL5 },
];

export function levelByIndex(i: number): LevelDef {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))];
}
export const LEVEL_COUNT = LEVELS.length;
