// Движок game02 «Три в ряд». Логика мгновенная (каскад резолвится синхронно), визуал —
// лёгкие вспышки. Спека просит балансить детали позже; тут — рабочий MVP §1–7.

import type { ArcadeInput } from '../../types';
import type { SfxName } from '@/lib/sfx';
import { COLORS, type ChipColor, type SpecialKind, type ToolKind, SCORE_PER_CHIP, levelByIndex } from './config';
import { computeLayout, cellAt, toolIndexAt, type Layout } from './layout';
import { TOOLS } from './config';

export type Cell =
  | { kind: 'color'; color: ChipColor }
  | { kind: 'special'; special: SpecialKind }
  | { kind: 'wood' }
  | null;

export type Phase = 'loading' | 'brief' | 'playing' | 'won' | 'nomoves';

export interface ClearFx {
  r: number;
  c: number;
  until: number;
}

export interface Match3Hooks {
  sfx: (n: SfxName) => void;
  addRubles: (n: number) => void;
  getWallet: () => number;
  spendWallet: (n: number) => boolean;
  spendEnergy: () => void;
}

export interface Match3State {
  phase: Phase;
  levelIndex: number;
  rows: number;
  cols: number;
  grid: Cell[][];
  moves: number;
  goalType: 'rubles' | 'wood';
  goalTarget: number;
  rublesEarned: number;
  woodTotal: number;
  woodBroken: number;
  activeTool: ToolKind | null;
  selected: { r: number; c: number } | null;
  downCell: { r: number; c: number } | null;
  prevDown: boolean;
  nowMs: number;
  continuePurchases: number;
  clearFx: ClearFx[];
  lay: Layout;
  bonus: number;
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
function colorCell(): Cell {
  return { kind: 'color', color: randColor() };
}
function colorOf(cell: Cell): ChipColor | null {
  return cell && cell.kind === 'color' ? cell.color : null;
}

function buildGrid(rows: number, cols: number, woodRows: readonly number[]): Cell[][] {
  const grid: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < cols; c++) {
      if (woodRows.includes(r)) {
        row.push({ kind: 'wood' });
        continue;
      }
      // Цвет, не образующий сразу тройку с двумя слева/сверху.
      let color: ChipColor;
      let tries = 0;
      do {
        color = randColor();
        tries++;
      } while (
        tries < 20 &&
        ((c >= 2 && colorOf(row[c - 1]) === color && colorOf(row[c - 2]) === color) ||
          (r >= 2 && colorOf(grid[r - 1][c]) === color && colorOf(grid[r - 2][c]) === color))
      );
      row.push({ kind: 'color', color });
    }
    grid.push(row);
  }
  return grid;
}

export function createLevelState(levelIndex: number): Match3State {
  const lvl = levelByIndex(levelIndex);
  const woodTotal = lvl.woodRows.length * lvl.cols;
  return {
    phase: 'loading',
    levelIndex,
    rows: lvl.rows,
    cols: lvl.cols,
    grid: buildGrid(lvl.rows, lvl.cols, lvl.woodRows),
    moves: lvl.moves,
    goalType: lvl.goal.type,
    goalTarget: lvl.goal.target,
    rublesEarned: 0,
    woodTotal,
    woodBroken: 0,
    activeTool: null,
    selected: null,
    downCell: null,
    prevDown: false,
    nowMs: 0,
    continuePurchases: 0,
    clearFx: [],
    lay: computeLayout(lvl.rows, lvl.cols),
    bonus: 0,
  };
}

// ─── Поиск матчей + классификация ───
interface Group {
  cells: { r: number; c: number }[];
  color: ChipColor;
  maxH: number;
  maxV: number;
  is2x2: boolean;
}

