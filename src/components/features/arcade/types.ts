// Контракт подключаемого игрового модуля аркады. Verbatim из хендоффа §7.
// Логическое разрешение у ВСЕХ игр — 640×480; масштабирование делает CSS/CRT-пасс.

export interface ArcadeInput {
  readonly keys: ReadonlySet<string>;
  readonly pointer: { readonly x: number; readonly y: number; readonly down: boolean } | null;
}

export interface ArcadeFrameContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: 640;
  readonly height: 480;
  readonly input: ArcadeInput;
}

export interface ArcadeGame {
  readonly id: string;
  readonly title: string;
  readonly logo: string;
  init(c: ArcadeFrameContext): void;
  frame(c: ArcadeFrameContext, dtMs: number): void;
  dispose(): void;
}

/** Опциональные серверные данные для игры (напр. колода бартеров для game03). */
export interface ArcadeGameData {
  readonly barterDeck?: readonly import('@/lib/eft-barter-rush').RushCard[];
}

/** Фабрика инстанса игры (per-mount состояние). Модуль игры экспортит именно её. */
export type ArcadeGameFactory = (data?: ArcadeGameData) => ArcadeGame;

export const ARCADE_W = 640 as const;
export const ARCADE_H = 480 as const;
