// Рисование game02 «Три в ряд» v0.3 — с твинами (swap/fall/clear), препятствиями, дырами,
// подсказкой-дыханием, HUD ₽/⚡/⭐, бейджами инструментов. Цвета — литералы NIGHTFALL.

import { ARCADE_W, ARCADE_H } from '../../types';
import type { SpriteCache } from '../../sprites';
import type { Cell, Match3State } from './state';
import { itemSrc, TOOLS, TOOL_LABEL, ENERGY_MAX, CONTINUE_PRICES, LEVEL_REWARD, levelByIndex, type ToolKind } from './config';
import { toolRects } from './layout';

const AMBER = '#E68E25';
const TEXT = '#F2F2F2';
const MUTED = '#9AA0AE';
const DANGER = '#C24339';
const GREEN = '#8DE736';
const GOLD = '#EBC33A';
const PANEL = '#242426';
const LINE = '#313135';

export interface Match3DrawOpts {
  wallet: number;
  energy: number;
  stars: number;
  toolCounts: Record<ToolKind, number>;
  reducedMotion: boolean;
}

function font(ctx: CanvasRenderingContext2D, px: number): void {
  ctx.font = `${px}px "BlenderPro-Medium", sans-serif`;
}
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;

function cellSpriteName(cell: Cell): string | null {
  if (!cell) return null;
  if (cell.kind === 'color') return cell.color;
  if (cell.kind === 'special') return cell.special;
  return cell.hp > 1 ? 'wood2' : 'wood';
}

function drawSprite(ctx: CanvasRenderingContext2D, sprites: SpriteCache, name: string, x: number, y: number, size: number, scale = 1, alpha = 1): void {
  const img = sprites.get(itemSrc(name));
  const s = size * scale;
  const off = (size - s) / 2;
  ctx.globalAlpha = alpha;
  if (img) ctx.drawImage(img, x + off + size * 0.05, y + off + size * 0.05, s - size * 0.1, s - size * 0.1);
  else {
    ctx.fillStyle = LINE;
    ctx.fillRect(x + off + 3, y + off + 3, s - 6, s - 6);
  }
  ctx.globalAlpha = 1;
}

function drawBoard(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: Match3State, opts: Match3DrawOpts): void {
  const { lay, grid, rows, cols } = s;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(lay.ox - 4, lay.oy - 4, lay.boardW + 8, lay.boardH + 8);

  const clearing = new Set(s.clearing);
  const clearK = s.anim === 'clear' || s.anim === 'bonus' ? s.animT / Math.max(1, s.animDur) : 0;
  const fallK = s.anim === 'fall' ? easeIn(s.animT / Math.max(1, s.animDur)) : 1;
  const swapK = s.anim === 'swap' || s.anim === 'swapback' ? easeOut(s.animT / Math.max(1, s.animDur)) : 1;
  const breathe = 1 + 0.05 * Math.sin(s.nowMs / 260);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = lay.ox + c * lay.cell;
      const y = lay.oy + r * lay.cell;
      if (s.holes[r][c]) continue; // дыра — пусто
      // Клетка-подложка.
      ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, y, lay.cell, lay.cell);
      // Листва ПОД фишкой.
      if (s.leaves[r][c]) drawSprite(ctx, sprites, 'leaves', x, y, lay.cell, 1, 0.9);

      const cell = grid[r][c];
      const name = cellSpriteName(cell);
      if (!name) continue;

      // Твины позиции.
      let dx = 0;
      let dy = 0;
      let scale = 1;
      let alpha = 1;
      const i = r * cols + c;
      if ((s.anim === 'swap' || s.anim === 'swapback') && s.swapA && s.swapB) {
        if (s.swapA.r === r && s.swapA.c === c) {
          dx = (s.swapB.c - s.swapA.c) * lay.cell * (1 - swapK);
          dy = (s.swapB.r - s.swapA.r) * lay.cell * (1 - swapK);
        } else if (s.swapB.r === r && s.swapB.c === c) {
          dx = (s.swapA.c - s.swapB.c) * lay.cell * (1 - swapK);
          dy = (s.swapA.r - s.swapB.r) * lay.cell * (1 - swapK);
        }
      }
      if (s.anim === 'fall' && s.fallOffset && s.fallOffset[r][c] > 0) {
        dy -= (1 - fallK) * s.fallOffset[r][c] * lay.cell;
      }
      if ((s.anim === 'clear' || s.anim === 'bonus') && clearing.has(i)) {
        scale = 1 - clearK * 0.8;
        alpha = 1 - clearK;
      }
      // Подсказка-дыхание.
      if (s.hint && !opts.reducedMotion && s.anim === 'idle') {
        for (const h of s.hint) if (h.r === r && h.c === c) scale *= breathe;
      }
      drawSprite(ctx, sprites, name, x + dx, y + dy, lay.cell, scale, alpha);
    }
  }

  // Выбранная клетка.
  if (s.selected && !s.holes[s.selected.r][s.selected.c]) {
    const x = lay.ox + s.selected.c * lay.cell;
    const y = lay.oy + s.selected.r * lay.cell;
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, lay.cell - 3, lay.cell - 3);
  }

  // Вспышки.
  for (const f of s.clearFx) {
    const k = Math.max(0, Math.min(1, (f.until - s.nowMs) / 220));
    ctx.fillStyle = `rgba(255,255,255,${0.5 * k})`;
    ctx.fillRect(lay.ox + f.c * lay.cell, lay.oy + f.r * lay.cell, lay.cell, lay.cell);
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: Match3State, opts: Match3DrawOpts): void {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  font(ctx, 12);
  ctx.fillStyle = MUTED;
  const goalLabel = s.goalType === 'leaves' ? 'ЛИСТВА' : s.goalType === 'wood2' ? 'ЯЩИКИ 2HP' : 'ЯЩИКИ';
  ctx.fillText('ЦЕЛЬ', 12, 18);
  font(ctx, 17);
  ctx.fillStyle = TEXT;
  ctx.fillText(`${goalLabel} ${s.goalProgress}/${s.goalTarget}`, 12, 40);

  ctx.textAlign = 'center';
  font(ctx, 12);
  ctx.fillStyle = MUTED;
  ctx.fillText('ХОДЫ', ARCADE_W / 2, 18);
  font(ctx, 22);
  ctx.fillStyle = s.moves <= 5 ? DANGER : AMBER;
  ctx.fillText(String(s.moves), ARCADE_W / 2, 42);

  ctx.textAlign = 'right';
  font(ctx, 16);
  ctx.fillStyle = AMBER;
  ctx.fillText(`${opts.wallet} ₽`, ARCADE_W - 12, 20);
  font(ctx, 13);
  ctx.fillStyle = GREEN;
  ctx.fillText(`⚡ ${opts.energy}/${ENERGY_MAX}    ⭐ ${opts.stars}`, ARCADE_W - 12, 40);
}

