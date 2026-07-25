// Рисование game01. HUD и эффекты — В КАНВАСЕ (попадают под CRT-пасс). Цвета — литералы
// NIGHTFALL (в канвасе нет доступа к CSS-токенам), держим их именованными для бренда.

import { ARCADE_W, ARCADE_H } from '../../types';
import type { SpriteCache } from './sprites';
import {
  bottleScaleNow,
  starActive,
  PEVKO_RATIO,
  type GameState,
} from './state';
import {
  BOTTLE_BASE_H,
  HP_MAX,
  PELMEN_SIZE,
  PELMEN_TARGET,
  PICKUP_SIZE,
  DEBUFF_FLASH_MS,
  SPARK_MS,
  HITPOP_MS,
  HITRING_MS,
  backplateSrc,
  itemSrc,
  cursorSrc,
} from './config';

const AMBER = '#E68E25';
const TEXT = '#F2F2F2';
const MUTED = '#9AA0AE';
const DANGER = '#C24339';
const GOLD = '#EBC33A';
const BG = '#0b0b0d';

export interface DrawOpts {
  cursorFile: string;
  backplateN: number;
  pointer: { x: number; y: number; down: boolean } | null;
  reducedMotion: boolean;
}

function font(ctx: CanvasRenderingContext2D, px: number): void {
  ctx.font = `${px}px "BlenderPro-Medium", "Bender", sans-serif`;
}

