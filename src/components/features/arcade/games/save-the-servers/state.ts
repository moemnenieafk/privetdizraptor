// Движок game01 «Спаси сервера»: состояние + обновление. Чистая логика, без рисования.
// Физика на фиксированном шаге 60 Гц; клик-edge детектится на уровне кадра (см. index.ts).

import type { ArcadeInput } from '../../types';
import { ARCADE_W, ARCADE_H } from '../../types';
import {
  GRAVITY,
  CLICK_VY,
  CLICK_VY_MAX,
  CLICK_VX_MAX,
  WALL_BOUNCE,
  CHARGE_MS,
  SWING_MIN,
  HIT_CD_MS,
  HIT_RADIUS,
  SPIN_IDLE,
  SPIN_ON_HIT,
  SPIN_DAMP,
  HITRING_MS,
  BOTTLE_BASE_H,
  BOTTLE_SHRINK_TO,
  BOTTLE_SHRINK_MS,
  GOLDEN_CHANCE,
  HP_MAX,
  HP_START,
  bottlesAt,
  stageStartMs,
  PELMEN_MIN_BOTTLES,
  PELMEN_TARGET,
  PELMEN_SPAWN_MS,
  PELMEN_VARIANTS,
  PELMEN_HIT,
  PICKUP_HIT,
  DEBUFF_ERROR_MS,
  DEBUFF_FLASH_MS,
  DEBUFF_TREMOR_MS,
  DEBUFF_MIN_INTERVAL_MS,
  BUFF_STAR_MS,
  BUFF_STAR_SCALE,
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
  hitCdUntil: number; // кулдаун повторного удара в рамках одного свипа
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
  hitCdUntil: number;
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
  okX: number;
  okY: number;
  okW: number;
  okH: number;
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
  lastPx: number; // курсор в прошлом кадре — для свипа взмаха
  lastPy: number;
  holdMs: number; // сколько удерживается ЛКМ (заряд)
  charge: number; // 0..1 — нормализованный заряд (для рендера)
  starUntil: number;
  debuff: Debuff | null;
  errorBox: ErrorBox | null;
  flashUntil: number;
  sparkUntil: number;
  hitRadius: number; // радиус попадания от тира оружия (ставит index.ts на старте)
  hitFx: HitFx | null;
  nextBottleAt: number;
  nextPelmenAt: number;
  nextHealAt: number;
  nextStarAt: number;
  nextDebuffAt: number;
}

export type GameSound = 'bounce' | 'thud' | 'powerup' | 'alarm' | 'burst';

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
    lastPx: ARCADE_W / 2,
    lastPy: ARCADE_H / 2,
    holdMs: 0,
    charge: 0,
    starUntil: -1,
    debuff: null,
    errorBox: null,
    flashUntil: -1,
    sparkUntil: -1,
    hitRadius: HIT_RADIUS,
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

/** Текущий масштаб бутылки: разгонная усадка × бафф «Золотая Звезда». */
export function bottleScaleNow(s: GameState): number {
  const k = Math.min(1, s.gameMs / BOTTLE_SHRINK_MS);
  const ramp = 1 - (1 - BOTTLE_SHRINK_TO) * k;
  return ramp * (starActive(s) ? BUFF_STAR_SCALE : 1);
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
  s.holdMs = 0;
  s.charge = 0;
  s.starUntil = -1;
  s.debuff = null;
  s.errorBox = null;
  s.flashUntil = -1;
  s.sparkUntil = -1;
  s.hitFx = null;
  // hitRadius НЕ сбрасываем к базе тут — его ставит index.ts по тиру скина на входе в playing.
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
    hitCdUntil: -1,
  });
}

function spawnPelmen(s: GameState): void {
  s.pelmen = {
    x: rand(ARCADE_W * 0.3, ARCADE_W * 0.7),
    y: 80,
    vx: rand(-1.5, 1.5),
    vy: 0,
    variant: PELMEN_VARIANTS[Math.floor(Math.random() * PELMEN_VARIANTS.length)],
    clicks: 0,
    angle: rand(-0.3, 0.3),
    angVel: rand(-SPIN_IDLE, SPIN_IDLE),
    hitCdUntil: -1,
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
    const h = 120;
    const x = (ARCADE_W - w) / 2;
    const y = (ARCADE_H - h) / 2;
    const okW = 84;
    const okH = 34;
    s.errorBox = { x, y, w, h, okX: x + w - okW - 16, okY: y + h - okH - 14, okW, okH };
    s.debuff = { kind, until: s.nowMs + DEBUFF_ERROR_MS };
  } else if (kind === 'flash') {
    s.flashUntil = s.nowMs + DEBUFF_FLASH_MS;
    s.debuff = { kind, until: s.nowMs + DEBUFF_FLASH_MS };
    hooks.sfx('alarm');
  } else {
    s.debuff = { kind, until: s.nowMs + DEBUFF_TREMOR_MS };
  }
}

