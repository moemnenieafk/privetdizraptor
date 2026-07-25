import type { ArcadeGameFactory } from './types';

// Реестр подключаемых игр. Модули грузятся динамическим import() (client-only, бандл
// не тащит все игры сразу — хендофф §7). game02 = заглушка «Скоро» (ассеты есть, спеки нет).

export interface ArcadeGameMeta {
  readonly id: string;
  readonly title: string;
  /** Текст-лого для карточки (графических лого пока нет). */
  readonly logo: string;
  readonly tagline: string;
  readonly status: 'ready' | 'soon';
  readonly load?: () => Promise<ArcadeGameFactory>;
}

export const ARCADE_GAMES: readonly ArcadeGameMeta[] = [
  {
    id: 'save-the-servers',
    title: 'Спаси сервера',
    logo: 'СПАСИ\nСЕРВЕРА',
    tagline: 'Чеканка · не дай пиву затопить стойку',
    status: 'ready',
    load: () => import('./games/save-the-servers').then((m) => m.createGame),
  },
  {
    id: 'tarkov-match3',
    title: 'Три в ряд',
    logo: 'ТРИ В\nРЯД',
    tagline: 'Match-3 · заказы торговцев за ₽',
    status: 'ready',
    load: () => import('./games/tarkov-match3').then((m) => m.createGame),
  },
  {
    id: 'barter-rush',
    title: 'Прибыль бартера',
    logo: 'ПРИБЫЛЬ\nБАРТЕРА',
    tagline: 'Оцени сделку на глаз · свайп ← →',
    status: 'ready',
    load: () => import('./games/barter-rush').then((m) => m.createGame),
  },
];

export function gameMeta(id: string): ArcadeGameMeta | undefined {
  return ARCADE_GAMES.find((g) => g.id === id);
}

export const DEFAULT_GAME_ID = ARCADE_GAMES[0].id;
