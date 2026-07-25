// Движок game01 «Спаси сервера»: состояние + обновление. Чистая логика, без рисования.
// Физика на фиксированном шаге 60 Гц; клик-edge детектится на уровне кадра (см. index.ts).
// v1.4: простой клик (импульс на нажатии), фиксированный размер бутылок, оверхил без потолка.

import type { ArcadeInput } from '../../types';
import { ARCADE_W, ARCADE_H } from '../../types';
import {
  GRAVITY,
  CLICK_VY,
  CLICK_VX_MAX,
  WALL_BOUNCE,
  HIT_RADIUS,
  SPIN_IDLE,
  SPIN_ON_HIT,
  SPIN_DAMP,
  HITRING_MS,
  BOTTLE_BASE_H,
  GOLDEN_CHANCE,
  HP_START,
  bottlesAt,
  stageStartMs,
  STAGE_STEP_MS,
  PELMEN_MIN_BOTTLES,
  PELMEN_TARGET,
  PELMEN_SPAWN_MS,
  PELMEN_VARIANTS,
  PELMEN_HIT,
  PICKUP_HIT,
  DEBUFF_ERROR_MS,
  DEBUFF_TREMOR_MS,
  DEBUFF_MIN_INTERVAL_MS,
  ERROR_VARIANTS,
  FLASH_TOTAL_MS,
  BUFF_STAR_MS,
  STAR_FALL_FACTOR,
  HEAL_SPAWN_MS,
  STAR_SPAWN_MS,
  PICKUP_SPEED,
  SCORE_PER_CLICK,
  SCORE_GOLDEN,
  STEP_MS,
  BOTTLE_SPAWN_SPACING_MS,
  SPARK_MS,
} from './config';

export const PEVKO_RATIO = 512 / 1016;

export type Phase = 'loading' | 'idle' | 'playing' | 'over';
export type DebuffKind = 'error' | 'flash' | 'tremor';

export interface Bottle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  golden: boolean;
  angle: number;
  angVel: number;
  hitAt: number; // nowMs последнего удара — для squash-«попа»
}
export interface Pickup {
  kind: 'heal' | 'star';
  x: number;
  y: number;
  vx: number;
}
export interface Pelmen {
  x: number;
  y: number;
  vx: number;
  vy: number;
  variant: string;
  clicks: number;
  angle: number;
  angVel: number;
}
export interface HitFx {
  x: number;
  y: number;
  r: number;
  until: number;
}
export interface ErrorBox {
  x: number;
  y: number;
  w: number;
  h: number;
  variant: number; // 1..ERROR_VARIANTS — какой error<N>.webp
}
export interface Debuff {
  kind: DebuffKind;
  until: number;
}

export interface GameState {
  phase: Phase;
  bottles: Bottle[];
  pickups: Pickup[];
  pelmen: Pelmen | null;
  hp: number;
  score: number;
  gameMs: number; // таймлайн сложности (Пельмень откатывает)
  nowMs: number; // монотонный клок эффектов/спавнов
  prevDown: boolean;
  starUntil: number;
  debuff: Debuff | null;
  errorBox: ErrorBox | null;
  flashStart: number; // nowMs старта флэша (для посекундного таймлайна), -1 = нет
  sparkUntil: number;
  hitFx: HitFx | null;
  nextBottleAt: number;
  nextPelmenAt: number;
  nextHealAt: number;
  nextStarAt: number;
  nextDebuffAt: number;
}

export type GameSound = 'bounce' | 'thud' | 'powerup' | 'flash' | 'burst';

export interface UpdateHooks {
  onGameOver: (score: number) => void;
  sfx: (s: GameSound) => void;
}

export function createState(): GameState {
  return {
    phase: 'loading',
    bottles: [],
    pickups: [],
    pelmen: null,
    hp: HP_START,
    score: 0,
    gameMs: 0,
    nowMs: 0,
    prevDown: false,
    starUntil: -1,
    debuff: null,
    errorBox: null,
    flashStart: -1,
    sparkUntil: -1,
    hitFx: null,
    nextBottleAt: 0,
    nextPelmenAt: PELMEN_SPAWN_MS,
    nextHealAt: HEAL_SPAWN_MS,
    nextStarAt: STAR_SPAWN_MS,
    nextDebuffAt: DEBUFF_MIN_INTERVAL_MS,
  };
}

