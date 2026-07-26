// Движок game02 «Три в ряд» v0.3. Пошаговый резолв во времени (твины): swap → clear → fall → каскад.
// Ввод заблокирован пока anim!=='idle'. Препятствия wood/wood2/leaves + дыры (L5), комбо-матрица,
// бонус-фаза, авто-подсказки, инструменты со счётчиками.

import type { ArcadeInput } from '../../types';
import type { SfxName } from '@/lib/sfx';
import {
  COLORS,
  TOOLS,
  SCORE_PER_CHIP,
  LEVEL_REWARD,
  SWAP_MS,
  CLEAR_MS,
  FALL_MS_PER_CELL,
  HINT_IDLE_MS,
  LEVEL_COUNT,
  CONTINUE_PRICES,
  CONTINUE_MOVES,
  levelByIndex,
  type ChipColor,
  type SpecialKind,
  type ToolKind,
  type GoalType,
} from './config';
import { computeLayout, cellAt, toolIndexAt, type Layout } from './layout';

export type Cell =
  | { kind: 'color'; color: ChipColor }
  | { kind: 'special'; special: SpecialKind }
  | { kind: 'wood'; hp: number }
  | null;

export type Phase = 'loading' | 'brief' | 'playing' | 'won' | 'nomoves';
export type AnimPhase = 'idle' | 'swap' | 'swapback' | 'clear' | 'fall' | 'bonus';

export interface ClearFx {
  r: number;
  c: number;
  until: number;
}
export interface RC {
  r: number;
  c: number;
}

export interface Match3Hooks {
  sfx: (n: SfxName) => void;
  addRubles: (n: number) => void;
  getWallet: () => number;
  spendWallet: (n: number) => boolean;
  spendEnergy: () => void;
  addStar: () => void;
  spendTool: (t: ToolKind) => boolean;
  toolCount: (t: ToolKind) => number;
}

interface Gathered {
  remove: Set<number>;
  woodHit: Set<number>;
  leafBurn: Set<number>;
  rubles: number;
}
interface PendingCommit {
  gathered: Gathered;
  placements: { i: number; special: SpecialKind }[];
}

export interface Match3State {
  phase: Phase;
  levelIndex: number;
  rows: number;
  cols: number;
  grid: Cell[][];
  leaves: boolean[][];
  holes: boolean[][];
  moves: number;
  goalType: GoalType;
  goalTarget: number;
  goalProgress: number;
  rublesEarned: number;
  bonus: number;
  starEarned: boolean;
  activeTool: ToolKind | null;
  selected: RC | null;
  downCell: RC | null;
  prevDown: boolean;
  nowMs: number;
  idleMs: number; // для подсказки
  hint: [RC, RC] | null;
  continuePurchases: number;
  clearFx: ClearFx[];
  lay: Layout;

  // ── Анимация ──
  anim: AnimPhase;
  animT: number;
  animDur: number;
  swapA: RC | null;
  swapB: RC | null;
  fallOffset: number[][] | null; // на сколько клеток «влетела» ячейка (для интерполяции)
  clearing: number[]; // индексы клеток в фазе clear (для pop/fade)
  pending: PendingCommit | null;
  pendingSeed: number[] | null; // первичный клир от спец/комбо-свапа
  playerMove: boolean; // текущий резолв — от хода игрока (списать ход в конце)
  bonusQueue: number[]; // индексы спецфишек к детонации в бонус-фазе
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function randColor(): ChipColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}
function colorOf(cell: Cell): ChipColor | null {
  return cell && cell.kind === 'color' ? cell.color : null;
}

