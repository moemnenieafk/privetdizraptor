'use client';

import { useEffect } from 'react';
import { useGamificationStore } from '@/store/useGamificationStore';
import { useRookieStore } from '@/store/useRookieStore';
import { useAchievementStore } from '@/store/useAchievementStore';
import { useBarterRushStore } from '@/store/useBarterRushStore';
import { useJaegerStore } from '@/store/useJaegerStore';
import { useSaveTheServersStore } from '@/store/useSaveTheServersStore';
import { useCompanionStore } from '@/store/useCompanionStore';
import { getCurrentTier, getTierProgress } from '@/types/gamification';
import type { StandingSignals } from '@/lib/player-standing';

/**
 * Серверные части сигналов (карма comlink), которые клиент сам не знает — их прокидывает
 * консюмер с данными сервера (T02). Не переданы → null (аноним/офлайн, вклад 0 в standing).
 */
export interface StandingServerSignals {
  karmaComlink?: number | null;
  /** Переопределить карму companion серверным значением (иначе берём из локального стора). */
  karmaCompanion?: number | null;
}

/**
 * Собрать StandingSignals из УЖЕ существующих сторов. Ничего в них не мутирует — только читает.
 * Гидрирует skipHydration-сторы на клиенте (как соседние хабы). Возвращает готовые сигналы для
 * computeStanding; карма comlink/companion = null, если сервер не отдал (§4.5 аноним).
 */
export function usePlayerStandingSignals(server: StandingServerSignals = {}): StandingSignals {
  useEffect(() => {
    void useGamificationStore.persist.rehydrate();
    void useRookieStore.persist.rehydrate();
    void useBarterRushStore.persist.rehydrate();
    void useJaegerStore.persist.rehydrate();
    void useSaveTheServersStore.persist.rehydrate();
  }, []);

  const xp = useGamificationStore((s) => s.xp);
  const tutorialDone = useRookieStore((s) => s.completed.length);
  const achievements = useAchievementStore((s) => s.completedIds.length);

  // Аркада: сумма лучших результатов по играм зала (game02 «Три в ряд» рекорда не ведёт).
  const rushBest = useBarterRushStore((s) => s.bestScore);
  const jaegerBest = useJaegerStore((s) => s.bestScore);
  const serversBest = useSaveTheServersStore((s) => s.bestScore);
  const arcadeBest = rushBest + jaegerBest + serversBest;

  // Карма companion: локальный стор (не персистится, приходит с сервера при логине).
  const companionLocal = useCompanionStore((s) => s.karma);

  const tier = getCurrentTier(xp);
  const xpProgress = getTierProgress(xp);

  const karmaCompanion =
    server.karmaCompanion !== undefined
      ? server.karmaCompanion
      : companionLocal > 0
        ? companionLocal
        : null;

  return {
    xpTier: tier.level,
    xpProgress,
    karmaComlink: server.karmaComlink ?? null,
    karmaCompanion,
    arcadeBest,
    tutorialDone,
    achievements,
  };
}
