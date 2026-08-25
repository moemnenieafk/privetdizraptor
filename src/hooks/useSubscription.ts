'use client';

import { useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { fetchTier } from '@/lib/subscription';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { useEntitlements } from '@/components/features/subscription/GatingProvider';
import { meets, tierRankOf } from '@/lib/gating/tiers';
import {
  FEATURE_MIN_TIER,
  requiredTier,
  tierMeets,
  type GatedFeature,
  type TierId,
} from '@/data/subscription-tiers';

/**
 * Текущий тир подписки + помощники доступа.
 *
 * Два пути:
 *  - Есть снимок из <GatingProvider> (контекст, положен из RSC) → тир/ранг и порог гейта
 *    берутся из снимка карты, без сети. has(key) работает по любому ключу гейта.
 *  - Нет снимка → старый путь: fetchTier дедуплицируется через стор, has(feature) —
 *    по дефолту реестра (requiredTier). Форма возврата (tier/loading/meets/has) неизменна.
 */
export function useSubscription() {
  const { user, loading: userLoading } = useUser();
  const snapshot = useEntitlements();
  const storeTier = useSubscriptionStore((s) => s.tier);
  const storeLoading = useSubscriptionStore((s) => s.loading);
  const setResult = useSubscriptionStore((s) => s.setResult);
  const setLoading = useSubscriptionStore((s) => s.setLoading);

  useEffect(() => {
    // Снимок из провайдера уже даёт тир — сетевой фетч не нужен.
    if (snapshot) return;
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
  }, [snapshot, user?.id, userLoading, setResult, setLoading]);

  // Снимок доступен — работаем на нём (без сети).
  if (snapshot) {
    return {
      tier: snapshot.tier,
      loading: false,
      /** Достаточно ли текущего тира для уровня `need` (по снимку тиров). */
      meets: (need: TierId) =>
        snapshot.rank >= tierRankOf(need, snapshot.tiers),
      /** Доступна ли фича/раздел по ключу гейта (порог из снимка карты). */
      has: (key: GatedFeature | string) =>
        meets(snapshot.rank, key, snapshot.gates, snapshot.tiers),
    };
  }

  // Нет снимка — деградация на старый путь (дефолты реестра).
  const tier: TierId = storeTier || 'free';
  return {
    tier,
    loading: storeLoading || userLoading,
    /** Достаточно ли текущего тира для уровня `need` (fallback-лестница). */
    meets: (need: TierId) => tierMeets(tier, need),
    /** Доступна ли гейтируемая фича (дефолт реестра). Ключ вне реестра фич (section-slug
     *  или динамический гейт) без снимка распознать нечем → fail-open (ЯВНО открываем:
     *  дефолт-путь без провайдера — деградация, не security-граница, см. resolve.ts). */
    has: (key: GatedFeature | string) =>
      key in FEATURE_MIN_TIER
        ? tierMeets(tier, requiredTier(key as GatedFeature))
        : true,
  };
}