export function createLevelState(levelIndex: number): Match3State {
  const lvl = levelByIndex(levelIndex);
  const { rows, cols } = lvl;
  const layout = lvl.build();
  const holes: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  const leaves: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  for (const h of layout.holes) holes[h.r][h.c] = true;
  for (const l of layout.leaves) if (!holes[l.r][l.c]) leaves[l.r][l.c] = true;

  const woodMap = new Map<number, number>();
  for (const w of layout.wood) woodMap.set(w.r * cols + w.c, w.hp);

  const grid: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < cols; c++) {
      if (holes[r][c]) {
        row.push(null);
        continue;
      }
      const wh = woodMap.get(r * cols + c);
      if (wh != null) {
        row.push({ kind: 'wood', hp: wh });
        continue;
      }
      let color: ChipColor;
      let tries = 0;
      do {
        color = randColor();
        tries++;
      } while (
        tries < 25 &&
        ((c >= 2 && colorOf(row[c - 1]) === color && colorOf(row[c - 2]) === color) ||
          (r >= 2 && colorOf(grid[r - 1][c]) === color && colorOf(grid[r - 2][c]) === color))
      );
      row.push({ kind: 'color', color });
    }
    grid.push(row);
  }

  return {
    phase: 'loading',
    levelIndex,
    rows,
    cols,
    grid,
    leaves,
    holes,
    moves: lvl.moves,
    goalType: layout.goalType,
    goalTarget: layout.goalTarget,
    goalProgress: 0,
    rublesEarned: 0,
    bonus: 0,
    starEarned: false,
    activeTool: null,
    selected: null,
    downCell: null,
    prevDown: false,
    nowMs: 0,
    idleMs: 0,
    hint: null,
    continuePurchases: 0,
    clearFx: [],
    lay: computeLayout(rows, cols),
    anim: 'idle',
    animT: 0,
    animDur: 0,
    swapA: null,
    swapB: null,
    fallOffset: null,
    clearing: [],
    pending: null,
    pendingSeed: null,
    playerMove: false,
    bonusQueue: [],
  };
}

const idx = (s: Match3State, r: number, c: number) => r * s.cols + c;
const inb = (s: Match3State, r: number, c: number) => r >= 0 && r < s.rows && c >= 0 && c < s.cols;
const isHole = (s: Match3State, r: number, c: number) => s.holes[r][c];

// ─── Матчи + классификация ───
interface Group {
  cells: RC[];
  maxH: number;
  maxV: number;
  is2x2: boolean;
}
function findGroups(s: Match3State): Group[] {
  const { rows, cols, grid } = s;
  const matched: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const col = colorOf(grid[r][c]);
      if (col) {
        let e = c + 1;
        while (e < cols && colorOf(grid[r][e]) === col) e++;
        if (e - c >= 3) for (let k = c; k < e; k++) matched[r][k] = true;
        c = e;
      } else c++;
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const col = colorOf(grid[r][c]);
      if (col) {
        let e = r + 1;
        while (e < rows && colorOf(grid[e][c]) === col) e++;
        if (e - r >= 3) for (let k = r; k < e; k++) matched[k][c] = true;
        r = e;
      } else r++;
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const col = colorOf(grid[r][c]);
      if (col && colorOf(grid[r][c + 1]) === col && colorOf(grid[r + 1][c]) === col && colorOf(grid[r + 1][c + 1]) === col) {
        matched[r][c] = matched[r][c + 1] = matched[r + 1][c] = matched[r + 1][c + 1] = true;
      }
    }
  }
  const visited: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  const groups: Group[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!matched[r][c] || visited[r][c]) continue;
      const color = colorOf(grid[r][c]);
      if (!color) continue;
      const cells: RC[] = [];
      const stack: RC[] = [{ r, c }];
      visited[r][c] = true;
      while (stack.length) {
        const cur = stack.pop()!;
        cells.push(cur);
        for (const [dr, dc] of DIRS) {
          const nr = cur.r + dr;
          const nc = cur.c + dc;
          if (!inb(s, nr, nc)) continue;
          if (matched[nr][nc] && !visited[nr][nc] && colorOf(grid[nr][nc]) === color) {
            visited[nr][nc] = true;
            stack.push({ r: nr, c: nc });
          }
        }
      }
      const inGroup = new Set(cells.map((p) => p.r * cols + p.c));
      let maxH = 1;
      let maxV = 1;
      for (const p of cells) {
        let len = 1;
        let cc = p.c + 1;
        while (inGroup.has(p.r * cols + cc)) {
          len++;
          cc++;
        }
        maxH = Math.max(maxH, len);
        len = 1;
        let rr = p.r + 1;
        while (inGroup.has(rr * cols + p.c)) {
          len++;
          rr++;
        }
        maxV = Math.max(maxV, len);
      }
      const rs = Math.max(...cells.map((p) => p.r)) - Math.min(...cells.map((p) => p.r));
      const cs = Math.max(...cells.map((p) => p.c)) - Math.min(...cells.map((p) => p.c));
      groups.push({ cells, maxH, maxV, is2x2: cells.length === 4 && rs === 1 && cs === 1 && maxH < 3 && maxV < 3 });
    }
  }
  return groups;
}
function classify(g: Group): SpecialKind | null {
  const maxRun = Math.max(g.maxH, g.maxV);
  if (maxRun >= 5) return 'kerman';
  if (g.maxH >= 3 && g.maxV >= 3) return 'zaryad';
  if (g.is2x2) return 'rgo';
  if (maxRun === 4) return (g.maxH === 4 ? 'rshg-horizontal' : 'rshg-vertical');
  return null;
}
function placement(g: Group, hint: RC[] | null): RC {
  if (hint) for (const h of hint) if (g.cells.some((p) => p.r === h.r && p.c === h.c)) return h;
  const set = new Set(g.cells.map((p) => p.r * 1e4 + p.c));
  let best = g.cells[0];
  let bestN = -1;
  for (const p of g.cells) {
    let n = 0;
    for (const [dr, dc] of DIRS) if (set.has((p.r + dr) * 1e4 + (p.c + dc))) n++;
    if (n > bestN) {
      bestN = n;
      best = p;
    }
  }
  return best;
}

