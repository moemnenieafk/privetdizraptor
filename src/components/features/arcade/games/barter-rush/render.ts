// Рисование game03 «Прибыль бартера» в канвасе (под CRT). Цвета — литералы NIGHTFALL.

import { ARCADE_W, ARCADE_H } from '../../types';
import type { SpriteCache } from '../../sprites';
import type { RushState } from './state';
import { currentCard } from './state';
import type { RushItem } from '@/lib/eft-barter-rush';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { TRADER_COLORS } from '@/data/traderColors';
import { TRADER_IMG, BTN, CARD_TIME_MS, SWIPE_THRESHOLD } from './config';

const AMBER = '#E68E25';
const SUCCESS = '#8DE736';
const DANGER = '#C24339';
const TEXT = '#F2F2F2';
const MUTED = '#9AA0AE';
const LINE = '#313135';

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const CARD = { x: 40, y: 58, w: 560, h: 352 } as const;

export interface RushDrawOpts {
  best: number;
  reducedMotion: boolean;
}

function font(ctx: CanvasRenderingContext2D, px: number): void {
  ctx.font = `${px}px "BlenderPro-Medium", sans-serif`;
}
function verdictColor(v: string): string {
  return v === 'profitable' ? SUCCESS : v === 'unprofitable' ? DANGER : MUTED;
}
function formatRub(n: number): string {
  return `₽ ${new Intl.NumberFormat('ru-RU').format(Math.round(n))}`;
}

function drawIcon(ctx: CanvasRenderingContext2D, sprites: SpriteCache, item: RushItem, x: number, y: number, size: number): void {
  const r = Math.max(3, Math.round(size * 0.1));
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, r);
  ctx.fillStyle = getTarkovBackgroundColor(item.bg);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();
  const img = sprites.get(item.img);
  const pad = Math.round(size * 0.08);
  if (img) {
    ctx.drawImage(img, x + pad, y + pad, size - pad * 2, size - pad * 2);
  } else {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    font(ctx, 9);
    ctx.fillStyle = MUTED;
    ctx.fillText(item.shortName.slice(0, 6), x + size / 2, y + size / 2, size - 4);
    ctx.textBaseline = 'alphabetic';
  }
  if (item.count > 1) {
    const t = `×${Math.ceil(item.count)}`;
    font(ctx, 11);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    const tw = ctx.measureText(t).width;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(x + size - tw - 5, y + size - 14, tw + 5, 14);
    ctx.fillStyle = TEXT;
    ctx.fillText(t, x + size - 2, y + size - 3);
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: RushState, opts: RushDrawOpts): void {
  ctx.textBaseline = 'alphabetic';
  // Счёт.
  ctx.textAlign = 'left';
  font(ctx, 12);
  ctx.fillStyle = MUTED;
  ctx.fillText('СЧЁТ', 14, 18);
  font(ctx, 20);
  ctx.fillStyle = AMBER;
  ctx.fillText(s.score.toLocaleString('ru-RU'), 14, 40);

  // Комбо.
  ctx.textAlign = 'center';
  font(ctx, 12);
  ctx.fillStyle = MUTED;
  ctx.fillText('КОМБО', ARCADE_W / 2, 18);
  font(ctx, 18);
  ctx.fillStyle = s.combo > 0 ? SUCCESS : MUTED;
  ctx.fillText(s.combo > 0 ? `${s.combo}× · ×${Math.min(5, 1 + Math.floor(s.combo / 3))}` : '—', ARCADE_W / 2, 40);

  // Жизни + рекорд.
  ctx.textAlign = 'right';
  font(ctx, 16);
  let hearts = '';
  for (let i = 0; i < 3; i++) hearts += i < s.lives ? '♥ ' : '♡ ';
  ctx.fillStyle = DANGER;
  ctx.fillText(hearts.trim(), ARCADE_W - 12, 20);
  font(ctx, 11);
  ctx.fillStyle = MUTED;
  ctx.fillText(`РЕКОРД ${Math.max(opts.best, s.score).toLocaleString('ru-RU')}`, ARCADE_W - 12, 40);
}

function drawTimer(ctx: CanvasRenderingContext2D, s: RushState): void {
  const frac = Math.max(0, Math.min(1, s.timeLeft / CARD_TIME_MS));
  ctx.fillStyle = LINE;
  ctx.fillRect(CARD.x, 48, CARD.w, 5);
  ctx.fillStyle = frac > 0.5 ? SUCCESS : frac > 0.25 ? AMBER : DANGER;
  ctx.fillRect(CARD.x, 48, CARD.w * frac, 5);
}