function findGroups(s: Match3State): Group[] {
  const { rows, cols, grid } = s;
  const matched: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));

  // Горизонтальные раны.
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
  // Вертикальные раны.
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
  // 2×2 квадраты.
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const col = colorOf(grid[r][c]);
      if (col && colorOf(grid[r][c + 1]) === col && colorOf(grid[r + 1][c]) === col && colorOf(grid[r + 1][c + 1]) === col) {
        matched[r][c] = matched[r][c + 1] = matched[r + 1][c] = matched[r + 1][c + 1] = true;
      }
    }
  }

  // Связные компоненты одного цвета.
  const visited: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  const groups: Group[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!matched[r][c] || visited[r][c]) continue;
      const color = colorOf(grid[r][c]);
      if (!color) continue;
      const cells: { r: number; c: number }[] = [];
      const stack = [{ r, c }];
      visited[r][c] = true;
      while (stack.length) {
        const cur = stack.pop()!;
        cells.push(cur);
        for (const [dr, dc] of DIRS) {
          const nr = cur.r + dr;
          const nc = cur.c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (matched[nr][nc] && !visited[nr][nc] && colorOf(grid[nr][nc]) === color) {
            visited[nr][nc] = true;
            stack.push({ r: nr, c: nc });
          }
        }
      }
      // Метрики группы.
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
      const rsSpan = Math.max(...cells.map((p) => p.r)) - Math.min(...cells.map((p) => p.r));
      const csSpan = Math.max(...cells.map((p) => p.c)) - Math.min(...cells.map((p) => p.c));
      const is2x2 = cells.length === 4 && rsSpan === 1 && csSpan === 1 && maxH < 3 && maxV < 3;
      groups.push({ cells, color, maxH, maxV, is2x2 });
    }
  }
  return groups;
}

function classify(g: Group): SpecialKind | null {
  const maxRun = Math.max(g.maxH, g.maxV);
  if (maxRun >= 5) return 'kerman';
  if (g.maxH >= 3 && g.maxV >= 3) return 'zaryad';
  if (g.is2x2) return 'rgo';
  if (maxRun === 4) return g.maxH === 4 ? 'rshg-horizontal' : 'rshg-vertical';
  return null;
}

function placement(g: Group, hint: { r: number; c: number }[] | null): { r: number; c: number } {
  if (hint) {
    for (const h of hint) if (g.cells.some((p) => p.r === h.r && p.c === h.c)) return h;
  }
  // Клетка с макс. числом соседей в группе (перекрестье для L/T).
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

// ─── Эффекты спец-фишек → множество индексов ───
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

function idx(s: Match3State, r: number, c: number): number {
  return r * s.cols + c;
}
function inb(s: Match3State, r: number, c: number): boolean {
  return r >= 0 && r < s.rows && c >= 0 && c < s.cols;
}

function specialEffect(s: Match3State, r: number, c: number, special: SpecialKind, color?: ChipColor): number[] {
  const out: number[] = [];
  if (special === 'rshg-horizontal') {
    for (let cc = 0; cc < s.cols; cc++) out.push(idx(s, r, cc));
  } else if (special === 'rshg-vertical') {
    for (let rr = 0; rr < s.rows; rr++) out.push(idx(s, rr, c));
  } else if (special === 'zaryad') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (inb(s, r + dr, c + dc)) out.push(idx(s, r + dr, c + dc));
  } else if (special === 'rgo') {
    out.push(idx(s, r, c));
    for (const [dr, dc] of DIRS) if (inb(s, r + dr, c + dc)) out.push(idx(s, r + dr, c + dc));
  } else if (special === 'kerman') {
    const target = color ?? mostCommonColor(s);
    for (let rr = 0; rr < s.rows; rr++) for (let cc = 0; cc < s.cols; cc++) if (colorOf(s.grid[rr][cc]) === target) out.push(idx(s, rr, cc));
  }
  return out;
}