function mostCommonColor(s: Match3State): ChipColor {
  const cnt = new Map<ChipColor, number>();
  for (const row of s.grid) for (const cell of row) {
    const col = colorOf(cell);
    if (col) cnt.set(col, (cnt.get(col) ?? 0) + 1);
  }
  let best: ChipColor = COLORS[0];
  let bestN = -1;
  for (const [k, v] of cnt) if (v > bestN) {
    bestN = v;
    best = k;
  }
  return best;
}

function specialEffect(s: Match3State, r: number, c: number, special: SpecialKind, color?: ChipColor): number[] {
  const out: number[] = [];
  if (special === 'rshg-horizontal') {
    for (let cc = 0; cc < s.cols; cc++) out.push(idx(s, r, cc));
  } else if (special === 'rshg-vertical') {
    for (let rr = 0; rr < s.rows; rr++) out.push(idx(s, rr, c));
  } else if (special === 'zaryad') {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (inb(s, r + dr, c + dc)) out.push(idx(s, r + dr, c + dc));
  } else if (special === 'rgo') {
    out.push(idx(s, r, c));
    for (const [dr, dc] of DIRS) if (inb(s, r + dr, c + dc)) out.push(idx(s, r + dr, c + dc));
  } else if (special === 'kerman') {
    const target = color ?? mostCommonColor(s);
    for (let rr = 0; rr < s.rows; rr++) for (let cc = 0; cc < s.cols; cc++) if (colorOf(s.grid[rr][cc]) === target) out.push(idx(s, rr, cc));
  }
  return out;
}

