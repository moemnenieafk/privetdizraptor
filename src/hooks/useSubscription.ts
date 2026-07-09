'use client';

import { useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { fetchTier } from '@/lib/subscription';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import {
  requiredTier,
  tierMeets,
  type GatedFeature,
  type TierId,
} from '@/data/subscription-tiers';

/**
 * Текущий тир подписки + помощники доступа.
 * Фетч дедуплицируется через стор: первый вызвавший грузит, остальные читают результат.
 */
export function useSubscription() {
  const { user, loading: userLoading } = useUser();
  const tier = useSubscriptionStore((s) => s.tier);
  const loading = useSubscriptionStore((s) => s.loading);
  const setResult = useSubscriptionStore((s) => s.setResult);
  const setLoading = useSubscriptionStore((s) => s.setLoading);

  useEffect(() => {
    if (userLoading) return;
    const uid = user?.id ?? null;
    const st = useSubscriptionStore.getState();
    if (st.userId === uid && !st.loading) return; // уже загружено для этого юзера
    let active = true;
    setLoading(true);
    fetchTier(uid).then((t) => {
      if (active) setResult(uid, t);
    });
    return () => {
      active = false;
    };
  }, [user?.id, userLoading, setResult, setLoading]);

  return {
    tier,
    loading: loading || userLoading,
    /** Достаточно ли текущего тира для уровня `need`. */
    meets: (need: TierId) => tierMeets(tier, need),
    /** Доступна ли гейтируемая фича. */
    has: (feature: GatedFeature) => tierMeets(tier, requiredTier(feature)),
  };
}
