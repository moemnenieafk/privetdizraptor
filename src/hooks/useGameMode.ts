'use client';

import { usePlayerStore } from '@/store/usePlayerStore';

export type GameMode = 'PVP' | 'PVE';

// Глобальный режим сайта = режим активного профиля ЧВК.
// Переключается штатными кнопками PvP/PvE в настройках профиля — отдельного тумблера не нужно.

export function useGameMode(): GameMode {
  return usePlayerStore((s) => {
    const active = s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0];
    // Глобальный режим сайта — бинарный (PvP/PvE). Season — режим профиля, но для сайт-логики
    // (цены/плоскость) сводится к PvP (per-season-плоскости нет).
    return active?.mode === 'PVE' ? 'PVE' : 'PVP';
  });
}

export function useIsPve(): boolean {
  return useGameMode() === 'PVE';
}