// ─── Комбо-матрица (спека §3) ───
function randomTargets(s: Match3State, n: number): RC[] {
  const cand: RC[] = [];
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) if (!isHole(s, r, c)) cand.push({ r, c });
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  return cand.slice(0, n);
}
function comboCells(s: Match3State, ak: SpecialKind, bk: SpecialKind, r: number, c: number): number[] {
  const set = new Set<number>();
  const add = (arr: number[]) => arr.forEach((i) => set.add(i));
  const kinds = [ak, bk];
  const has = (k: SpecialKind) => kinds.includes(k);
  const isRshg = (k: SpecialKind) => k === 'rshg-horizontal' || k === 'rshg-vertical';
  const hasRshg = isRshg(ak) || isRshg(bk);

  if (has('kerman') && (ak === 'kerman' && bk === 'kerman')) {
    // Полная зачистка + делэйер всех препятствий (снятие 1 слоя) делаем в commit по флагу.
    for (let rr = 0; rr < s.rows; rr++) for (let cc = 0; cc < s.cols; cc++) if (colorOf(s.grid[rr][cc])) set.add(idx(s, rr, cc));
    for (let rr = 0; rr < s.rows; rr++) for (let cc = 0; cc < s.cols; cc++) if (s.grid[rr][cc]?.kind === 'wood') set.add(idx(s, rr, cc));
    return [...set];
  }
  if (has('kerman')) {
    // kerman + X: превратить преобладающий цвет в X и детонировать (упрощённо — эффект X по всем тем клеткам).
    const col = mostCommonColor(s);
    const other = ak === 'kerman' ? bk : ak;
    for (let rr = 0; rr < s.rows; rr++) for (let cc = 0; cc < s.cols; cc++) if (colorOf(s.grid[rr][cc]) === col) add(specialEffect(s, rr, cc, other));
    return [...set];
  }
  if (hasRshg && has('zaryad')) {
    for (let dr = -1; dr <= 1; dr++) for (let cc = 0; cc < s.cols; cc++) if (inb(s, r + dr, cc)) set.add(idx(s, r + dr, cc));
    for (let dc = -1; dc <= 1; dc++) for (let rr = 0; rr < s.rows; rr++) if (inb(s, rr, c + dc)) set.add(idx(s, rr, c + dc));
    return [...set];
  }
  if (hasRshg && has('rgo')) {
    // rgo переносит rshg в важную цель (у препятствия) и активирует линию там.
    const t = importantTarget(s) ?? { r, c };
    add(specialEffect(s, t.r, t.c, 'rshg-horizontal'));
    add(specialEffect(s, t.r, t.c, 'rshg-vertical'));
    return [...set];
  }
  if (has('rgo') && has('zaryad')) {
    const t = importantTarget(s) ?? { r, c };
    add(specialEffect(s, t.r, t.c, 'zaryad')); // 5×5
    return [...set];
  }
  if (has('rgo') && ak === 'rgo' && bk === 'rgo') {
    // Локальный крест + 3 rgo в случайные цели.
    add(specialEffect(s, r, c, 'rgo'));
    for (const t of randomTargets(s, 3)) add(specialEffect(s, t.r, t.c, 'rgo'));
    return [...set];
  }
  if (has('zaryad') && ak === 'zaryad' && bk === 'zaryad') {
    for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) if (inb(s, r + dr, c + dc)) set.add(idx(s, r + dr, c + dc));
    return [...set];
  }
  if (hasRshg) {
    // rshg + rshg → крест.
    add(specialEffect(s, r, c, 'rshg-horizontal'));
    add(specialEffect(s, r, c, 'rshg-vertical'));
    return [...set];
  }
  add(specialEffect(s, r, c, ak));
  add(specialEffect(s, r, c, bk));
  return [...set];
}
/** Клетка рядом с препятствием (для rgo-переноса), иначе null. */
function importantTarget(s: Match3State): RC | null {
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    if (s.grid[r][c]?.kind === 'wood' || s.leaves[r][c]) return { r, c };
  }
  return null;
}

// ─── Сбор клира (dry) + коммит ───
function gather(s: Match3State, initial: number[]): Gathered {
  const remove = new Set<number>();
  const woodHit = new Set<number>();
  const leafBurn = new Set<number>();
  let rubles = 0;
  const queue = [...initial];
  const done = new Set<number>();
  while (queue.length) {
    const i = queue.pop()!;
    if (done.has(i)) continue;
    done.add(i);
    const r = Math.floor(i / s.cols);
    const c = i % s.cols;
    if (!inb(s, r, c) || isHole(s, r, c)) continue;
    const cell = s.grid[r][c];
    if (!cell) {
      if (s.leaves[r][c]) leafBurn.add(i);
      continue;
    }
    if (cell.kind === 'wood') {
      woodHit.add(i);
      continue;
    }
    if (cell.kind === 'special') {
      remove.add(i);
      if (s.leaves[r][c]) leafBurn.add(i);
      for (const t of specialEffect(s, r, c, cell.special)) queue.push(t);
      continue;
    }
    remove.add(i);
    rubles += SCORE_PER_CHIP;
    if (s.leaves[r][c]) leafBurn.add(i);
    for (const [dr, dc] of DIRS) if (inb(s, r + dr, c + dc) && s.grid[r + dr][c + dc]?.kind === 'wood') woodHit.add(idx(s, r + dr, c + dc));
  }
  return { remove, woodHit, leafBurn, rubles };
}
function commitClear(s: Match3State, g: Gathered, hooks: Match3Hooks): void {
  for (const i of g.remove) {
    const r = Math.floor(i / s.cols);
    const c = i % s.cols;
    s.grid[r][c] = null;
    s.clearFx.push({ r, c, until: s.nowMs + 220 });
  }
  for (const i of g.leafBurn) {
    const r = Math.floor(i / s.cols);
    const c = i % s.cols;
    if (s.leaves[r][c]) {
      s.leaves[r][c] = false;
      if (s.goalType === 'leaves') s.goalProgress += 1;
      s.clearFx.push({ r, c, until: s.nowMs + 220 });
    }
  }
  for (const i of g.woodHit) {
    const r = Math.floor(i / s.cols);
    const c = i % s.cols;
    const cell = s.grid[r][c];
    if (cell?.kind !== 'wood') continue;
    if (cell.hp > 1) {
      s.grid[r][c] = { kind: 'wood', hp: cell.hp - 1 };
    } else {
      s.grid[r][c] = null;
      if (s.goalType === 'wood' || s.goalType === 'wood2') s.goalProgress += 1;
    }
    s.clearFx.push({ r, c, until: s.nowMs + 220 });
  }
  if (g.rubles > 0) {
    s.rublesEarned += g.rubles;
    hooks.addRubles(g.rubles);
  }
}

