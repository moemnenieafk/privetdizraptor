// Рисование game02 «Три в ряд». HUD/панель/оверлеи — в канвасе (под CRT). Цвета — литералы NIGHTFALL.

import { ARCADE_W, ARCADE_H } from '../../types';
import type { SpriteCache } from '../../sprites';
import type { Match3State } from './state';
import { itemSrc, TOOLS, TOOL_LABEL, ENERGY_MAX, CONTINUE_PRICES, levelByIndex } from './config';
import { toolRects } from './layout';

const AMBER = '#E68E25';
const TEXT = '#F2F2F2';
const MUTED = '#9AA0AE';
const DANGER = '#C24339';
const GREEN = '#8DE736';
const PANEL = '#242426';
const LINE = '#313135';

export interface Match3DrawOpts {
  wallet: number;
  energy: number;
  reducedMotion: boolean;
}

function font(ctx: CanvasRenderingContext2D, px: number): void {
  ctx.font = `${px}px "BlenderPro-Medium", sans-serif`;
}

function drawCellSprite(ctx: CanvasRenderingContext2D, sprites: SpriteCache, name: string, x: number, y: number, size: number): void {
  const img = sprites.get(itemSrc(name));
  const pad = Math.round(size * 0.06);
  if (img) ctx.drawImage(img, x + pad, y + pad, size - pad * 2, size - pad * 2);
  else {
    ctx.fillStyle = LINE;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: Match3State): void {
  const { lay, grid, rows, cols } = s;
  // Подложка поля.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(lay.ox - 4, lay.oy - 4, lay.boardW + 8, lay.boardH + 8);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const x = lay.ox + c * lay.cell;
      const y = lay.oy + r * lay.cell;
      ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, y, lay.cell, lay.cell);
      if (!cell) continue;
      if (cell.kind === 'color') drawCellSprite(ctx, sprites, cell.color, x, y, lay.cell);
      else if (cell.kind === 'special') drawCellSprite(ctx, sprites, cell.special, x, y, lay.cell);
      else drawCellSprite(ctx, sprites, 'wood', x, y, lay.cell);
    }
  }

  // Выбранная клетка.
  if (s.selected) {
    const x = lay.ox + s.selected.c * lay.cell;
    const y = lay.oy + s.selected.r * lay.cell;
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, lay.cell - 3, lay.cell - 3);
  }

  // Вспышки очистки.
  for (const f of s.clearFx) {
    const k = Math.max(0, Math.min(1, (f.until - s.nowMs) / 200));
    const x = lay.ox + f.c * lay.cell;
    const y = lay.oy + f.r * lay.cell;
    ctx.fillStyle = `rgba(255,255,255,${0.5 * k})`;
    ctx.fillRect(x, y, lay.cell, lay.cell);
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: Match3State, opts: Match3DrawOpts): void {
  ctx.textBaseline = 'alphabetic';
  // Цель (слева).
  ctx.textAlign = 'left';
  font(ctx, 13);
  ctx.fillStyle = MUTED;
  ctx.fillText('ЦЕЛЬ', 12, 20);
  font(ctx, 18);
  ctx.fillStyle = TEXT;
  const goal = s.goalType === 'rubles' ? `${s.rublesEarned}/${s.goalTarget} ₽` : `ЯЩИКИ ${s.woodBroken}/${s.woodTotal}`;
  ctx.fillText(goal, 12, 42);

  // Ходы (центр).
  ctx.textAlign = 'center';
  font(ctx, 13);
  ctx.fillStyle = MUTED;
  ctx.fillText('ХОДЫ', ARCADE_W / 2, 20);
  font(ctx, 22);
  ctx.fillStyle = s.moves <= 5 ? DANGER : AMBER;
  ctx.fillText(String(s.moves), ARCADE_W / 2, 44);

  // Баланс + энергия (справа).
  ctx.textAlign = 'right';
  font(ctx, 18);
  ctx.fillStyle = AMBER;
  ctx.fillText(`${opts.wallet} ₽`, ARCADE_W - 12, 22);
  font(ctx, 14);
  ctx.fillStyle = GREEN;
  ctx.fillText(`⚡ ${opts.energy}/${ENERGY_MAX}`, ARCADE_W - 12, 44);
}

function drawTools(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: Match3State): void {
  const rects = toolRects(s.lay);
  rects.forEach((rc, i) => {
    const tool = TOOLS[i];
    const active = s.activeTool === tool;
    ctx.fillStyle = PANEL;
    ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
    ctx.strokeStyle = active ? AMBER : LINE;
    ctx.lineWidth = active ? 2.5 : 1;
    ctx.strokeRect(rc.x + 0.5, rc.y + 0.5, rc.w - 1, rc.h - 1);
    const sz = rc.h - 8;
    drawCellSprite(ctx, sprites, tool, rc.x + (rc.w - sz) / 2, rc.y + 2, sz);
    ctx.textAlign = 'center';
    font(ctx, 9);
    ctx.fillStyle = active ? AMBER : MUTED;
    ctx.fillText(TOOL_LABEL[tool], rc.x + rc.w / 2, rc.y + rc.h - 3);
  });
}

function overlayBg(ctx: CanvasRenderingContext2D, alpha: number): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
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

  drawBoard(ctx, sprites, s);
  drawHud(ctx, s, opts);
  drawTools(ctx, sprites, s);

  if (s.phase === 'brief') {
    overlayBg(ctx, 0.72);
    const lvl = levelByIndex(s.levelIndex);
    centerText(ctx, `УРОВЕНЬ ${lvl.id}`, ARCADE_H / 2 - 40, 30, AMBER);
    centerText(ctx, lvl.brief, ARCADE_H / 2, 15, TEXT);
    centerText(ctx, 'ТАП — СТАРТ', ARCADE_H / 2 + 40, 16, MUTED);
  }

  if (s.phase === 'won') {
    overlayBg(ctx, 0.72);
    centerText(ctx, 'ЗАКАЗ ВЫПОЛНЕН', ARCADE_H / 2 - 44, 30, GREEN);
    centerText(ctx, `Заработано ${s.rublesEarned} ₽`, ARCADE_H / 2 - 8, 18, AMBER);
    if (s.bonus > 0) centerText(ctx, `Бонус за ходы +${s.bonus} ₽`, ARCADE_H / 2 + 18, 15, MUTED);
    centerText(ctx, 'ТАП — СЛЕДУЮЩИЙ', ARCADE_H / 2 + 52, 16, TEXT);
  }

  if (s.phase === 'nomoves') {
    overlayBg(ctx, 0.78);
    centerText(ctx, 'ХОДЫ КОНЧИЛИСЬ', ARCADE_H / 2 - 60, 28, DANGER);
    const price = CONTINUE_PRICES[Math.min(s.continuePurchases, 2)];
    // Кнопка «Купить +5» (совпадает с hit-тестом в state: cx=320, y=250, w=220, h=40).
    ctx.fillStyle = opts.wallet >= price ? AMBER : LINE;
    ctx.fillRect(320 - 110, 250, 220, 40);
    ctx.fillStyle = opts.wallet >= price ? '#141416' : MUTED;
    centerText(ctx, `КУПИТЬ +5 ХОДОВ · ${price} ₽`, 275, 15, opts.wallet >= price ? '#141416' : MUTED);
    // Кнопка «Сдаться».
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(320 - 110, 300, 220, 40);
    centerText(ctx, 'СДАТЬСЯ (−1 ⚡)', 325, 15, MUTED);
  }
}