// ─── Очистка с цепочкой спец-фишек и разрушением wood ───
function clearCells(s: Match3State, initial: number[], hooks: Match3Hooks): void {
  const queue = [...initial];
  const done = new Set<number>();
  while (queue.length) {
    const i = queue.pop()!;
    if (done.has(i)) continue;
    done.add(i);
    const r = Math.floor(i / s.cols);
    const c = i % s.cols;
    const cell = s.grid[r][c];
    if (!cell) continue;
    if (cell.kind === 'wood') {
      s.grid[r][c] = null;
      s.woodBroken++;
      s.clearFx.push({ r, c, until: s.nowMs + 200 });
      continue;
    }
    if (cell.kind === 'special') {
      s.grid[r][c] = null;
      s.clearFx.push({ r, c, until: s.nowMs + 200 });
      for (const t of specialEffect(s, r, c, cell.special)) queue.push(t);
      continue;
    }
    // Обычная фишка.
    s.grid[r][c] = null;
    s.rublesEarned += SCORE_PER_CHIP;
    hooks.addRubles(SCORE_PER_CHIP);
    s.clearFx.push({ r, c, until: s.nowMs + 200 });
    for (const [dr, dc] of DIRS) if (inb(s, r + dr, c + dc) && s.grid[r + dr][c + dc]?.kind === 'wood') queue.push(idx(s, r + dr, c + dc));
  }
}

// ─── Гравитация + рефилл (wood — барьеры) ───
function applyGravity(s: Match3State): void {
  for (let c = 0; c < s.cols; c++) {
    let segTop = 0;
    for (let r = 0; r <= s.rows; r++) {
      const isWood = r < s.rows && s.grid[r][c]?.kind === 'wood';
      if (r === s.rows || isWood) {
        compactSegment(s, c, segTop, r - 1, segTop === 0);
        segTop = r + 1;
      }
    }
  }
}
function compactSegment(s: Match3State, c: number, top: number, bot: number, refill: boolean): void {
  if (bot < top) return;
  const items: Cell[] = [];
  for (let r = top; r <= bot; r++) {
    if (s.grid[r][c] != null) {
      items.push(s.grid[r][c]);
      s.grid[r][c] = null;
    }
  }
  let r = bot;
  for (let i = items.length - 1; i >= 0; i--) {
    s.grid[r][c] = items[i];
    r--;
  }
  if (refill) while (r >= top) {
    s.grid[r][c] = colorCell();
    r--;
  }
}

// ─── Резолв каскада ───
function resolve(s: Match3State, hooks: Match3Hooks, hint: { r: number; c: number }[] | null): void {
  let first = true;
  let guard = 0;
  while (guard++ < 40) {
    const groups = findGroups(s);
    if (groups.length === 0) break;
    const toClear = new Set<number>();
    const place: { i: number; special: SpecialKind }[] = [];
    for (const g of groups) {
      const sp = classify(g);
      if (sp) {
        const pos = placement(g, first ? hint : null);
        const pi = idx(s, pos.r, pos.c);
        place.push({ i: pi, special: sp });
        for (const p of g.cells) {
          const ci = idx(s, p.r, p.c);
          if (ci !== pi) toClear.add(ci);
        }
      } else {
        for (const p of g.cells) toClear.add(idx(s, p.r, p.c));
      }
    }
    clearCells(s, [...toClear], hooks);
    for (const pl of place) {
      const r = Math.floor(pl.i / s.cols);
      const c = pl.i % s.cols;
      s.grid[r][c] = { kind: 'special', special: pl.special };
    }
    applyGravity(s);
    first = false;
    hooks.sfx('coins');
  }
}

// ─── Дедлок ───
function hasValidMove(s: Match3State): boolean {
  for (const row of s.grid) for (const cell of row) if (cell?.kind === 'special') return true;
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inb(s, nr, nc)) continue;
        if (s.grid[r][c]?.kind !== 'color' || s.grid[nr][nc]?.kind !== 'color') continue;
        const tmp = s.grid[r][c];
        s.grid[r][c] = s.grid[nr][nc];
        s.grid[nr][nc] = tmp;
        const ok = findGroups(s).length > 0;
        s.grid[nr][nc] = s.grid[r][c];
        s.grid[r][c] = tmp;
        if (ok) return true;
      }
    }
  }
  return false;
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
  } while (!hasValidMove(s) && guard++ < 30);
}

function adjacent(a: { r: number; c: number }, b: { r: number; c: number }): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

