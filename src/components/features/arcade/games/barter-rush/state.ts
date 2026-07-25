// Движок game03 «Прибыль бартера». Оцени сделку на глаз (свайп ←/→ или кнопки Мимо/Выгода),
// таймер на решение, 3 жизни, комбо-мультипликатор. Вердикт уже посчитан на сервере (RushCard).

import type { ArcadeInput } from '../../types';
import type { SfxName } from '@/lib/sfx';
import type { RushCard } from '@/lib/eft-barter-rush';
import type { BarterVerdict } from '@/types/barter';
import {
  DECK_SIZE,
  LIVES,
  CARD_TIME_MS,
  FAST_ELAPSED_MS,
  REVEAL_MS,
  SWIPE_THRESHOLD,
  POINTS_BASE,
  FAST_BONUS,
  comboMult,
  BTN,
} from './config';

export type Phase = 'loading' | 'empty' | 'brief' | 'playing' | 'reveal' | 'over';

export interface RushResult {
  correct: boolean;
  bet: boolean | null; // null = таймаут
  verdict: BarterVerdict;
  netProfit: number;
  roi: number;
  points: number;
  mult: number;
  fast: boolean;
  timeout: boolean;
}

export interface RushHooks {
  sfx: (n: SfxName) => void;
  record: (i: { correct: boolean; combo: number; score: number }) => void;
  best: () => number;
}

export interface RushState {
  phase: Phase;
  all: RushCard[];
  deck: RushCard[];
  index: number;
  score: number;
  combo: number;
  lives: number;
  timeLeft: number;
  result: RushResult | null;
  revealUntil: number;
  dx: number;
  dragStartX: number;
  dragging: boolean;
  prevDown: boolean;
  nowMs: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Сбалансированная колода: чередуем выгодные и невыгодные, чтобы угадывание было неочевидным.
function buildDeck(all: RushCard[]): RushCard[] {
  const good = shuffle(all.filter((c) => c.verdict === 'profitable'));
  const bad = shuffle(all.filter((c) => c.verdict !== 'profitable'));
  if (!good.length || !bad.length) return shuffle(all).slice(0, DECK_SIZE);
  const merged: RushCard[] = [];
  const max = Math.max(good.length, bad.length);
  for (let i = 0; i < max; i++) {
    if (i < good.length) merged.push(good[i]);
    if (i < bad.length) merged.push(bad[i]);
  }
  return merged.slice(0, DECK_SIZE);
}

export function createState(all: RushCard[]): RushState {
  return {
    phase: 'loading',
    all,
    deck: buildDeck(all),
    index: 0,
    score: 0,
    combo: 0,
    lives: LIVES,
    timeLeft: CARD_TIME_MS,
    result: null,
    revealUntil: 0,
    dx: 0,
    dragStartX: 0,
    dragging: false,
    prevDown: false,
    nowMs: 0,
  };
}

export function currentCard(s: RushState): RushCard | null {
  return s.deck[s.index] ?? null;
}

function reveal(s: RushState, result: RushResult, hooks: RushHooks): void {
  s.result = result;
  s.phase = 'reveal';
  s.revealUntil = s.nowMs + REVEAL_MS;
  s.dx = 0;
  s.dragging = false;
  hooks.record({ correct: result.correct, combo: s.combo, score: s.score });
}

function guess(s: RushState, bet: boolean, hooks: RushHooks): void {
  const c = currentCard(s);
  if (!c) return;
  const isProfit = c.verdict === 'profitable';
  const correct = isProfit === bet;
  const elapsed = CARD_TIME_MS - s.timeLeft;
  const fast = correct && elapsed < FAST_ELAPSED_MS;
  const mult = comboMult(s.combo);
  const points = correct ? POINTS_BASE * mult + (fast ? FAST_BONUS : 0) : 0;

  s.score += points;
  s.combo = correct ? s.combo + 1 : 0;
  if (!correct) s.lives -= 1;

  if (!correct) hooks.sfx('tick');
  else if (mult >= 3) hooks.sfx('rank-up');
  else hooks.sfx('coins');

  reveal(s, { correct, bet, verdict: c.verdict, netProfit: c.netProfit, roi: c.roi, points, mult: correct ? mult : 0, fast, timeout: false }, hooks);
}

function timeoutTurn(s: RushState, hooks: RushHooks): void {
  const c = currentCard(s);
  if (!c) return;
  s.combo = 0;
  s.lives -= 1;
  hooks.sfx('tick');
  reveal(s, { correct: false, bet: null, verdict: c.verdict, netProfit: c.netProfit, roi: c.roi, points: 0, mult: 0, fast: false, timeout: true }, hooks);
}

function nextCard(s: RushState, hooks: RushHooks): void {
  if (s.lives <= 0) {
    s.phase = 'over';
    hooks.sfx('burst');
    return;
  }
  const ni = s.index + 1;
  if (ni >= s.deck.length) {
    s.deck = buildDeck(s.all);
    s.index = 0;
  } else {
    s.index = ni;
  }
  s.phase = 'playing';
  s.timeLeft = CARD_TIME_MS;
  s.result = null;
  s.dx = 0;
}

function startRun(s: RushState): void {
  s.phase = 'playing';
  s.timeLeft = CARD_TIME_MS;
}

function restart(s: RushState): void {
  s.deck = buildDeck(s.all);
  s.index = 0;
  s.score = 0;
  s.combo = 0;
  s.lives = LIVES;
  s.timeLeft = CARD_TIME_MS;
  s.result = null;
  s.dx = 0;
  s.phase = 'playing';
}

function inBtn(x: number, y: number, b: { x: number; w: number }): boolean {
  return x >= b.x && x <= b.x + b.w && y >= BTN.y && y <= BTN.y + BTN.h;
}

export function updateFrame(s: RushState, input: ArcadeInput, dtMs: number, hooks: RushHooks): void {
  s.nowMs += dtMs;
  const p = input.pointer;
  const down = !!p?.down;
  const pressed = down && !s.prevDown;
  const released = !down && s.prevDown;
  s.prevDown = down;

  if (s.phase === 'loading' || s.phase === 'empty') return;
  if (!p) return;

  if (s.phase === 'brief') {
    if (pressed) startRun(s);
    return;
  }
  if (s.phase === 'over') {
    if (pressed) restart(s);
    return;
  }
  if (s.phase === 'reveal') {
    if (pressed || s.nowMs >= s.revealUntil) nextCard(s, hooks);
    return;
  }

  // playing
  s.timeLeft -= dtMs;
  if (s.timeLeft <= 0) {
    timeoutTurn(s, hooks);
    return;
  }

  if (pressed) {
    s.dragStartX = p.x;
    s.dragging = true;
    s.dx = 0;
  }
  if (down && s.dragging) {
    s.dx = Math.max(-170, Math.min(170, p.x - s.dragStartX));
  }
  if (released && s.dragging) {
    s.dragging = false;
    if (s.dx > SWIPE_THRESHOLD) guess(s, true, hooks);
    else if (s.dx < -SWIPE_THRESHOLD) guess(s, false, hooks);
    else if (inBtn(p.x, p.y, BTN.mimo)) guess(s, false, hooks);
    else if (inBtn(p.x, p.y, BTN.vygoda)) guess(s, true, hooks);
    else s.dx = 0;
  }
}
