// game01 «Спаси сервера» — сборка модуля: движок (state) + рендер (render) + спрайты + экономика.

import type { ArcadeGame } from '../../types';
import { useSaveTheServersStore } from '@/store/useSaveTheServersStore';
import { useArcadeStore } from '@/store/useArcadeStore';
import { playSfx } from '@/lib/sfx';
import { SpriteCache } from './sprites';
import { createState, updateFrame, type GameState, type GameSound, type Phase } from './state';
import { draw } from './render';
import {
  backplateSrc,
  itemSrc,
  cursorSrc,
  errorSrc,
  flashSrc,
  ERROR_VARIANTS,
  weaponById,
  PELMEN_VARIANTS,
} from './config';

export function createGame(): ArcadeGame {
  const sprites = new SpriteCache();
  const state: GameState = createState();
  const acc = { v: 0 };
  const backplateN = 1 + Math.floor(Math.random() * 3);
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ready = false;
  let skinFile = weaponById(useSaveTheServersStore.getState().selectedSkin).file;
  let prevPhase: Phase = state.phase;

  const loadSkin = (file: string) => sprites.load([cursorSrc(file, 1), cursorSrc(file, 2)]);

  // Флэш-граната «Заря» — реальный трек (посекундный таймлайн визуала синхронен со звуком).
  const flashAudio = typeof Audio !== 'undefined' ? new Audio(flashSrc) : null;
  if (flashAudio) flashAudio.preload = 'auto';

  const sfx = (name: GameSound) => {
    if (useArcadeStore.getState().muted) return;
    if (name === 'flash') {
      if (flashAudio) {
        flashAudio.currentTime = 0;
        void flashAudio.play().catch(() => {});
      }
      return;
    }
    playSfx(name);
  };

  const hooks = {
    onGameOver: (score: number) => {
      useSaveTheServersStore.getState().recordRun(score);
      sfx('burst');
    },
    sfx,
  };

  return {
    id: 'save-the-servers',
    title: 'Спаси сервера',
    logo: 'СПАСИ СЕРВЕРА',

    init() {
      if (typeof document !== 'undefined' && 'fonts' in document) {
        void document.fonts.load('20px "BlenderPro-Medium"');
      }
      void sprites
        .load([
          backplateSrc(backplateN),
          itemSrc('pevko'),
          itemSrc('goldpevko'),
          itemSrc('heal'),
          itemSrc('zvezda'),
          ...PELMEN_VARIANTS.map((v) => itemSrc(v)),
          ...Array.from({ length: ERROR_VARIANTS }, (_, i) => errorSrc(i + 1)),
          cursorSrc(skinFile, 1),
          cursorSrc(skinFile, 2),
        ])
        .then(() => {
          ready = true;
          if (state.phase === 'loading') state.phase = 'idle';
        });
    },

    frame({ ctx, input }, dtMs) {
      updateFrame(state, input, dtMs, acc, hooks);

      // Старт нового забега: перечитываем выбранный скин для курсора (хитбокс фиксирован).
      if (state.phase === 'playing' && prevPhase !== 'playing') {
        const file = weaponById(useSaveTheServersStore.getState().selectedSkin).file;
        if (file !== skinFile) {
          skinFile = file;
          void loadSkin(file);
        }
      }
      prevPhase = state.phase;

      const pointer = input.pointer ? { x: input.pointer.x, y: input.pointer.y, down: input.pointer.down } : null;
      draw(
        ctx,
        sprites,
        state,
        { cursorFile: skinFile, backplateN, pointer, reducedMotion },
        ready,
        useSaveTheServersStore.getState().bestScore,
      );
    },

    dispose() {
      state.bottles = [];
      state.pickups = [];
      state.pelmen = null;
    },
  };
}