function fmtTime(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function drawBackplate(ctx: CanvasRenderingContext2D, sprites: SpriteCache, n: number): void {
  const img = sprites.get(backplateSrc(n));
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

function drawBottles(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: GameState): void {
  const img = sprites.get(itemSrc('pevko'));
  const bh = BOTTLE_BASE_H * bottleScaleNow(s);
  const bw = bh * PEVKO_RATIO;
  for (const b of s.bottles) {
    // squash-«поп» после удара.
    const pop = b.hitAt >= 0 && s.nowMs - b.hitAt < HITPOP_MS ? 1 + 0.22 * (1 - (s.nowMs - b.hitAt) / HITPOP_MS) : 1;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.scale(pop, pop);
    if (b.golden && img) {
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 14;
      ctx.drawImage(img, -bw / 2, -bh / 2, bw, bh);
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = GOLD;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    } else if (img) {
      ctx.drawImage(img, -bw / 2, -bh / 2, bw, bh);
    } else {
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    }
    ctx.restore();
  }
}

function drawPelmen(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: GameState): void {
  if (!s.pelmen) return;
  const img = sprites.get(itemSrc(s.pelmen.variant));
  const sz = PELMEN_SIZE;
  if (!img) return;
  ctx.save();
  ctx.translate(s.pelmen.x, s.pelmen.y);
  ctx.rotate(s.pelmen.angle);
  ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
  ctx.restore();
}

function drawHitFx(ctx: CanvasRenderingContext2D, s: GameState): void {
  if (!s.hitFx || s.nowMs >= s.hitFx.until) return;
  const k = (s.hitFx.until - s.nowMs) / HITRING_MS; // 1→0
  const r = s.hitFx.r * (0.62 + 0.38 * (1 - k));
  ctx.save();
  ctx.globalAlpha = 0.5 * k;
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.hitFx.x, s.hitFx.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 16;
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.restore();
}

function drawPickups(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: GameState): void {
  for (const p of s.pickups) {
    if (p.kind === 'heal') {
      const img = sprites.get(itemSrc('heal'));
      const sz = PICKUP_SIZE;
      if (img) ctx.drawImage(img, p.x - sz / 2, p.y - sz / 2, sz, sz);
    } else {
      drawStar(ctx, p.x, p.y, PICKUP_SIZE / 2);
    }
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState): void {
  // HP-пипсы (слева сверху).
  const pipW = 16;
  const gap = 6;
  for (let i = 0; i < HP_MAX; i++) {
    const x = 14 + i * (pipW + gap);
    ctx.fillStyle = i < s.hp ? AMBER : '#2b2b30';
    ctx.fillRect(x, 14, pipW, 12);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 22);
  ctx.fillStyle = AMBER;
  ctx.fillText(String(s.score), 14, 52);

  // Таймер (центр).
  ctx.textAlign = 'center';
  font(ctx, 18);
  ctx.fillStyle = TEXT;
  ctx.fillText(fmtTime(s.gameMs), ARCADE_W / 2, 28);

  // Виджет Пельменя (справа), не перекрывает бутылки.
  if (s.pelmen) {
    ctx.textAlign = 'right';
    font(ctx, 15);
    ctx.fillStyle = GOLD;
    ctx.fillText(`ПЕЛЬМЕНЬ ${s.pelmen.clicks}/${PELMEN_TARGET}`, ARCADE_W - 14, 26);
  }

  // Бафф «Звезда» — таймер под виджетом.
  if (starActive(s)) {
    ctx.textAlign = 'right';
    font(ctx, 13);
    ctx.fillStyle = GOLD;
    const left = Math.ceil((s.starUntil - s.nowMs) / 1000);
    ctx.fillText(`★ ЗВЕЗДА ${left}с`, ARCADE_W - 14, s.pelmen ? 46 : 26);
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, s: GameState, reduced: boolean): void {
  // Искры при потере HP (низ экрана).
  if (s.nowMs < s.sparkUntil) {
    const k = (s.sparkUntil - s.nowMs) / SPARK_MS;
    ctx.save();
    ctx.globalAlpha = 0.5 * k;
    ctx.fillStyle = DANGER;
    ctx.fillRect(0, ARCADE_H - 40, ARCADE_W, 40);
    if (!reduced) {
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#FFD37A';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * ARCADE_W;
        ctx.beginPath();
        ctx.moveTo(x, ARCADE_H - 6);
        ctx.lineTo(x + (Math.random() * 20 - 10), ARCADE_H - 6 - Math.random() * 26);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Дебафф «Тремор»: тёмная пульсация по краям.
  if (s.debuff?.kind === 'tremor') {
    const pulse = reduced ? 0.35 : 0.28 + 0.14 * Math.sin(s.nowMs / 90);
    const g = ctx.createRadialGradient(
      ARCADE_W / 2,
      ARCADE_H / 2,
      ARCADE_H * 0.3,
      ARCADE_W / 2,
      ARCADE_H / 2,
      ARCADE_H * 0.72,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
  }

  // Окно «Backend Error 228».
  if (s.debuff?.kind === 'error' && s.errorBox) {
    const b = s.errorBox;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
    ctx.fillStyle = '#c9c9cf';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#3a3a40';
    ctx.fillRect(b.x, b.y, b.w, 26);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    font(ctx, 14);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillText('BACKEND ERROR 228', b.x + 12, b.y + 13);
    ctx.fillStyle = '#1a1a1e';
    font(ctx, 13);
    ctx.fillText('Стойка перегружена. Продолжай чеканить.', b.x + 14, b.y + 58);
    // Кнопка OK.
    ctx.fillStyle = AMBER;
    ctx.fillRect(b.okX, b.okY, b.okW, b.okH);
    ctx.fillStyle = '#141416';
    ctx.textAlign = 'center';
    font(ctx, 14);
    ctx.fillText('OK', b.okX + b.okW / 2, b.okY + b.okH / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  // Флэш «Заря».
  if (s.nowMs < s.flashUntil) {
    const a = reduced ? 0.4 : (s.flashUntil - s.nowMs) / DEBUFF_FLASH_MS;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
  }
}

function drawCursor(ctx: CanvasRenderingContext2D, sprites: SpriteCache, opts: DrawOpts, s: GameState): void {
  const p = opts.pointer;
  if (!p) return;
  let px = p.x;
  let py = p.y;
  if (s.debuff?.kind === 'tremor' && !opts.reducedMotion) {
    px += Math.random() * 6 - 3;
    py += Math.random() * 6 - 3;
  }
  const img = sprites.get(cursorSrc(opts.cursorFile, p.down ? 2 : 1));
  const size = 104;
  if (img) ctx.drawImage(img, px - size * 0.28, py - size * 0.72, size, size);

  // Индикатор заряда: кольцо заполняется удержанием ЛКМ; на максимуме — золотое.
  if (p.down && s.charge > 0.05) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = s.charge >= 1 ? GOLD : AMBER;
    if (s.charge >= 1) {
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.arc(px, py, 22, -Math.PI / 2, -Math.PI / 2 + s.charge * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function centerText(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, color: string): void {
  ctx.textAlign = 'center';
  font(ctx, size);
  ctx.fillStyle = color;
  ctx.fillText(text, ARCADE_W / 2, y);
}

export function draw(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteCache,
  s: GameState,
  opts: DrawOpts,
  ready: boolean,
  bestScore: number,
): void {
  drawBackplate(ctx, sprites, opts.backplateN);

  if (!ready || s.phase === 'loading') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
    centerText(ctx, 'ЗАГРУЗКА…', ARCADE_H / 2, 18, MUTED);
    return;
  }

  if (s.phase === 'playing' || s.phase === 'over') {
    drawPickups(ctx, sprites, s);
    drawBottles(ctx, sprites, s);
    drawPelmen(ctx, sprites, s);
    drawHitFx(ctx, s);
    drawHud(ctx, s);
    drawEffects(ctx, s, opts.reducedMotion);
  }

  if (s.phase === 'idle') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
    centerText(ctx, 'СПАСИ СЕРВЕРА', ARCADE_H / 2 - 26, 34, TEXT);
    centerText(ctx, 'не дай пиву затопить стойку', ARCADE_H / 2 + 4, 16, MUTED);
    centerText(ctx, 'клик — начать', ARCADE_H / 2 + 34, 16, AMBER);
    if (bestScore > 0) centerText(ctx, `рекорд ${bestScore}`, ARCADE_H / 2 + 64, 14, MUTED);
  }

  if (s.phase === 'over') {
    ctx.fillStyle = 'rgba(0,0,0,0.66)';
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
    centerText(ctx, 'СЕРВЕРА СГОРЕЛИ', ARCADE_H / 2 - 40, 32, DANGER);
    centerText(ctx, `СЧЁТ ${s.score}`, ARCADE_H / 2, 26, AMBER);
    centerText(ctx, `рекорд ${Math.max(bestScore, s.score)}`, ARCADE_H / 2 + 30, 15, MUTED);
    centerText(ctx, 'клик — заново', ARCADE_H / 2 + 62, 16, TEXT);
  }

  drawCursor(ctx, sprites, opts, s);
}
