'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from './useUser';
import { useGamificationStore, type AccountProgress } from '@/store/useGamificationStore';
import {
  getCtaBarterProgress,
  saveCtaBarterProgress,
  type BarterProgressPayload,
} from '@/lib/cta-api';
import type { BadgeState } from '@/types/gamification';

export type SyncState = 'guest' | 'loading' | 'synced' | 'error';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pickPersist(s: ReturnType<typeof useGamificationStore.getState>): BarterProgressPayload {
  return {
    xp: s.xp,
    confirmedBarterIds: s.confirmedBarterIds,
    badges: s.badges,
    streak: s.streak,
    bestStreak: s.bestStreak,
    dailyDate: s.dailyDate,
    dailyProfit: s.dailyProfit,
    lifetimeProfit: s.lifetimeProfit,
    lifetimeSavings: s.lifetimeSavings,
  };
}

/** Слияние «гость↔аккаунт»: max по числам, объединение списков, ранний анлок бейджей. */
function mergeProgress(local: BarterProgressPayload, remote: BarterProgressPayload): AccountProgress {
  const ids = Array.from(new Set([...local.confirmedBarterIds, ...remote.confirmedBarterIds]));

  // Union по id обоих источников: remote-only бейджи (новые определения) не теряются.
  const badgeIds = Array.from(new Set([...local.badges, ...remote.badges].map((b) => b.id)));
  const badges: BadgeState[] = badgeIds.map((id) => {
    const lb = local.badges.find((b) => b.id === id);
    const rb = remote.badges.find((b) => b.id === id);
    const base = lb ?? rb!;
    const la = lb?.unlockedAt ?? null;
    const ra = rb?.unlockedAt ?? null;
    const unlockedAt = la !== null && ra !== null ? Math.min(la, ra) : (la ?? ra);
    return {
      id: base.id as BadgeState['id'],
      label: base.label,
      description: base.description,
      unlockedAt,
    };
  });

  const today = todayKey();
  const localToday = local.dailyDate === today ? local.dailyProfit : 0;
  const remoteToday = remote.dailyDate === today ? remote.dailyProfit : 0;

  return {
    xp: Math.max(local.xp, remote.xp),
    confirmedBarterIds: ids,
    badges,
    streak: Math.max(local.streak, remote.streak),
    bestStreak: Math.max(local.bestStreak, remote.bestStreak),
    dailyDate: today,
    dailyProfit: Math.max(localToday, remoteToday),
    lifetimeProfit: Math.max(local.lifetimeProfit, remote.lifetimeProfit),
    lifetimeSavings: Math.max(local.lifetimeSavings, remote.lifetimeSavings),
  };
}

/**
 * Привязывает прогресс геймификации к аккаунту:
 * при логине — гидратация (merge гость↔сервер) + дебаунс-сохранение при изменениях.
 * Гость работает на localStorage (zustand persist) без сети.
 */
export function useGamificationSync(): { state: SyncState; email: string | null } {
  const { user, loading } = useUser();
  const hydrate = useGamificationStore((s) => s.hydrateProgress);
  const [state, setState] = useState<SyncState>('guest');
  const hydratedRef = useRef(false);

  // Гидратация при появлении пользователя
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setState('guest');
      hydratedRef.current = false;
      return;
    }
    let active = true;
    setState('loading');
    (async () => {
      try {
        const remote = await getCtaBarterProgress();
        if (!active) return;
        if (!remote) {
          // null = 401: сессия истекла, хотя клиент ещё считает себя залогиненным →
          // трактуем как гостя (локальный прогресс цел, пересинкнётся при рефреше сессии).
          setState('guest');
          hydratedRef.current = false;
          return;
        }
        const local = pickPersist(useGamificationStore.getState());
        const merged = mergeProgress(local, remote);
        hydrate(merged);
        await saveCtaBarterProgress({ ...merged });
        if (!active) return;
        hydratedRef.current = true;
        setState('synced');
      } catch {
        if (active) setState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [user, loading, hydrate]);

  // Дебаунс-сохранение при изменениях стора (только после гидратации)
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: BarterProgressPayload | null = null;
    let cancelled = false;

    const flush = () => {
      if (!pending) return;
      const payload = pending;
      pending = null;
      saveCtaBarterProgress(payload).then((ok) => {
        if (!ok && !cancelled) setState('error');
      });
    };

    const unsub = useGamificationStore.subscribe((s) => {
      if (!hydratedRef.current) return;
      pending = pickPersist(s);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 1000);
    });

    return () => {
      cancelled = true; // подавляем error-индикатор на размонтировании/разлогине
      if (timer) clearTimeout(timer);
      unsub();
      flush(); // финальный сейв незакоммиченного дебаунса (данные не теряем)
    };
  }, [user]);

  return { state, email: user?.email ?? null };
}
