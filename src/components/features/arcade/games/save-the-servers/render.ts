// Рисование game01. HUD и эффекты — В КАНВАСЕ (попадают под CRT-пасс). Цвета — литералы
// NIGHTFALL (в канвасе нет доступа к CSS-токенам), держим их именованными для бренда.
// v1.4: фиксированный размер бутылок, goldpevko/zvezda/error-ассеты, флэш по таймлайну трека.

import { ARCADE_W, ARCADE_H } from '../../types';
import type { SpriteCache } from './sprites';
import { starActive, PEVKO_RATIO, type GameState } from './state';
import {
  BOTTLE_BASE_H,
  PELMEN_SIZE,
  PELMEN_TARGET,
  PICKUP_SIZE,
  SPARK_MS,
  HITPOP_MS,
  HITRING_MS,
  FLASH_BLAST_AT,
  FLASH_PEAK_AT,
  FLASH_TOTAL_MS,
  FLASH_PEAK,
  FLASH_PEAK_REDUCED,
  backplateSrc,
  itemSrc,
  cursorSrc,
  errorSrc,
} from './config';

const AMBER = '#E68E25';
const TEXT = '#F2F2F2';
const MUTED = '#9AA0AE';
const DANGER = '#C24339';
const GOLD = '#EBC33A';
const GREEN = '#8DE736';
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
  const pevko = sprites.get(itemSrc('pevko'));
  const gold = sprites.get(itemSrc('goldpevko'));
  const bh = BOTTLE_BASE_H; // фиксированный размер — без масштабирования (спека §1)
  const bw = bh * PEVKO_RATIO;
  for (const b of s.bottles) {
    // squash-«поп» — короткий фидбэк удара (не геймплейное масштабирование).
    const pop = b.hitAt >= 0 && s.nowMs - b.hitAt < HITPOP_MS ? 1 + 0.22 * (1 - (s.nowMs - b.hitAt) / HITPOP_MS) : 1;
    const img = b.golden ? (gold ?? pevko) : pevko;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.scale(pop, pop);
    if (b.golden) {
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 14;
    }
    if (img) ctx.drawImage(img, -bw / 2, -bh / 2, bw, bh);
    else {
      ctx.fillStyle = b.golden ? GOLD : '#c9a227';
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

function drawPickups(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: GameState): void {
  for (const p of s.pickups) {
    const img = sprites.get(itemSrc(p.kind === 'heal' ? 'heal' : 'zvezda'));
    const sz = PICKUP_SIZE;
    if (img) {
      ctx.drawImage(img, p.x - sz / 2, p.y - sz / 2, sz, sz);
    } else {
      ctx.save();
      ctx.fillStyle = p.kind === 'heal' ? GREEN : GOLD;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState): void {
  // HP-пипсы (оверхил без потолка): до 6 пипсов + «×N», если больше.
  const pipW = 16;
  const gap = 6;
  const maxPips = 6;
  const shown = Math.min(s.hp, maxPips);
  for (let i = 0; i < shown; i++) {
    ctx.fillStyle = AMBER;
    ctx.fillRect(14 + i * (pipW + gap), 14, pipW, 12);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (s.hp > maxPips) {
    font(ctx, 13);
    ctx.fillStyle = AMBER;
    ctx.fillText(`×${s.hp}`, 14 + maxPips * (pipW + gap) + 2, 25);
  }

  font(ctx, 22);
  ctx.fillStyle = AMBER;
  ctx.fillText(String(s.score), 14, 52);

  // Таймер (центр).
  ctx.textAlign = 'center';
  font(ctx, 18);
  ctx.fillStyle = TEXT;
  ctx.fillText(fmtTime(s.gameMs), ARCADE_W / 2, 28);

  // Виджет Пельменя (справа).
  if (s.pelmen) {
    ctx.textAlign = 'right';
    font(ctx, 15);
    ctx.fillStyle = GOLD;
    ctx.fillText(`ПЕЛЬМЕНЬ ${s.pelmen.clicks}/${PELMEN_TARGET}`, ARCADE_W - 14, 26);
  }

  // Бафф «Звезда» (замедление падения) — таймер под виджетом.
  if (starActive(s)) {
    ctx.textAlign = 'right';
    font(ctx, 13);
    ctx.fillStyle = GOLD;
    const left = Math.ceil((s.starUntil - s.nowMs) / 1000);
    ctx.fillText(`★ ЗАМЕДЛЕНИЕ ${left}с`, ARCADE_W - 14, s.pelmen ? 46 : 26);
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: GameState, reduced: boolean): void {
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
    const g = ctx.createRadialGradient(ARCADE_W / 2, ARCADE_H / 2, ARCADE_H * 0.3, ARCADE_W / 2, ARCADE_H / 2, ARCADE_H * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
  }

  // Окно ошибки BSG (спека §5.2: картинка error<N>, opacity 0.8, бутылка за ним видна).
  if (s.debuff?.kind === 'error' && s.errorBox) {
    const b = s.errorBox;
    const img = sprites.get(errorSrc(b.variant));
    ctx.save();
    ctx.globalAlpha = 0.8;
    if (img) {
      ctx.drawImage(img, b.x, b.y, b.w, b.h);
    } else {
      ctx.fillStyle = '#c9c9cf';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#3a3a40';
      ctx.fillRect(b.x, b.y, b.w, 26);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f2f2f2';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      font(ctx, 14);
      ctx.fillText('BACKEND ERROR 228', b.x + 12, b.y + 13);
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  // Флэш «Заря» — посекундный таймлайн трека flashgrenade.mp3 (спека §5.1).
  if (s.debuff?.kind === 'flash' && s.flashStart >= 0) {
    const el = s.nowMs - s.flashStart;
    const peak = reduced ? FLASH_PEAK_REDUCED : FLASH_PEAK;
    let a = 0;
    if (el >= FLASH_BLAST_AT && el < FLASH_PEAK_AT) {
      a = peak * ((el - FLASH_BLAST_AT) / (FLASH_PEAK_AT - FLASH_BLAST_AT)); // взрыв: рост 0→пик
    } else if (el >= FLASH_PEAK_AT && el < FLASH_TOTAL_MS) {
      a = peak * (1 - (el - FLASH_PEAK_AT) / (FLASH_TOTAL_MS - FLASH_PEAK_AT)); // затухание пик→0
    }
    if (a > 0) {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
    }
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
    drawEffects(ctx, sprites, s, opts.reducedMotion);
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
    centerText(ctx, 'СЕРВЕРА СГОРЕЛИ · ERROR 228', ARCADE_H / 2 - 40, 26, DANGER);
    centerText(ctx, `СЧЁТ ${s.score}`, ARCADE_H / 2, 26, AMBER);
    centerText(ctx, `рекорд ${Math.max(bestScore, s.score)}`, ARCADE_H / 2 + 30, 15, MUTED);
    centerText(ctx, 'клик — заново', ARCADE_H / 2 + 62, 16, TEXT);
  }

  drawCursor(ctx, sprites, opts, s);
}