// ─── Гравитация с дырами + fallOffset для анимации ───
function applyGravity(s: Match3State): number[][] {
  const off: number[][] = Array.from({ length: s.rows }, () => new Array<number>(s.cols).fill(0));
  for (let c = 0; c < s.cols; c++) {
    // Стены столбца: wood (упор) и hole (упор + спавнер снизу). Границы = -1 и rows.
    const walls: number[] = [-1];
    for (let r = 0; r < s.rows; r++) if (s.holes[r][c] || s.grid[r][c]?.kind === 'wood') walls.push(r);
    walls.push(s.rows);
    for (let w = 0; w < walls.length - 1; w++) {
      const topWall = walls[w];
      const bot = walls[w + 1] - 1;
      const top = topWall + 1;
      if (bot < top) continue;
      // Спавнер, если стена сверху — верх поля или ДЫРА (не wood).
      const spawner = topWall < 0 || s.holes[topWall]?.[c] === true;
      compactSegment(s, c, top, bot, spawner, off);
    }
  }
  return off;
}
function compactSegment(s: Match3State, c: number, top: number, bot: number, refill: boolean, off: number[][]): void {
  const items: Cell[] = [];
  const fromRows: number[] = [];
  for (let r = top; r <= bot; r++) {
    if (s.grid[r][c] != null && s.grid[r][c]!.kind !== 'wood') {
      items.push(s.grid[r][c]);
      fromRows.push(r);
      s.grid[r][c] = null;
    }
  }
  let r = bot;
  for (let k = items.length - 1; k >= 0; k--) {
    s.grid[r][c] = items[k];
    off[r][c] = r - fromRows[k]; // сколько клеток упала
    r--;
  }
  if (refill) {
    let spawnDepth = 1;
    while (r >= top) {
      s.grid[r][c] = { kind: 'color', color: randColor() };
      off[r][c] = (r - top) + spawnDepth; // влёт сверху
      spawnDepth++;
      r--;
    }
  }
}

// ─── Дедлок / подсказка ───
function findHint(s: Match3State): [RC, RC] | null {
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      const cell = s.grid[r][c];
      if (cell?.kind === 'special') return [{ r, c }, { r, c }];
      for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inb(s, nr, nc)) continue;
        if (s.grid[r][c]?.kind !== 'color' || s.grid[nr][nc]?.kind !== 'color') continue;
        const t = s.grid[r][c];
        s.grid[r][c] = s.grid[nr][nc];
        s.grid[nr][nc] = t;
        const ok = findGroups(s).length > 0;
        s.grid[nr][nc] = s.grid[r][c];
        s.grid[r][c] = t;
        if (ok) return [{ r, c }, { r: nr, c: nc }];
      }
    }
  }
  return null;
}
function reshuffle(s: Match3State): void {
  let guard = 0;
  do {
    const colors: ChipColor[] = [];
    for (const row of s.grid) for (const cell of row) if (cell?.kind === 'color') colors.push(cell.color);
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    let k = 0;
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) if (s.grid[r][c]?.kind === 'color') s.grid[r][c] = { kind: 'color', color: colors[k++] };
  } while (findHint(s) === null && guard++ < 40);
}

const adjacent = (a: RC, b: RC) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