function drawTools(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: Match3State, opts: Match3DrawOpts): void {
  const rects = toolRects(s.lay);
  rects.forEach((rc, i) => {
    const tool = TOOLS[i];
    const count = opts.toolCounts[tool] ?? 0;
    const active = s.activeTool === tool;
    ctx.globalAlpha = count > 0 ? 1 : 0.5;
    ctx.fillStyle = PANEL;
    ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
    ctx.strokeStyle = active ? AMBER : LINE;
    ctx.lineWidth = active ? 2.5 : 1;
    ctx.strokeRect(rc.x + 0.5, rc.y + 0.5, rc.w - 1, rc.h - 1);
    const sz = rc.h - 8;
    drawSprite(ctx, sprites, tool, rc.x + (rc.w - sz) / 2, rc.y + 2, sz);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    font(ctx, 9);
    ctx.fillStyle = active ? AMBER : MUTED;
    ctx.fillText(TOOL_LABEL[tool], rc.x + rc.w / 2, rc.y + rc.h - 3);
    // Бейдж-счётчик.
    ctx.fillStyle = count > 0 ? AMBER : LINE;
    ctx.beginPath();
    ctx.arc(rc.x + rc.w - 9, rc.y + 9, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = count > 0 ? '#141416' : MUTED;
    font(ctx, 11);
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), rc.x + rc.w - 9, rc.y + 10);
    ctx.textBaseline = 'alphabetic';
  });
}

function overlayBg(ctx: CanvasRenderingContext2D, a: number): void {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
}
function centerText(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, color: string): void {
  ctx.textAlign = 'center';
  font(ctx, size);
  ctx.fillStyle = color;
  ctx.fillText(text, ARCADE_W / 2, y);
}

export function draw(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: Match3State, opts: Match3DrawOpts, ready: boolean): void {
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);

  if (!ready || s.phase === 'loading') {
    centerText(ctx, 'ЗАГРУЗКА…', ARCADE_H / 2, 18, MUTED);
    return;
  }

  drawBoard(ctx, sprites, s, opts);
  drawHud(ctx, s, opts);
  drawTools(ctx, sprites, s, opts);

  if (s.phase === 'brief') {
    overlayBg(ctx, 0.74);
    const lvl = levelByIndex(s.levelIndex);
    centerText(ctx, `УРОВЕНЬ ${lvl.id}`, ARCADE_H / 2 - 52, 30, AMBER);
    centerText(ctx, lvl.brief, ARCADE_H / 2 - 14, 14, TEXT);
    centerText(ctx, `Цель ${s.goalTarget} · Ходов ${s.moves}`, ARCADE_H / 2 + 10, 14, MUTED);
    centerText(ctx, 'ТАП — ИГРАТЬ', ARCADE_H / 2 + 48, 16, AMBER);
  }

  if (s.phase === 'won') {
    overlayBg(ctx, 0.74);
    centerText(ctx, 'ЗАКАЗ ВЫПОЛНЕН', ARCADE_H / 2 - 50, 30, GREEN);
    centerText(ctx, `+${LEVEL_REWARD} ₽ · фарм ${s.bonus} ₽ · +1 ⭐`, ARCADE_H / 2 - 12, 16, AMBER);
    centerText(ctx, 'ТАП — СЛЕДУЮЩИЙ УРОВЕНЬ', ARCADE_H / 2 + 40, 15, TEXT);
  }

  if (s.phase === 'nomoves') {
    overlayBg(ctx, 0.78);
    centerText(ctx, 'ХОДЫ КОНЧИЛИСЬ', ARCADE_H / 2 - 60, 26, DANGER);
    const price = CONTINUE_PRICES[Math.min(s.continuePurchases, CONTINUE_PRICES.length - 1)];
    ctx.fillStyle = opts.wallet >= price ? AMBER : LINE;
    ctx.fillRect(320 - 110, 250, 220, 40);
    centerText(ctx, `ДОКУПИТЬ +5 ХОДОВ · ${price} ₽`, 275, 14, opts.wallet >= price ? '#141416' : MUTED);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(320 - 110, 300, 220, 40);
    centerText(ctx, 'СДАТЬСЯ (−1 ⚡)', 325, 14, MUTED);
  }
}