export function starActive(s: GameState): boolean {
  return s.nowMs < s.starUntil;
}

export function startRun(s: GameState): void {
  s.phase = 'playing';
  s.bottles = [];
  s.pickups = [];
  s.pelmen = null;
  s.hp = HP_START;
  s.score = 0;
  s.gameMs = 0;
  s.nowMs = 0;
  s.starUntil = -1;
  s.debuff = null;
  s.errorBox = null;
  s.flashStart = -1;
  s.sparkUntil = -1;
  s.hitFx = null;
  s.nextBottleAt = 0;
  s.nextPelmenAt = PELMEN_SPAWN_MS;
  s.nextHealAt = HEAL_SPAWN_MS;
  s.nextStarAt = STAR_SPAWN_MS;
  s.nextDebuffAt = DEBUFF_MIN_INTERVAL_MS;
  spawnBottle(s);
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function spawnBottle(s: GameState): void {
  s.bottles.push({
    x: rand(ARCADE_W * 0.3, ARCADE_W * 0.7),
    y: 80,
    vx: rand(-1.5, 1.5),
    vy: 0,
    golden: Math.random() < GOLDEN_CHANCE,
    angle: rand(-0.3, 0.3),
    angVel: rand(-SPIN_IDLE, SPIN_IDLE),
    hitAt: -1,
  });
}

function spawnPelmen(s: GameState): void {
  // Вход «по дуге» сбоку (спека §4: строго рандомно по дуге).
  const fromLeft = Math.random() < 0.5;
  s.pelmen = {
    x: fromLeft ? 40 : ARCADE_W - 40,
    y: rand(140, 220),
    vx: (fromLeft ? 1 : -1) * rand(2.2, 3.4),
    vy: rand(-4.5, -3),
    variant: PELMEN_VARIANTS[Math.floor(Math.random() * PELMEN_VARIANTS.length)],
    clicks: 0,
    angle: rand(-0.3, 0.3),
    angVel: rand(-SPIN_IDLE, SPIN_IDLE),
  };
}

function spawnPickup(s: GameState, kind: 'heal' | 'star'): void {
  const fromLeft = Math.random() < 0.5;
  s.pickups.push({
    kind,
    x: fromLeft ? -40 : ARCADE_W + 40,
    y: rand(90, 250),
    vx: fromLeft ? PICKUP_SPEED : -PICKUP_SPEED,
  });
}

function triggerDebuff(s: GameState, hooks: UpdateHooks): void {
  const roll = Math.random();
  const kind: DebuffKind = roll < 0.34 ? 'error' : roll < 0.67 ? 'flash' : 'tremor';
  if (kind === 'error') {
    const w = 300;
    const h = 172;
    const x = rand(16, ARCADE_W - w - 16);
    const y = rand(46, ARCADE_H - h - 70);
    s.errorBox = { x, y, w, h, variant: 1 + Math.floor(Math.random() * ERROR_VARIANTS) };
    s.debuff = { kind, until: s.nowMs + DEBUFF_ERROR_MS };
  } else if (kind === 'flash') {
    s.flashStart = s.nowMs;
    s.debuff = { kind, until: s.nowMs + FLASH_TOTAL_MS };
    hooks.sfx('flash');
  } else {
    s.debuff = { kind, until: s.nowMs + DEBUFF_TREMOR_MS };
  }
}

/** Простой клик (спека v1.4): импульс бутылкам в фиксированном радиусе точки. Приоритет —
 *  клик по бутылке над кнопкой OK окна ошибки (окно само закроется через 3с). */
function handleClick(s: GameState, px: number, py: number, hooks: UpdateHooks): void {
  s.hitFx = { x: px, y: py, r: HIT_RADIUS, until: s.nowMs + HITRING_MS };

  const bw = BOTTLE_BASE_H * PEVKO_RATIO;
  const reach = HIT_RADIUS + bw / 2;

  // Бутылки — все в радиусе (приоритет над OK).
  let hitAnyBottle = false;
  for (const b of s.bottles) {
    const dx = px - b.x;
    const dy = py - b.y;
    if (dx * dx + dy * dy <= reach * reach) {
      b.vy = CLICK_VY;
      b.vx = (-dx / (bw / 2)) * CLICK_VX_MAX;
      b.angVel += (dx / (bw / 2)) * SPIN_ON_HIT + rand(-0.03, 0.03);
      b.hitAt = s.nowMs;
      s.score += b.golden ? SCORE_GOLDEN : SCORE_PER_CLICK;
      hitAnyBottle = true;
    }
  }
  if (hitAnyBottle) hooks.sfx('bounce');

  // Пикапы — сбор при попадании в радиус.
  s.pickups = s.pickups.filter((p) => {
    const dx = px - p.x;
    const dy = py - p.y;
    if (dx * dx + dy * dy <= PICKUP_HIT * PICKUP_HIT) {
      if (p.kind === 'heal') s.hp += 1; // оверхил без потолка (спека §2)
      else s.starUntil = s.nowMs + BUFF_STAR_MS;
      hooks.sfx('powerup');
      return false;
    }
    return true;
  });

  // Пельмень.
  if (s.pelmen) {
    const pl = s.pelmen;
    const dx = px - pl.x;
    const dy = py - pl.y;
    if (dx * dx + dy * dy <= PELMEN_HIT * PELMEN_HIT) {
      pl.vy = CLICK_VY;
      pl.vx = (-dx / PELMEN_HIT) * CLICK_VX_MAX;
      pl.angVel += (dx / PELMEN_HIT) * SPIN_ON_HIT;
      pl.clicks += 1;
      if (pl.clicks >= PELMEN_TARGET) {
        removeOrdinaryBottle(s);
        // Сброс сложности на ПРЕДЫДУЩУЮ стадию +1с (спека §4: 03:48→02:31): реальный откат на
        // минуту вниз, приземляемся на 1с внутри стадии, чтобы спавн на границе не триггерился.
        s.gameMs = Math.max(0, stageStartMs(s.gameMs) - STAGE_STEP_MS + 1000);
        s.nextBottleAt = s.nowMs + BOTTLE_SPAWN_SPACING_MS;
        s.pelmen = null;
        s.nextPelmenAt = s.nowMs + PELMEN_SPAWN_MS;
        hooks.sfx('powerup');
      } else {
        hooks.sfx('bounce');
      }
    }
  }

  // OK/окно ошибки: закрыть, ТОЛЬКО если клик попал в окно и НИ ОДНА бутылка не подбита.
  if (!hitAnyBottle && s.debuff?.kind === 'error' && s.errorBox) {
    const b = s.errorBox;
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
      s.debuff = null;
      s.errorBox = null;
      hooks.sfx('bounce');
    }
  }
}