// ─── Анимационный конвейер ───
function beginClear(s: Match3State, gathered: Gathered, placements: { i: number; special: SpecialKind }[], hooks: Match3Hooks): void {
  s.pending = { gathered, placements };
  s.clearing = [...gathered.remove, ...gathered.woodHit, ...gathered.leafBurn];
  s.anim = 'clear';
  s.animT = 0;
  s.animDur = CLEAR_MS;
  hooks.sfx('coins');
}
function nextBeat(s: Match3State, hooks: Match3Hooks): void {
  let seedGathered: Gathered | null = null;
  let placements: { i: number; special: SpecialKind }[] = [];
  if (s.pendingSeed) {
    seedGathered = gather(s, s.pendingSeed);
    s.pendingSeed = null;
  } else {
    const groups = findGroups(s);
    if (groups.length === 0) {
      finishResolve(s, hooks);
      return;
    }
    const toClear = new Set<number>();
    for (const g of groups) {
      const sp = classify(g);
      if (sp) {
        const pos = placement(g, null);
        const pi = idx(s, pos.r, pos.c);
        placements.push({ i: pi, special: sp });
        for (const p of g.cells) {
          const ci = idx(s, p.r, p.c);
          if (ci !== pi) toClear.add(ci);
        }
      } else {
        for (const p of g.cells) toClear.add(idx(s, p.r, p.c));
      }
    }
    seedGathered = gather(s, [...toClear]);
  }
  beginClear(s, seedGathered, placements, hooks);
}
function onClearDone(s: Match3State, hooks: Match3Hooks): void {
  const { gathered, placements } = s.pending!;
  commitClear(s, gathered, hooks);
  for (const pl of placements) {
    const r = Math.floor(pl.i / s.cols);
    const c = pl.i % s.cols;
    if (!isHole(s, r, c)) s.grid[r][c] = { kind: 'special', special: pl.special };
  }
  s.pending = null;
  s.clearing = [];
  const off = applyGravity(s);
  s.fallOffset = off;
  let maxFall = 0;
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) maxFall = Math.max(maxFall, off[r][c]);
  s.anim = 'fall';
  s.animT = 0;
  s.animDur = Math.max(1, maxFall) * FALL_MS_PER_CELL;
}
function onFallDone(s: Match3State, hooks: Match3Hooks): void {
  s.fallOffset = null;
  if (s.bonusQueue.length > 0) {
    bonusStep(s, hooks);
    return;
  }
  nextBeat(s, hooks);
}
function finishResolve(s: Match3State, hooks: Match3Hooks): void {
  s.anim = 'idle';
  if (s.phase !== 'playing') return;
  if (s.playerMove) {
    s.moves = Math.max(0, s.moves - 1);
    s.playerMove = false;
  }
  s.idleMs = 0;
  s.hint = null;
  if (goalMet(s)) {
    startBonus(s, hooks);
    return;
  }
  if (s.moves <= 0) {
    s.phase = 'nomoves';
    hooks.sfx('thud');
    return;
  }
  if (findHint(s) === null) reshuffle(s);
}

// ─── Бонус-фаза (§7): оставшиеся ходы → спец-фишки, детонация по одной ───
function startBonus(s: Match3State, hooks: Match3Hooks): void {
  const n = Math.min(s.moves, 12);
  s.moves = 0;
  const targets = randomTargets(s, n);
  s.bonusQueue = [];
  for (const t of targets) {
    if (s.grid[t.r][t.c]?.kind === 'wood') continue;
    const sp: SpecialKind = Math.random() < 0.5 ? 'zaryad' : Math.random() < 0.5 ? 'rshg-horizontal' : 'rshg-vertical';
    s.grid[t.r][t.c] = { kind: 'special', special: sp };
    s.bonusQueue.push(idx(s, t.r, t.c));
  }
  // сортировка по диагонали сверху-вниз/слева-направо
  s.bonusQueue.sort((a, b) => Math.floor(a / s.cols) + (a % s.cols) - (Math.floor(b / s.cols) + (b % s.cols)));
  s.phase = 'playing';
  if (s.bonusQueue.length === 0) {
    winNow(s, hooks);
    return;
  }
  bonusStep(s, hooks);
}
function bonusStep(s: Match3State, hooks: Match3Hooks): void {
  const i = s.bonusQueue.shift();
  if (i == null) {
    // добить возможные каскады, потом победа
    if (findGroups(s).length > 0) {
      nextBeat(s, hooks);
      return;
    }
    winNow(s, hooks);
    return;
  }
  const r = Math.floor(i / s.cols);
  const c = i % s.cols;
  const cell = s.grid[r][c];
  if (cell?.kind !== 'special') {
    bonusStep(s, hooks);
    return;
  }
  s.grid[r][c] = null;
  const g = gather(s, specialEffect(s, r, c, cell.special));
  beginClear(s, g, [], hooks);
  s.anim = 'bonus';
}
function winNow(s: Match3State, hooks: Match3Hooks): void {
  if (!s.starEarned) {
    s.bonus = s.rublesEarned; // фарм за забег (каскады+бонус) — уже в кошельке живьём
    hooks.addRubles(LEVEL_REWARD);
    hooks.addStar();
    s.starEarned = true;
  }
  s.phase = 'won';
  s.anim = 'idle';
  hooks.sfx('rank-up');
}

