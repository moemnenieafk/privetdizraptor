// Сборка game04 «Егерь ловит покушать»: движок + рендер + спрайты + рекорд.

import type { ArcadeGame } from '../../types';
import { useArcadeStore } from '@/store/useArcadeStore';
import { useJaegerStore } from '@/store/useJaegerStore';
import { playSfx, type SfxName } from '@/lib/sfx';
import { SpriteCache } from '../../sprites';
import { createState, updateFrame, type JaegerHooks, type JaegerSound } from './state';
import { draw } from './render';
import { assetSrc, JAEGER_SPRITE, LOOT } from './config';

const SFX_MAP: Record<JaegerSound, SfxName> = { catch: 'bounce', coin: 'coins', miss: 'thud', over: 'burst' };

export function createGame(): ArcadeGame {
  const sprites = new SpriteCache();
  const state = createState();
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ready = false;

  const hooks: JaegerHooks = {
    sfx: (n: JaegerSound) => {
      if (!useArcadeStore.getState().muted) playSfx(SFX_MAP[n]);
    },
    onGameOver: (score: number) => {
      useJaegerStore.getState().recordRun(score);
    },
  };

  return {
    id: 'jaeger-catch-food',
    title: 'Егерь ловит покушать',
    logo: 'ЕГЕРЬ ЛОВИТ',

    init() {
      if (typeof document !== 'undefined' && 'fonts' in document) {
        void document.fonts.load('20px "BlenderPro-Medium"');
      }
      void useJaegerStore.persist.rehydrate();
      const list = [
        assetSrc('backplate'),
        assetSrc('btc'),
        assetSrc('m67'),
        ...LOOT.map((n) => assetSrc(n)),
        ...Object.values(JAEGER_SPRITE).map((n) => assetSrc(n)),
      ];
      void sprites.load(list).then(() => {
        ready = true;
        if (state.phase === 'loading') state.phase = 'idle';
      });
    },

    frame({ ctx, input }, dtMs) {
      updateFrame(state, input, dtMs, hooks);
      draw(ctx, sprites, state, { reducedMotion }, ready, useJaegerStore.getState().bestScore);
    },

    dispose() {
      state.items = [];
    },
  };
}