// ─── Свап ───
function comboCells(s: Match3State, ak: SpecialKind, bk: SpecialKind, r: number, c: number): number[] {
  const set = new Set<number>();
  const add = (arr: number[]) => arr.forEach((i) => set.add(i));
  const kinds = [ak, bk];
  const has = (k: SpecialKind) => kinds.includes(k);
  if (has('kerman')) {
    // kerman + X: убрать весь топ-цвет + взрыв 5×5 (упрощённо).
    add(specialEffect(s, r, c, 'kerman'));
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (inb(s, r + dr, c + dc)) set.add(idx(s, r + dr, c + dc));
    return [...set];
  }
  if (has('zaryad') && has('rgo')) {
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (inb(s, r + dr, c + dc)) set.add(idx(s, r + dr, c + dc));
    return [...set];
  }
  if (has('rshg-horizontal') || has('rshg-vertical')) {
    if (has('zaryad')) {
      for (let dr = -1; dr <= 1; dr++) for (let cc = 0; cc < s.cols; cc++) if (inb(s, r + dr, cc)) set.add(idx(s, r + dr, cc));
      for (let dc = -1; dc <= 1; dc++) for (let rr = 0; rr < s.rows; rr++) if (inb(s, rr, c + dc)) set.add(idx(s, rr, c + dc));
      return [...set];
    }
    if (has('rgo')) {
      for (let n = 0; n < 5; n++) {
        const rr = Math.floor(Math.random() * s.rows);
        const cc = Math.floor(Math.random() * s.cols);
        add(specialEffect(s, rr, cc, 'rgo'));
      }
      return [...set];
    }
    // rshg + rshg → крест.
    add(specialEffect(s, r, c, 'rshg-horizontal'));
    add(specialEffect(s, r, c, 'rshg-vertical'));
    return [...set];
  }
  add(specialEffect(s, r, c, ak));
  add(specialEffect(s, r, c, bk));
  return [...set];
}

function attemptSwap(s: Match3State, a: { r: number; c: number }, b: { r: number; c: number }, hooks: Match3Hooks): boolean {
  const ca = s.grid[a.r][a.c];
  const cb = s.grid[b.r][b.c];
  if (!ca || !cb || ca.kind === 'wood' || cb.kind === 'wood') return false;

  // Свап позиций.
  s.grid[a.r][a.c] = cb;
  s.grid[b.r][b.c] = ca;

  const aNow = s.grid[a.r][a.c];
  const bNow = s.grid[b.r][b.c];

  if (aNow?.kind === 'special' && bNow?.kind === 'special') {
    const cells = comboCells(s, aNow.special, bNow.special, b.r, b.c);
    s.grid[a.r][a.c] = null;
    s.grid[b.r][b.c] = null;
    clearCells(s, cells, hooks);
    applyGravity(s);
    resolve(s, hooks, null);
    hooks.sfx('powerup');
    return true;
  }
  if (aNow?.kind === 'special' || bNow?.kind === 'special') {
    const sp = aNow?.kind === 'special' ? aNow : (bNow as { kind: 'special'; special: SpecialKind });
    const at = aNow?.kind === 'special' ? a : b;
    const colorNeighbor = aNow?.kind === 'special' ? colorOf(bNow) : colorOf(aNow);
    const cells = specialEffect(s, at.r, at.c, sp.special, colorNeighbor ?? undefined);
    s.grid[at.r][at.c] = null;
    clearCells(s, cells, hooks);
    applyGravity(s);
    resolve(s, hooks, null);
    hooks.sfx('powerup');
    return true;
  }

  // Обе цветные — нужен матч.
  if (findGroups(s).length === 0) {
    // Откат.
    s.grid[a.r][a.c] = ca;
    s.grid[b.r][b.c] = cb;
    hooks.sfx('tick');
    return false;
  }
  resolve(s, hooks, [a, b]);
  hooks.sfx('bounce');
  return true;
}

function applyTool(s: Match3State, tool: ToolKind, cell: { r: number; c: number } | null, hooks: Match3Hooks): boolean {
  if (tool === 'vodka') {
    reshuffle(s);
    hooks.sfx('reel');
    return true;
  }
  if (!cell) return false;
  if (tool === 'tool') clearCells(s, [idx(s, cell.r, cell.c)], hooks);
  else if (tool === 'pestik-horizontal') {
    const arr: number[] = [];
    for (let c = 0; c < s.cols; c++) arr.push(idx(s, cell.r, c));
    clearCells(s, arr, hooks);
  } else {
    const arr: number[] = [];
    for (let r = 0; r < s.rows; r++) arr.push(idx(s, r, cell.c));
    clearCells(s, arr, hooks);
  }
  applyGravity(s);
  resolve(s, hooks, null);
  hooks.sfx('confirm');
  return true;
}