// Лейбл секции по центру с линиями по бокам (как в детальной карточке бартера).
function sectionLabel(ctx: CanvasRenderingContext2D, text: string, cy: number): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 10);
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = MUTED;
  ctx.fillText(text, ARCADE_W / 2, cy);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  const gap = tw / 2 + 14;
  ctx.beginPath();
  ctx.moveTo(CARD.x + 26, cy - 4);
  ctx.lineTo(ARCADE_W / 2 - gap, cy - 4);
  ctx.moveTo(ARCADE_W / 2 + gap, cy - 4);
  ctx.lineTo(CARD.x + CARD.w - 26, cy - 4);
  ctx.stroke();
}

// Плитка предмета: крупная иконка + название под ней (без цен — их видно только во вскрытии).
function itemTile(ctx: CanvasRenderingContext2D, sprites: SpriteCache, item: RushItem, cx: number, topY: number, size: number): void {
  drawIcon(ctx, sprites, item, Math.round(cx - size / 2), topY, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 11);
  ctx.fillStyle = TEXT;
  ctx.fillText(item.shortName, cx, topY + size + 14, size + 28);
}

function drawCard(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: RushState): void {
  const c = currentCard(s);
  if (!c) return;
  const border = s.phase === 'reveal' && s.result ? verdictColor(s.result.verdict) : LINE;

  ctx.save();
  ctx.translate(s.dx, 0);

  // Фон принимает глобальный цвет торговца — тот же рецепт, что «фон» в Карте заданий
  // (QuestDetail pageBg): radial-gradient(circle at 0% 0%, color-mix(trader 12%, transparent),
  // rgba(0,0,0,0.85)). Тинт через прозрачность из угла, конец — альфа-чёрный.
  const traderColor = TRADER_COLORS[c.traderNorm] ?? '#3A3A3F';
  const g = ctx.createRadialGradient(CARD.x, CARD.y, 0, CARD.x, CARD.y, Math.hypot(CARD.w, CARD.h));
  g.addColorStop(0, hexToRgba(traderColor, 0.12));
  g.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  const R = 14;
  const cardPath = () => {
    ctx.beginPath();
    ctx.roundRect(CARD.x, CARD.y, CARD.w, CARD.h, R);
  };
  // База под альфа-градиентом, чтобы карта читалась как панель на тёмном канвасе.
  cardPath();
  ctx.fillStyle = '#141416';
  ctx.fill();
  cardPath();
  ctx.fillStyle = g;
  ctx.fill();

  // Свайп-подсказки (в скруглённых границах карты).
  if (s.phase === 'playing' && s.dx !== 0) {
    const k = Math.min(1, Math.abs(s.dx) / SWIPE_THRESHOLD);
    cardPath();
    ctx.globalAlpha = 0.18 * k;
    ctx.fillStyle = s.dx > 0 ? SUCCESS : DANGER;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  cardPath();
  ctx.strokeStyle = border;
  ctx.lineWidth = s.phase === 'reveal' ? 2.5 : 1;
  ctx.stroke();

  // Шапка: торговец.
  const trader = sprites.get(TRADER_IMG(c.traderNorm));
  if (trader) ctx.drawImage(trader, CARD.x + 14, CARD.y + 12, 34, 34);
  else {
    ctx.fillStyle = LINE;
    ctx.fillRect(CARD.x + 14, CARD.y + 12, 34, 34);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 15);
  ctx.fillStyle = TEXT;
  ctx.fillText(`${c.traderName} LL${c.level}`, CARD.x + 56, CARD.y + 34, 360);
  ctx.textAlign = 'right';
  font(ctx, 10);
  ctx.fillStyle = MUTED;
  ctx.fillText('БАРТЕР', CARD.x + CARD.w - 14, CARD.y + 28);

  // ─── ОТДАЮ ─── (центрированный ряд крупных иконок).
  sectionLabel(ctx, 'ОТДАЮ', CARD.y + 80);
  const req = c.required.slice(0, 6);
  const n = req.length;
  const isize = n <= 3 ? 60 : n <= 4 ? 54 : n <= 5 ? 48 : 42;
  const gap = 16;
  const totalW = n * isize + (n - 1) * gap;
  const startX = ARCADE_W / 2 - totalW / 2;
  const reqTop = CARD.y + 94;
  req.forEach((ri, i) => itemTile(ctx, sprites, ri, startX + i * (isize + gap) + isize / 2, reqTop, isize));

  // ─── ПОЛУЧАЮ ─── (одна крупная иконка по центру).
  sectionLabel(ctx, 'ПОЛУЧАЮ', CARD.y + 208);
  const rsize = 78;
  drawIcon(ctx, sprites, c.reward, Math.round(ARCADE_W / 2 - rsize / 2), CARD.y + 222, rsize);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 15);
  ctx.fillStyle = TEXT;
  ctx.fillText(c.rewardLabel, ARCADE_W / 2, CARD.y + 222 + rsize + 18, CARD.w - 60);

  ctx.restore();
}

