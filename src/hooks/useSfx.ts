'use client';

import { useEffect } from 'react';
import { useGamificationStore } from '@/store/useGamificationStore';
import { playSfx, setSfxMuted, type SfxName } from '@/lib/sfx';

/** Связывает флаг звука из стора с движком и отдаёт play/toggle. */
export function useSfx() {
  const muted = useGamificationStore((s) => s.soundMuted);
  const toggle = useGamificationStore((s) => s.toggleSound);

  useEffect(() => {
    setSfxMuted(muted);
  }, [muted]);

  return {
    play: (name: SfxName) => playSfx(name),
    muted,
    toggle,
  };
}
