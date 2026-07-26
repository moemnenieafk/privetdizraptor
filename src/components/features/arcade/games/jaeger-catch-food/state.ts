// Движок game04 «Егерь ловит покушать». Простая пошаговая логика по dt (без фикс-степа):
// предметы едут t:0→1 по скату; на t≥1 — резолв ловли/промаха. Клавиши + тап по квадранту.

import type { ArcadeInput } from '../../types';
import {
  POSITIONS,
  RAMPS,
  JAEGER_CX,
  LOOT,
  type Pos,
  type ItemKind,
  SCORE_NORMAL,
  SCORE_BTC,
  GRENADE_CHANCE,
  BTC_MIN,
  BTC_MAX,
  MAX_MISSES,
  rollMsFor,
  concurrencyFor,
  SPAWN_STAGGER_MS,
  KEY_MAP,
} from './config';

export type Phase = 'loading' | 'idle' | 'playing' | 'over';

export interface FallItem {
  ramp: Pos;
  kind: ItemKind;
  t: number; // 0 (верх ската) → 1 (у корзины)
  rollMs: number;
}

export interface CatchFx {
  pos: Pos;
  until: number;
  good: boolean;
}

export interface JaegerState {
  phase: Phase;
  basket: Pos;
  items: FallItem[];
  score: number;
  misses: number;
  nowMs: number;
  nextSpawnAt: number;
  btcCountdown: number; // спавнов до следующего биткоина
  prevDown: boolean;
  catchFx: CatchFx | null;
}

export type JaegerSound = 'catch' | 'coin' | 'miss' | 'over';
export interface JaegerHooks {
  sfx: (s: JaegerSound) => void;
  onGameOver: (score: number) => void;
}

function randInt(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function createState(): JaegerState {
  return {
    phase: 'loading',
    basket: 'dl',
    items: [],
    score: 0,
    misses: 0,
    nowMs: 0,
    nextSpawnAt: 0,
    btcCountdown: randInt(BTC_MIN, BTC_MAX),
    prevDown: false,
    catchFx: null,
  };
}

export function startRun(s: JaegerState): void {
  s.phase = 'playing';
  s.basket = 'dl';
  s.items = [];
  s.score = 0;
  s.misses = 0;
  s.nowMs = 0;
  s.nextSpawnAt = 500;
  s.btcCountdown = randInt(BTC_MIN, BTC_MAX);
  s.catchFx = null;
}

function spawnItem(s: JaegerState): void {
  const ramp = POSITIONS[randInt(0, POSITIONS.length - 1)];
  let kind: ItemKind;
  s.btcCountdown -= 1;
  if (s.btcCountdown <= 0) {
    kind = 'btc';
    s.btcCountdown = randInt(BTC_MIN, BTC_MAX);
  } else if (Math.random() < GRENADE_CHANCE) {
    kind = 'm67';
  } else {
    kind = LOOT[randInt(0, LOOT.length - 1)];
  }
  s.items.push({ ramp, kind, t: 0, rollMs: rollMsFor(s.score) });
}

/** Начислить очки + цикличный сброс промахов (GDD §5): кратное 100 → все, кратное 50 → −1. */
function addScore(s: JaegerState, delta: number): void {
  const before = s.score;
  s.score += delta;
  for (let m = Math.floor(before / 50) * 50 + 50; m <= s.score; m += 50) {
    if (m % 100 === 0) s.misses = 0;
    else s.misses = Math.max(0, s.misses - 1);
  }
}

function addMiss(s: JaegerState, pos: Pos, hooks: JaegerHooks): void {
  s.misses += 1;
  s.catchFx = { pos, until: s.nowMs + 300, good: false };
  if (s.misses >= MAX_MISSES) {
    s.phase = 'over';
    hooks.sfx('over');
    hooks.onGameOver(s.score);
  } else {
    hooks.sfx('miss');
  }
}

function resolveItem(s: JaegerState, it: FallItem, hooks: JaegerHooks): void {
  const caught = s.basket === it.ramp;
  if (it.kind === 'm67') {
    // Граната: поймал — штраф; пропустил — безопасно.
    if (caught) addMiss(s, it.ramp, hooks);
    return;
  }
  if (caught) {
    addScore(s, it.kind === 'btc' ? SCORE_BTC : SCORE_NORMAL);
    s.catchFx = { pos: it.ramp, until: s.nowMs + 300, good: true };
    hooks.sfx(it.kind === 'btc' ? 'coin' : 'catch');
  } else {
    addMiss(s, it.ramp, hooks); // уронил лут — промах
  }
}

function keyPos(keys: ReadonlySet<string>): Pos | null {
  if (keys.size === 0) return null;
  const lower = new Set<string>();
  for (const k of keys) lower.add(k.toLowerCase());
  for (const pos of POSITIONS) if (KEY_MAP[pos].some((k) => lower.has(k))) return pos;
  return null;
}

function quadrant(px: number, py: number): Pos {
  const up = py < 294; // между верхними (250) и нижними (338) точками ловли
  const left = px < JAEGER_CX;
  return left ? (up ? 'ul' : 'dl') : up ? 'ur' : 'dr';
}

export function updateFrame(s: JaegerState, input: ArcadeInput, dtMs: number, hooks: JaegerHooks): void {
  s.nowMs += dtMs;
  const p = input.pointer;
  const down = !!p?.down;
  const pressed = down && !s.prevDown;
  s.prevDown = down;

  if (s.phase === 'loading') return;

  if (s.phase === 'idle' || s.phase === 'over') {
    if (pressed || keyPos(input.keys) !== null) startRun(s);
    return;
  }

  // playing — управление.
  const kp = keyPos(input.keys);
  if (kp) s.basket = kp;
  if (pressed && p) s.basket = quadrant(p.x, p.y);

  // Движение предметов + резолв.
  const still: FallItem[] = [];
  for (const it of s.items) {
    it.t += dtMs / it.rollMs;
    if (it.t >= 1) resolveItem(s, it, hooks);
    else still.push(it);
  }
  s.items = still;
  if ((s.phase as Phase) !== 'playing') return; // резолв мог завершить игру

  // Спавн: поддерживаем плотность по счёту, со стаггером.
  if (s.items.length < concurrencyFor(s.score) && s.nowMs >= s.nextSpawnAt) {
    spawnItem(s);
    s.nextSpawnAt = s.nowMs + SPAWN_STAGGER_MS;
  }
}

/** Позиция точки предмета на скате (для рендера). */
export function itemXY(it: FallItem): { x: number; y: number } {
  const r = RAMPS[it.ramp];
  return { x: r.sx + (r.cx - r.sx) * it.t, y: r.sy + (r.cy - r.sy) * it.t };
}
