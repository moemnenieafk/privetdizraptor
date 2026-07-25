// Сборка модуля game02 «Три в ряд»: движок + рендер + спрайты + экономика.

import type { ArcadeGame } from '../../types';
import { useMatch3Store } from '@/store/useMatch3Store';
import { useArcadeStore } from '@/store/useArcadeStore';
import { playSfx, type SfxName } from '@/lib/sfx';
import { SpriteCache } from '../../sprites';
import { createLevelState, updateFrame, type Match3State, type Match3Hooks } from './state';
import { draw } from './render';
import { COLORS, TOOLS, itemSrc } from './config';

const SPECIALS = ['rshg-horizontal', 'rshg-vertical', 'zaryad', 'rgo', 'kerman'] as const;

export function createGame(): ArcadeGame {
  const sprites = new SpriteCache();
  const state: Match3State = createLevelState(useMatch3Store.getState().currentLevel);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ready = false;

  const sfx = (n: SfxName) => {
    if (!useArcadeStore.getState().muted) playSfx(n);
  };

  const hooks: Match3Hooks = {
    sfx,
    addRubles: (n) => useMatch3Store.getState().addRubles(n),
    getWallet: () => useMatch3Store.getState().rubles,
    spendWallet: (n) => useMatch3Store.getState().spendRubles(n),
    spendEnergy: () => useMatch3Store.getState().spendEnergy(),
  };

  return {
    id: 'tarkov-match3',
    title: 'Три в ряд',
    logo: 'ТРИ В РЯД',

    init() {
      if (typeof document !== 'undefined' && 'fonts' in document) {
        void document.fonts.load('20px "BlenderPro-Medium"');
      }
      const list = [...COLORS, ...SPECIALS, ...TOOLS, 'wood'].map((n) => itemSrc(n));
      void sprites.load(list).then(() => {
        ready = true;
        if (state.phase === 'loading') state.phase = 'brief';
      });
    },

    frame({ ctx, input }, dtMs) {
      updateFrame(state, input, dtMs, hooks);
      const store = useMatch3Store.getState();
      if (state.levelIndex !== store.currentLevel) store.setLevel(state.levelIndex);
      draw(ctx, sprites, state, { wallet: store.rubles, energy: store.syncEnergy(), reducedMotion }, ready);
    },

    dispose() {},
  };
}
