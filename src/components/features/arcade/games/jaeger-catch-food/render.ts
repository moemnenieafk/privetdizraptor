// Рисование game04 «Егерь ловит покушать». Ретро-LCD: backplate + простые скаты + поза Егеря +
// предметы на скатах + HUD. Цвета — литералы NIGHTFALL (в канвасе нет CSS-токенов).

import { ARCADE_W, ARCADE_H } from '../../types';
import type { SpriteCache } from '../../sprites';
import { itemXY, type JaegerState } from './state';
import {
  assetSrc,
  RAMPS,
  POSITIONS,
  JAEGER_SPRITE,
  JAEGER_CX,
  JAEGER_CY,
  JAEGER_H,
  ITEM_SIZE,
  MAX_MISSES,
} from './config';

const AMBER = '#E68E25';
const TEXT = '#F2F2F2';
const MUTED = '#9AA0AE';
const DANGER = '#C24339';
const GREEN = '#8DE736';
const GOLD = '#EBC33A';
const BG = '#0b0b0d';

function font(ctx: CanvasRenderingContext2D, px: number): void {
  ctx.font = `${px}px "BlenderPro-Medium", "Bender", sans-serif`;
}
function center(ctx: CanvasRenderingContext2D, text: string, y: number, px: number, color: string): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, px);
  ctx.fillStyle = color;
  ctx.fillText(text, ARCADE_W / 2, y);
}

function drawBackplate(ctx: CanvasRenderingContext2D, sprites: SpriteCache): void {
  const img = sprites.get(assetSrc('backplate'));
  if (!img) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
    return;
  }
  const s = Math.max(ARCADE_W / img.naturalWidth, ARCADE_H / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.drawImage(img, (ARCADE_W - w) / 2, (ARCADE_H - h) / 2, w, h);
}

function drawRamps(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (const pos of POSITIONS) {
    const r = RAMPS[pos];
    ctx.strokeStyle = 'rgba(230,142,37,0.30)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(r.sx, r.sy);
    ctx.lineTo(r.cx, r.cy);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230,142,37,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.sx, r.sy);
    ctx.lineTo(r.cx, r.cy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawItems(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: JaegerState): void {
  for (const it of s.items) {
    const { x, y } = itemXY(it);
    const img = sprites.get(assetSrc(it.kind));
    if (img) {
      if (it.kind === 'btc') {
        ctx.save();
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 12;
        ctx.drawImage(img, x - ITEM_SIZE / 2, y - ITEM_SIZE / 2, ITEM_SIZE, ITEM_SIZE);
        ctx.restore();
      } else {
        ctx.drawImage(img, x - ITEM_SIZE / 2, y - ITEM_SIZE / 2, ITEM_SIZE, ITEM_SIZE);
      }
    } else {
      ctx.fillStyle = it.kind === 'm67' ? DANGER : it.kind === 'btc' ? GOLD : AMBER;
      ctx.beginPath();
      ctx.arc(x, y, ITEM_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawJaeger(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: JaegerState): void {
  const img = sprites.get(assetSrc(JAEGER_SPRITE[s.basket]));
  if (!img) return;
  const h = JAEGER_H;
  const w = h * (img.naturalWidth / img.naturalHeight);
  ctx.drawImage(img, JAEGER_CX - w / 2, JAEGER_CY - h / 2, w, h);
}

function drawCatchFx(ctx: CanvasRenderingContext2D, s: JaegerState): void {
  if (!s.catchFx || s.nowMs >= s.catchFx.until) return;
  const r = RAMPS[s.catchFx.pos];
  const k = (s.catchFx.until - s.nowMs) / 300;
  ctx.save();
  ctx.globalAlpha = 0.6 * k;
  ctx.strokeStyle = s.catchFx.good ? GREEN : DANGER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(r.cx, r.cy, 18 + (1 - k) * 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, s: JaegerState): void {
  // Промахи (3 пипса, использованные — красные).
  const pipW = 16;
  const gap = 6;
  for (let i = 0; i < MAX_MISSES; i++) {
    ctx.fillStyle = i < s.misses ? DANGER : '#2b2b30';
    ctx.fillRect(14 + i * (pipW + gap), 14, pipW, 12);
  }
  // Счёт (центр сверху).
  center(ctx, String(s.score), 30, 24, AMBER);
}

export interface JaegerDrawOpts {
  reducedMotion: boolean;
}

export function draw(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteCache,
  s: JaegerState,
  _opts: JaegerDrawOpts,
  ready: boolean,
  bestScore: number,
): void {
  drawBackplate(ctx, sprites);

  if (!ready || s.phase === 'loading') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
    center(ctx, 'ЗАГРУЗКА…', ARCADE_H / 2, 18, MUTED);
    return;
  }

  drawRamps(ctx);
  if (s.phase === 'playing' || s.phase === 'over') {
    drawItems(ctx, sprites, s);
    drawCatchFx(ctx, s);
    drawJaeger(ctx, sprites, s);
    drawHud(ctx, s);
  }

  if (s.phase === 'idle') {
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
    center(ctx, 'ЕГЕРЬ ЛОВИТ ПОКУШАТЬ', ARCADE_H / 2 - 60, 30, TEXT);
    center(ctx, 'Лови лут корзиной, не поймай гранату', ARCADE_H / 2 - 26, 15, MUTED);
    center(ctx, 'КЛАВИШИ:  Q/Й · S/Ы  (лево)     P/З · L/Д  (право)', ARCADE_H / 2 + 6, 14, AMBER);
    center(ctx, 'или тап по углам экрана', ARCADE_H / 2 + 28, 13, MUTED);
    center(ctx, 'клавиша / тап — начать', ARCADE_H / 2 + 64, 16, AMBER);
    if (bestScore > 0) center(ctx, `рекорд ${bestScore}`, ARCADE_H / 2 + 92, 13, MUTED);
  }

  if (s.phase === 'over') {
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
    center(ctx, 'GAME OVER', ARCADE_H / 2 - 40, 32, DANGER);
    center(ctx, `СЧЁТ ${s.score}`, ARCADE_H / 2, 26, AMBER);
    center(ctx, `рекорд ${Math.max(bestScore, s.score)}`, ARCADE_H / 2 + 30, 15, MUTED);
    center(ctx, 'клавиша / тап — заново', ARCADE_H / 2 + 62, 16, TEXT);
  }
}
