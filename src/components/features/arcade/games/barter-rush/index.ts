// Сборка game03 «Прибыль бартера»: движок + рендер + спрайты + рекорды (общий useBarterRushStore).

import type { ArcadeGame, ArcadeGameData } from '../../types';
import { useArcadeStore } from '@/store/useArcadeStore';
import { useBarterRushStore } from '@/store/useBarterRushStore';
import { playSfx, type SfxName } from '@/lib/sfx';
import type { RushCard } from '@/lib/eft-barter-rush';
import { SpriteCache } from '../../sprites';
import { createState, updateFrame, type RushState, type RushHooks } from './state';
import { draw } from './render';
import { TRADER_IMG, ASSET_AHEAD, cardIconSrcs } from './config';

export function createGame(data?: ArcadeGameData): ArcadeGame {
  const sprites = new SpriteCache();
  const deck: RushCard[] = [...(data?.barterDeck ?? [])];
  const state: RushState = createState(deck);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ready = false;
  let lastIndex = -1;

  const sfx = (n: SfxName) => {
    if (!useArcadeStore.getState().muted) playSfx(n);
  };
  const hooks: RushHooks = {
    sfx,
    record: (i) => useBarterRushStore.getState().recordRound(i),
    best: () => useBarterRushStore.getState().bestScore,
  };

  // Иконки предметов для карт [from..from+AHEAD]. URL уже проксирован через /_next/image
  // (same-origin) — crossOrigin не нужен. SpriteCache пропускает загруженные, вызовы дёшевы.
  const ensureIcons = (from: number) => {
    const srcs: string[] = [];
    for (let i = from; i <= from + ASSET_AHEAD && i < state.deck.length; i++) {
      srcs.push(...cardIconSrcs(state.deck[i]));
    }
    if (srcs.length) void sprites.load(srcs);
  };

  return {
    id: 'barter-rush',
    title: 'Прибыль бартера',
    logo: 'ПРИБЫЛЬ БАРТЕРА',

    init() {
      if (typeof document !== 'undefined' && 'fonts' in document) {
        void document.fonts.load('20px "BlenderPro-Medium"');
      }
      void useBarterRushStore.persist.rehydrate();
      if (deck.length === 0) {
        state.phase = 'empty';
        ready = true;
        return;
      }
      const traders = [...new Set(deck.map((c) => TRADER_IMG(c.traderNorm)))];
      const firstIcons: string[] = [];
      for (let i = 0; i <= ASSET_AHEAD && i < deck.length; i++) firstIcons.push(...cardIconSrcs(deck[i]));
      // Портреты и иконки — same-origin (/_next/image), crossOrigin не нужен.
      Promise.all([sprites.load(traders), sprites.load(firstIcons)]).then(() => {
        ready = true;
        if (state.phase === 'loading') state.phase = 'brief';
      });
    },

    frame({ ctx, input }, dtMs) {
      updateFrame(state, input, dtMs, hooks);
      if (ready && state.index !== lastIndex) {
        lastIndex = state.index;
        ensureIcons(state.index);
      }
      draw(ctx, sprites, state, { best: hooks.best(), reducedMotion }, ready);
    },

    dispose() {},
  };
}