/** Убрать 1 ОБЫЧНУЮ бутылку, золотую беречь (спека §4). Если все золотые — убрать последнюю. */
function removeOrdinaryBottle(s: GameState): void {
  for (let i = s.bottles.length - 1; i >= 0; i--) {
    if (!s.bottles[i].golden) {
      s.bottles.splice(i, 1);
      return;
    }
  }
  if (s.bottles.length > 0) s.bottles.pop();
}

function stepPhysics(s: GameState, hooks: UpdateHooks): void {
  s.gameMs += STEP_MS;
  s.nowMs += STEP_MS;

  const bh = BOTTLE_BASE_H;
  const bw = bh * PEVKO_RATIO;
  const g = GRAVITY * (starActive(s) ? STAR_FALL_FACTOR : 1); // звезда замедляет падение

  // Бутылки.
  for (const b of s.bottles) {
    b.vy += g;
    b.x += b.vx;
    b.y += b.vy;
    b.angle += b.angVel;
    b.angVel *= SPIN_DAMP;
    if (b.x - bw / 2 < 0) {
      b.x = bw / 2;
      b.vx = Math.abs(b.vx) * WALL_BOUNCE;
      b.angVel *= 0.7;
    } else if (b.x + bw / 2 > ARCADE_W) {
      b.x = ARCADE_W - bw / 2;
      b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
      b.angVel *= 0.7;
    }
  }
  const kept = s.bottles.filter((b) => b.y - bh / 2 <= ARCADE_H);
  const fallen = s.bottles.length - kept.length;
  s.bottles = kept;
  if (fallen > 0) {
    s.hp -= fallen;
    s.sparkUntil = s.nowMs + SPARK_MS;
    hooks.sfx('thud');
    if (s.hp <= 0) {
      s.hp = 0;
      s.phase = 'over';
      return;
    }
  }

  // Пельмень (гравитация не замедляется звездой — это отдельный объект).
  if (s.pelmen) {
    const pl = s.pelmen;
    pl.vy += GRAVITY;
    pl.x += pl.vx;
    pl.y += pl.vy;
    pl.angle += pl.angVel;
    pl.angVel *= SPIN_DAMP;
    const r = 48;
    if (pl.x - r < 0) {
      pl.x = r;
      pl.vx = Math.abs(pl.vx) * WALL_BOUNCE;
      pl.angVel *= 0.7;
    } else if (pl.x + r > ARCADE_W) {
      pl.x = ARCADE_W - r;
      pl.vx = -Math.abs(pl.vx) * WALL_BOUNCE;
      pl.angVel *= 0.7;
    }
    if (pl.y - r > ARCADE_H) s.pelmen = null; // упал — потерян без эффекта
  }

  // Пикапы летят горизонтально.
  for (const p of s.pickups) p.x += p.vx;
  s.pickups = s.pickups.filter((p) => p.x > -60 && p.x < ARCADE_W + 60);

  // ─── Спавны ───
  const target = bottlesAt(s.gameMs);
  if (s.bottles.length < target && s.nowMs >= s.nextBottleAt) {
    spawnBottle(s);
    s.nextBottleAt = s.nowMs + BOTTLE_SPAWN_SPACING_MS;
  }
  if (!s.pelmen && target >= PELMEN_MIN_BOTTLES && s.nowMs >= s.nextPelmenAt) {
    spawnPelmen(s);
    s.nextPelmenAt = s.nowMs + PELMEN_SPAWN_MS;
  }
  if (s.nowMs >= s.nextHealAt) {
    spawnPickup(s, 'heal'); // оверхил: спавним всегда по таймеру
    s.nextHealAt = s.nowMs + HEAL_SPAWN_MS;
  }
  if (!starActive(s) && s.nowMs >= s.nextStarAt) {
    spawnPickup(s, 'star');
    s.nextStarAt = s.nowMs + STAR_SPAWN_MS;
  }
  if (!s.debuff && !starActive(s) && s.nowMs >= s.nextDebuffAt) {
    triggerDebuff(s, hooks);
    s.nextDebuffAt = s.nowMs + DEBUFF_MIN_INTERVAL_MS * rand(0.85, 1.5);
  }

  // Истечение дебаффа.
  if (s.debuff && s.nowMs >= s.debuff.until) {
    s.debuff = null;
    s.errorBox = null;
    s.flashStart = -1;
  }
}

/** Один кадр: клик-edge (простой клик) + фиксированные шаги физики. */
export function updateFrame(s: GameState, input: ArcadeInput, dtMs: number, acc: { v: number }, hooks: UpdateHooks): void {
  const p = input.pointer;
  const cx = p ? p.x : ARCADE_W / 2;
  const cy = p ? p.y : ARCADE_H / 2;
  const down = !!p?.down;
  const pressed = down && !s.prevDown;
  s.prevDown = down;

  if (s.phase === 'idle' || s.phase === 'over') {
    if (pressed) startRun(s);
    return;
  }

  if (s.phase !== 'playing') return;

  if (pressed) handleClick(s, cx, cy, hooks);

  acc.v += Math.min(dtMs, 100);
  while (acc.v >= STEP_MS && s.phase === 'playing') {
    stepPhysics(s, hooks);
    acc.v -= STEP_MS;
  }
  // stepPhysics мог перевести в 'over' (мутация через ссылку — TS не видит, приводим тип).
  if ((s.phase as Phase) === 'over') hooks.onGameOver(s.score);
}
