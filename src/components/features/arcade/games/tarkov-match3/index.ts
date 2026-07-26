// Сборка модуля game02 «Три в ряд» v0.3: движок + рендер + спрайты + экономика.

import type { ArcadeGame } from '../../types';
import { useMatch3Store } from '@/store/useMatch3Store';
import { useArcadeStore } from '@/store/useArcadeStore';
import { playSfx, type SfxName } from '@/lib/sfx';
import { SpriteCache } from '../../sprites';
import { createLevelState, updateFrame, type Match3State, type Match3Hooks } from './state';
import { draw } from './render';
import { COLORS, TOOLS, itemSrc, type ToolKind } from './config';

const SPECIALS = ['rshg-horizontal', 'rshg-vertical', 'zaryad', 'rgo', 'kerman'] as const;
const BLOCKS = ['wood', 'wood2', 'leaves'] as const;

export function createGame(): ArcadeGame {
  const sprites = new SpriteCache();
  const state: Match3State = createLevelState(useMatch3Store.getState().currentLevel);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ready = false;
  let resumed = false; // применили ли уровень из стора после (асинхронной) регидрации

  const sfx = (n: SfxName) => {
    if (!useArcadeStore.getState().muted) playSfx(n);
  };

  const hooks: Match3Hooks = {
    sfx,
    addRubles: (n) => useMatch3Store.getState().addRubles(n),
    getWallet: () => useMatch3Store.getState().rubles,
    spendWallet: (n) => useMatch3Store.getState().spendRubles(n),
    spendEnergy: () => useMatch3Store.getState().spendEnergy(),
    addStar: () => useMatch3Store.getState().addStar(),
    spendTool: (t) => useMatch3Store.getState().spendTool(t),
    toolCount: (t) => useMatch3Store.getState().tools[t] ?? 0,
  };

  return {
    id: 'tarkov-match3',
    title: 'Три в ряд',
    logo: 'ТРИ В РЯД',

    init() {
      if (typeof document !== 'undefined' && 'fonts' in document) {
        void document.fonts.load('20px "BlenderPro-Medium"');
      }
      void useMatch3Store.persist.rehydrate();
      const list = [...COLORS, ...SPECIALS, ...TOOLS, ...BLOCKS].map((n) => itemSrc(n));
      void sprites.load(list).then(() => {
        ready = true;
        if (state.phase === 'loading') state.phase = 'brief';
      });
    },

    frame({ ctx, input }, dtMs) {
      const store = useMatch3Store.getState();
      // Резюм на сохранённый уровень — однократно после (асинхронной) регидрации, до старта.
      if (!resumed && store._hasHydrated) {
        resumed = true;
        if (store.currentLevel !== state.levelIndex && (state.phase === 'brief' || state.phase === 'loading')) {
          const wasReady = state.phase !== 'loading';
          Object.assign(state, createLevelState(store.currentLevel));
          state.phase = wasReady ? 'brief' : 'loading';
        }
      }
      updateFrame(state, input, dtMs, hooks);
      if (state.levelIndex !== store.currentLevel) store.setLevel(state.levelIndex);
      const toolCounts = {} as Record<ToolKind, number>;
      for (const t of TOOLS) toolCounts[t] = store.tools[t] ?? 0;
      draw(
        ctx,
        sprites,
        state,
        { wallet: store.rubles, energy: store.syncEnergy(), stars: store.stars, toolCounts, reducedMotion },
        ready,
      );
    },

    dispose() {},
  };
}
