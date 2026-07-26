// Рисование game04 «Егерь ловит покушать» под НОВЫЙ фон 4:3: backplate (со скатами-крышами) +
// предметы, катящиеся по дуге с вращением + полноэкранная поза Егеря + HUD. Цвета — NIGHTFALL.

import { ARCADE_W, ARCADE_H } from '../../types';
import type { SpriteCache } from '../../sprites';
import { itemXY, type JaegerState } from './state';
import { assetSrc, RAMPS, JAEGER_SPRITE, ITEM_SIZE, ITEM_TURNS, MAX_MISSES } from './config';

const AMBER = '#E68E25';
const TEXT = '#F2F2F2';
const MUTED = '#9AA0AE';
const DANGER = '#C24339';
const GREEN = '#8DE736';
const GOLD = '#EBC33A';
const BG = '#0b0b0d';
const TAU = Math.PI * 2;

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

function drawItems(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: JaegerState): void {
  for (const it of s.items) {
    const { x, y } = itemXY(it);
    const angle = it.spin * it.t * ITEM_TURNS * TAU; // скатывается «по кругу» — вращается по ходу
    const img = sprites.get(assetSrc(it.sprite));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (it.category === 'bonus') {
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 12;
    }
    if (img) {
      // Сохраняем натуральные пропорции ассета (вписываем по большей стороне в ITEM_SIZE).
      const nw = img.naturalWidth || 1;
      const nh = img.naturalHeight || 1;
      const k = ITEM_SIZE / Math.max(nw, nh);
      const w = nw * k;
      const h = nh * k;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = it.category === 'damage' ? DANGER : it.category === 'bonus' ? GOLD : AMBER;
      ctx.beginPath();
      ctx.arc(0, 0, ITEM_SIZE / 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawJaeger(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: JaegerState): void {
  const img = sprites.get(assetSrc(JAEGER_SPRITE[s.basket]));
  if (img) ctx.drawImage(img, 0, 0, ARCADE_W, ARCADE_H); // полноэкранная поза (корзина запечена в арте)
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
  ctx.arc(r.cx, r.cy, 18 + (1 - k) * 16, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, s: JaegerState): void {
  const pipW = 16;
  const gap = 6;
  for (let i = 0; i < MAX_MISSES; i++) {
    ctx.fillStyle = i < s.misses ? DANGER : 'rgba(0,0,0,0.45)';
    ctx.fillRect(14 + i * (pipW + gap), 14, pipW, 12);
  }
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
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
    center(ctx, 'ЗАГРУЗКА…', ARCADE_H / 2, 18, MUTED);
    return;
  }

  if (s.phase === 'playing' || s.phase === 'over') {
    drawItems(ctx, sprites, s);
    drawJaeger(ctx, sprites, s);
    drawCatchFx(ctx, s);
    drawHud(ctx, s);
  }

  if (s.phase === 'idle') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
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