/** Квадрат расстояния от точки (cx,cy) до отрезка (x0,y0)-(x1,y1). */
function segDist2(cx: number, cy: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((cx - x0) * dx + (cy - y0) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = cx - (x0 + t * dx);
  const ey = cy - (y0 + t * dy);
  return ex * ex + ey * ey;
}

/** Взмах: свип отрезком прошлый→текущий курсор. Бьёт ВСЕ задетые объекты (кулдаун на объект).
 *  Сила удара — от заряда (зажатие ЛКМ): чем больше charge, тем выше подлёт бутылки. */
function handleSwing(s: GameState, x0: number, y0: number, x1: number, y1: number, hooks: UpdateHooks): void {
  // OK по окну ошибки (по конечной точке взмаха) закрывает дебафф.
  if (s.debuff?.kind === 'error' && s.errorBox) {
    const b = s.errorBox;
    if (x1 >= b.okX && x1 <= b.okX + b.okW && y1 >= b.okY && y1 <= b.okY + b.okH) {
      s.debuff = null;
      s.errorBox = null;
      hooks.sfx('bounce');
      return;
    }
  }

  // Кольцо-фидбэк радиуса на конце взмаха.
  s.hitFx = { x: x1, y: y1, r: s.hitRadius, until: s.nowMs + HITRING_MS };

  const launchVy = CLICK_VY + (CLICK_VY_MAX - CLICK_VY) * s.charge; // заряд усиливает подлёт
  const bw = BOTTLE_BASE_H * bottleScaleNow(s) * PEVKO_RATIO;

  // Пикапы — сбор при пересечении свипом.
  s.pickups = s.pickups.filter((p) => {
    if (segDist2(p.x, p.y, x0, y0, x1, y1) <= PICKUP_HIT * PICKUP_HIT) {
      if (p.kind === 'heal') s.hp = Math.min(HP_MAX, s.hp + 1);
      else s.starUntil = s.nowMs + BUFF_STAR_MS;
      hooks.sfx('powerup');
      return false;
    }
    return true;
  });

  // Пельмень.
  if (s.pelmen && s.nowMs >= s.pelmen.hitCdUntil && segDist2(s.pelmen.x, s.pelmen.y, x0, y0, x1, y1) <= PELMEN_HIT * PELMEN_HIT) {
    const pl = s.pelmen;
    const off = x1 - pl.x;
    pl.vy = launchVy;
    pl.vx = (-off / PELMEN_HIT) * CLICK_VX_MAX;
    pl.angVel += (off / PELMEN_HIT) * SPIN_ON_HIT;
    pl.clicks += 1;
    pl.hitCdUntil = s.nowMs + HIT_CD_MS;
    if (pl.clicks >= PELMEN_TARGET) {
      if (s.bottles.length > 0) s.bottles.pop();
      s.gameMs = stageStartMs(s.gameMs);
      s.pelmen = null;
      s.nextPelmenAt = s.nowMs + PELMEN_SPAWN_MS;
      hooks.sfx('powerup');
    } else {
      hooks.sfx('bounce');
    }
  }

  // Бутылки — ВСЕ задетые свипом (кулдаун на объект, чтобы один взмах не бил дважды).
  const reach = s.hitRadius + bw / 2;
  let hitAny = false;
  for (const b of s.bottles) {
    if (s.nowMs < b.hitCdUntil) continue;
    if (segDist2(b.x, b.y, x0, y0, x1, y1) <= reach * reach) {
      const off = x1 - b.x;
      b.vy = launchVy;
      b.vx = (-off / (bw / 2)) * CLICK_VX_MAX;
      b.angVel += (off / (bw / 2)) * SPIN_ON_HIT + rand(-0.03, 0.03);
      b.hitAt = s.nowMs;
      b.hitCdUntil = s.nowMs + HIT_CD_MS;
      s.score += b.golden ? SCORE_GOLDEN : SCORE_PER_CLICK;
      hitAny = true;
    }
  }
  if (hitAny) hooks.sfx('bounce');
}

function stepPhysics(s: GameState, hooks: UpdateHooks): void {
  s.gameMs += STEP_MS;
  s.nowMs += STEP_MS;

  const bh = BOTTLE_BASE_H * bottleScaleNow(s);
  const bw = bh * PEVKO_RATIO;

  // Бутылки.
  for (const b of s.bottles) {
    b.vy += GRAVITY;
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

  // Пельмень.
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
    if (s.hp < HP_MAX) spawnPickup(s, 'heal');
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
  }
}

/** Один кадр: заряд (зажатие ЛКМ) + детект взмаха (свип) + фиксированные шаги физики. */
export function updateFrame(s: GameState, input: ArcadeInput, dtMs: number, acc: { v: number }, hooks: UpdateHooks): void {
  const p = input.pointer;
  const cx = p ? p.x : s.lastPx;
  const cy = p ? p.y : s.lastPy;
  const down = !!p?.down;
  const pressed = down && !s.prevDown;

  if (s.phase === 'idle' || s.phase === 'over') {
    if (pressed) startRun(s);
    s.prevDown = down;
    s.lastPx = cx;
    s.lastPy = cy;
    s.holdMs = 0;
    s.charge = 0;
    return;
  }

  if (s.phase !== 'playing') return;

  // Заряд от удержания ЛКМ.
  s.holdMs = down ? s.holdMs + dtMs : 0;
  s.charge = Math.min(1, s.holdMs / CHARGE_MS);

  // Взмах: свип, если нажато И (первое нажатие ИЛИ курсор сместился достаточно).
  if (down) {
    const moved = Math.hypot(cx - s.lastPx, cy - s.lastPy);
    if (pressed || moved >= SWING_MIN) handleSwing(s, s.lastPx, s.lastPy, cx, cy, hooks);
  }

  s.prevDown = down;
  s.lastPx = cx;
  s.lastPy = cy;

  acc.v += Math.min(dtMs, 100);
  while (acc.v >= STEP_MS && s.phase === 'playing') {
    stepPhysics(s, hooks);
    acc.v -= STEP_MS;
  }
  // stepPhysics мог перевести в 'over' (мутация через ссылку — TS не видит, приводим тип).
  if ((s.phase as Phase) === 'over') hooks.onGameOver(s.score);
}