function goalMet(s: Match3State): boolean {
  return s.goalProgress >= s.goalTarget;
}

// ─── Свап/ход ───
function beginSwap(s: Match3State, a: RC, b: RC, hooks: Match3Hooks): void {
  const ca = s.grid[a.r][a.c];
  const cb = s.grid[b.r][b.c];
  if (!ca || !cb || ca.kind === 'wood' || cb.kind === 'wood') return;
  s.grid[a.r][a.c] = cb;
  s.grid[b.r][b.c] = ca;
  const aNow = s.grid[a.r][a.c];
  const bNow = s.grid[b.r][b.c];
  s.swapA = a;
  s.swapB = b;
  s.animT = 0;
  s.animDur = SWAP_MS;

  if (aNow?.kind === 'special' && bNow?.kind === 'special') {
    s.pendingSeed = comboCells(s, aNow.special, bNow.special, b.r, b.c);
    s.grid[a.r][a.c] = null;
    s.grid[b.r][b.c] = null;
    s.playerMove = true;
    s.anim = 'swap';
    hooks.sfx('powerup');
    return;
  }
  if (aNow?.kind === 'special' || bNow?.kind === 'special') {
    const sp = aNow?.kind === 'special' ? aNow : (bNow as { kind: 'special'; special: SpecialKind });
    const at = aNow?.kind === 'special' ? a : b;
    const neighbor = aNow?.kind === 'special' ? colorOf(bNow) : colorOf(aNow);
    s.pendingSeed = specialEffect(s, at.r, at.c, sp.special, neighbor ?? undefined);
    s.grid[at.r][at.c] = null;
    s.playerMove = true;
    s.anim = 'swap';
    hooks.sfx('powerup');
    return;
  }
  if (findGroups(s).length === 0) {
    // невалидно → откат сразу, рендер анимирует «отскок» по swapA/swapB.
    s.grid[a.r][a.c] = ca;
    s.grid[b.r][b.c] = cb;
    s.anim = 'swapback';
    hooks.sfx('tick');
    return;
  }
  s.playerMove = true;
  s.anim = 'swap';
  hooks.sfx('bounce');
}
function activateSpecialInPlace(s: Match3State, cell: RC, hooks: Match3Hooks): void {
  const c = s.grid[cell.r][cell.c];
  if (c?.kind !== 'special') return;
  s.pendingSeed = specialEffect(s, cell.r, cell.c, c.special);
  s.grid[cell.r][cell.c] = null;
  s.playerMove = true;
  s.swapA = s.swapB = null;
  s.anim = 'swap';
  s.animT = 0;
  s.animDur = SWAP_MS / 2;
  hooks.sfx('powerup');
}
function applyTool(s: Match3State, tool: ToolKind, cell: RC | null, hooks: Match3Hooks): boolean {
  if (!hooks.spendTool(tool)) {
    hooks.sfx('tick');
    return false;
  }
  if (tool === 'vodka') {
    reshuffle(s);
    hooks.sfx('reel');
    return true;
  }
  if (!cell) return false;
  let seed: number[] = [];
  if (tool === 'tool') seed = [idx(s, cell.r, cell.c)];
  else if (tool === 'pestik-horizontal') for (let c = 0; c < s.cols; c++) seed.push(idx(s, cell.r, c));
  else for (let r = 0; r < s.rows; r++) seed.push(idx(s, r, cell.c));
  s.pendingSeed = seed;
  s.playerMove = false; // инструменты не тратят ход
  s.anim = 'swap';
  s.swapA = s.swapB = null;
  s.animT = 0;
  s.animDur = SWAP_MS / 2;
  hooks.sfx('confirm');
  return true;
}