function goalMet(s: Match3State): boolean {
  return s.goalType === 'rubles' ? s.rublesEarned >= s.goalTarget : s.woodBroken >= s.woodTotal;
}

function afterAction(s: Match3State, hooks: Match3Hooks, spentMove: boolean): void {
  if (spentMove) s.moves = Math.max(0, s.moves - 1);
  if (goalMet(s)) {
    s.bonus = s.moves * 3;
    if (s.bonus > 0) hooks.addRubles(s.bonus);
    s.phase = 'won';
    hooks.sfx('rank-up');
    return;
  }
  if (s.moves <= 0) {
    s.phase = 'nomoves';
    hooks.sfx('thud');
    return;
  }
  if (!hasValidMove(s)) reshuffle(s);
}

// ─── Ввод + фазы ───
export function updateFrame(s: Match3State, input: ArcadeInput, dtMs: number, hooks: Match3Hooks): void {
  s.nowMs += dtMs;
  s.clearFx = s.clearFx.filter((f) => f.until > s.nowMs);

  const p = input.pointer;
  const down = !!p?.down;
  const pressed = down && !s.prevDown;
  const released = !down && s.prevDown;
  s.prevDown = down;
  if (!p) return;

  if (s.phase === 'brief') {
    if (pressed) s.phase = 'playing';
    return;
  }
  if (s.phase === 'won') {
    if (pressed) {
      const next = (s.levelIndex + 1) % 2;
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

  // Панель инструментов.
  if (pressed) {
    const ti = toolIndexAt(s.lay, p.x, p.y);
    if (ti >= 0) {
      const tool = TOOLS[ti];
      if (tool === 'vodka') {
        applyTool(s, 'vodka', null, hooks);
        afterAction(s, hooks, false);
      } else {
        s.activeTool = s.activeTool === tool ? null : tool;
      }
      s.downCell = null;
      return;
    }
    const hit = cellAt(s.lay, s.rows, s.cols, p.x, p.y);
    if (hit && s.activeTool) {
      applyTool(s, s.activeTool, hit, hooks);
      s.activeTool = null;
      afterAction(s, hooks, false);
      s.downCell = null;
      return;
    }
    s.downCell = hit;
  }

  if (released && s.downCell) {
    const up = cellAt(s.lay, s.rows, s.cols, p.x, p.y);
    const from = s.downCell;
    s.downCell = null;
    if (up && adjacent(from, up)) {
      if (attemptSwap(s, from, up, hooks)) afterAction(s, hooks, true);
      s.selected = null;
    } else {
      // Тап-выбор.
      if (s.selected && adjacent(s.selected, from)) {
        if (attemptSwap(s, s.selected, from, hooks)) afterAction(s, hooks, true);
        s.selected = null;
      } else {
        s.selected = from;
      }
    }
  }
}

function handleNomovesTap(s: Match3State, x: number, y: number, hooks: Match3Hooks): void {
  const cx = 320;
  const buyY = 250;
  const surY = 300;
  const w = 220;
  const h = 40;
  const inRect = (ry: number) => x >= cx - w / 2 && x <= cx + w / 2 && y >= ry && y <= ry + h;
  if (inRect(buyY)) {
    const price = [100, 200, 400][Math.min(s.continuePurchases, 2)];
    if (hooks.spendWallet(price)) {
      s.continuePurchases++;
      s.moves += 5;
      s.phase = 'playing';
      hooks.sfx('coins');
    } else {
      hooks.sfx('tick');
    }
  } else if (inRect(surY)) {
    hooks.spendEnergy();
    hooks.sfx('burst');
    Object.assign(s, createLevelState(s.levelIndex));
    s.phase = 'brief';
  }
}
