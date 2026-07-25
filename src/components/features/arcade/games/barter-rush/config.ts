// Константы game03 «Прибыль бартера» (аркадный порт BarterRush): таймер + жизни, свайп-оценка.
import type { RushCard } from '@/lib/eft-barter-rush';

export const TRADER_IMG = (norm: string) => `/images/traders/eft/${norm}.webp`;

export const DECK_SIZE = 40;
export const LIVES = 3;
export const CARD_TIME_MS = 7000; // время на оценку одной сделки
export const FAST_ELAPSED_MS = 2200; // быстрый ответ → бонус
export const REVEAL_MS = 1700; // авто-переход после вскрытия
export const SWIPE_THRESHOLD = 66; // лог. px свайпа для засчёта
export const POINTS_BASE = 100;
export const FAST_BONUS = 40;
export const ASSET_AHEAD = 6; // предзагрузка иконок на N карт вперёд

export function comboMult(combo: number): number {
  return Math.min(5, 1 + Math.floor(combo / 3));
}

// Геометрия кнопок оценки (лог. 640×480) — общая для рендера и хит-теста ввода.
export const BTN = {
  y: 418,
  h: 50,
  mimo: { x: 40, w: 258 },
  vygoda: { x: 344, w: 258 },
} as const;

/** Src'ы иконок предметов карты (уже проксированы через /_next/image, same-origin). */
export function cardIconSrcs(card: RushCard): string[] {
  return [card.reward.img, ...card.required.map((r) => r.img)];
}