// ─── Кадр ───
export function updateFrame(s: Match3State, input: ArcadeInput, dtMs: number, hooks: Match3Hooks): void {
  s.nowMs += dtMs;
  s.clearFx = s.clearFx.filter((f) => f.until > s.nowMs);

  // Прогон анимации.
  if (s.anim !== 'idle') {
    s.animT += dtMs;
    if (s.animT >= s.animDur) {
      const ph = s.anim;
      if (ph === 'swap') {
        s.swapA = s.swapB = null;
        nextBeat(s, hooks);
      } else if (ph === 'swapback') {
        // грид уже откатан в beginSwap — просто завершаем анимацию.
        s.swapA = s.swapB = null;
        s.anim = 'idle';
      } else if (ph === 'clear' || ph === 'bonus') {
        onClearDone(s, hooks);
      } else if (ph === 'fall') {
        onFallDone(s, hooks);
      }
    }
  }

  const p = input.pointer;
  const down = !!p?.down;
  const pressed = down && !s.prevDown;
  const released = !down && s.prevDown;
  s.prevDown = down;

  if (s.phase === 'brief') {
    if (pressed) s.phase = 'playing';
    return;
  }
  if (s.phase === 'won') {
    if (pressed) {
      const next = (s.levelIndex + 1) % LEVEL_COUNT;
      Object.assign(s, createLevelState(next));
      s.phase = 'brief';
    }
    return;
  }
  if (s.phase === 'nomoves') {
    if (pressed) handleNomovesTap(s, p.x, p.y, hooks);
    return;
  }
  if (s.phase !== 'playing') return;

  // Ввод заблокирован во время анимации.
  if (s.anim !== 'idle') {
    if (pressed || released) s.idleMs = 0;
    return;
  }

  // Подсказка по бездействию (работает и без указателя на экране).
  s.idleMs += dtMs;
  if (s.idleMs >= HINT_IDLE_MS && !s.hint) s.hint = findHint(s);

  if (!p) return; // без указателя ввода нет, но idle/подсказка уже отработали

  if (pressed) {
    s.idleMs = 0;
    s.hint = null;
    const ti = toolIndexAt(s.lay, p.x, p.y);
    if (ti >= 0) {
      const tool = TOOLS[ti];
      if (tool === 'vodka') applyTool(s, 'vodka', null, hooks);
      else s.activeTool = s.activeTool === tool ? null : tool;
      s.downCell = null;
      return;
    }
    const hit = cellAt(s.lay, s.rows, s.cols, p.x, p.y);
    if (hit && isHole(s, hit.r, hit.c)) {
      s.downCell = null;
      return;
    }
    if (hit && s.activeTool) {
      applyTool(s, s.activeTool, hit, hooks);
      s.activeTool = null;
      s.downCell = null;
      return;
    }
    s.downCell = hit;
  }

  if (released && s.downCell) {
    s.idleMs = 0;
    const up = cellAt(s.lay, s.rows, s.cols, p.x, p.y);
    const from = s.downCell;
    s.downCell = null;
    if (up && !isHole(s, up.r, up.c) && adjacent(from, up)) {
      beginSwap(s, from, up, hooks);
      s.selected = null;
    } else if (up && from.r === up.r && from.c === up.c) {
      // тап по клетке: спец-фишка активируется на месте, иначе выбор/своп
      if (s.grid[from.r][from.c]?.kind === 'special') {
        activateSpecialInPlace(s, from, hooks);
        s.selected = null;
      } else if (s.selected && adjacent(s.selected, from)) {
        beginSwap(s, s.selected, from, hooks);
        s.selected = null;
      } else {
        s.selected = from;
      }
    } else {
      s.selected = from;
    }
  }
}

function handleNomovesTap(s: Match3State, x: number, y: number, hooks: Match3Hooks): void {
  const cx = 320;
  const w = 220;
  const h = 40;
  const inRect = (ry: number) => x >= cx - w / 2 && x <= cx + w / 2 && y >= ry && y <= ry + h;
  if (inRect(250)) {
    const price = CONTINUE_PRICES[Math.min(s.continuePurchases, CONTINUE_PRICES.length - 1)];
    if (hooks.spendWallet(price)) {
      s.continuePurchases++;
      s.moves += CONTINUE_MOVES;
      s.phase = 'playing';
      hooks.sfx('coins');
    } else hooks.sfx('tick');
  } else if (inRect(300)) {
    hooks.spendEnergy();
    hooks.sfx('burst');
    Object.assign(s, createLevelState(s.levelIndex));
    s.phase = 'brief';
  }
}