function drawBottom(ctx: CanvasRenderingContext2D, s: RushState): void {
  if (s.phase === 'reveal' && s.result) {
    const r = s.result;
    const col = verdictColor(r.verdict);
    ctx.textAlign = 'left';
    font(ctx, 15);
    ctx.fillStyle = r.correct ? SUCCESS : DANGER;
    ctx.fillText(r.timeout ? '⏱ ПРОСРОЧИЛ' : r.correct ? '▲ ВЕРНО' : '✕ МИМО КАССЫ', 24, BTN.y + 18);
    if (r.correct && r.points > 0) {
      let bonus = `+${r.points}`;
      if (r.mult > 1) bonus += ` ×${r.mult}`;
      if (r.fast) bonus += ' быстро';
      font(ctx, 14);
      ctx.fillStyle = AMBER;
      ctx.fillText(bonus, 150, BTN.y + 18);
    }
    // Вердикт + профит.
    ctx.textAlign = 'left';
    font(ctx, 12);
    ctx.fillStyle = col;
    const label = r.verdict === 'profitable' ? 'ВЫГОДНЫЙ' : r.verdict === 'unprofitable' ? 'НЕВЫГОДНЫЙ' : 'НЕЙТРАЛЬНЫЙ';
    ctx.fillText(`${label} · ROI ${r.roi >= 0 ? '+' : '−'}${Math.abs(r.roi).toFixed(0)}%`, 24, BTN.y + 40);
    ctx.textAlign = 'right';
    font(ctx, 22);
    ctx.fillStyle = col;
    ctx.fillText(`${r.netProfit >= 0 ? '+' : '−'}${formatRub(Math.abs(r.netProfit))}`, ARCADE_W - 24, BTN.y + 38);
    ctx.textAlign = 'center';
    font(ctx, 10);
    ctx.fillStyle = MUTED;
    ctx.fillText('ТАП — ДАЛЬШЕ', ARCADE_W / 2, ARCADE_H - 6);
    return;
  }

  // playing: кнопки оценки.
  const drawBtn = (b: { x: number; w: number }, label: string, color: string) => {
    ctx.beginPath();
    ctx.roundRect(b.x, BTN.y, b.w, BTN.h, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    font(ctx, 17);
    ctx.fillStyle = color;
    ctx.fillText(label, b.x + b.w / 2, BTN.y + BTN.h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  };
  drawBtn(BTN.mimo, '↞ МИМО', DANGER);
  drawBtn(BTN.vygoda, 'ВЫГОДА ↠', SUCCESS);
}

function overlay(ctx: CanvasRenderingContext2D, a: number): void {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);
}
function center(ctx: CanvasRenderingContext2D, text: string, y: number, px: number, color: string): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, px);
  ctx.fillStyle = color;
  ctx.fillText(text, ARCADE_W / 2, y);
}

export function draw(ctx: CanvasRenderingContext2D, sprites: SpriteCache, s: RushState, opts: RushDrawOpts, ready: boolean): void {
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0, 0, ARCADE_W, ARCADE_H);

  if (!ready || s.phase === 'loading') {
    center(ctx, 'ЗАГРУЗКА…', ARCADE_H / 2, 18, MUTED);
    return;
  }
  if (s.phase === 'empty') {
    center(ctx, 'НЕТ ДАННЫХ О БАРТЕРАХ', ARCADE_H / 2, 16, MUTED);
    return;
  }

  drawHud(ctx, s, opts);
  if (s.phase === 'playing') drawTimer(ctx, s);
  drawCard(ctx, sprites, s);
  drawBottom(ctx, s);

  if (s.phase === 'brief') {
    overlay(ctx, 0.74);
    center(ctx, 'ПРИБЫЛЬ БАРТЕРА', ARCADE_H / 2 - 58, 30, AMBER);
    center(ctx, 'Оцени сделку на глаз: выгодна или нет.', ARCADE_H / 2 - 18, 15, TEXT);
    center(ctx, 'Свайп → ВЫГОДА, ← МИМО (или кнопки).', ARCADE_H / 2 + 6, 14, MUTED);
    center(ctx, 'Успей до таймера. 3 ошибки — смена окончена.', ARCADE_H / 2 + 28, 14, MUTED);
    center(ctx, 'ТАП — СТАРТ', ARCADE_H / 2 + 66, 16, AMBER);
  }

  if (s.phase === 'over') {
    overlay(ctx, 0.78);
    center(ctx, 'СМЕНА ОКОНЧЕНА', ARCADE_H / 2 - 48, 30, DANGER);
    center(ctx, `Счёт ${s.score.toLocaleString('ru-RU')}`, ARCADE_H / 2 - 6, 22, AMBER);
    center(ctx, `Рекорд ${Math.max(opts.best, s.score).toLocaleString('ru-RU')}`, ARCADE_H / 2 + 22, 15, MUTED);
    center(ctx, 'ТАП — ЗАНОВО', ARCADE_H / 2 + 58, 16, TEXT);
  }
}
