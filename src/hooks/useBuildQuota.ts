'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { useBuildStore } from '@/store/useBuildStore';
import { buildLimit } from '@/data/subscription-tiers';

/**
 * Квота сохранённых сборок по тиру подписки.
 * Гейт на кнопке «Сохранить»: canSave=false → рендерим <Paywall feature="weapon_builds">.
 * Перезапись уже существующей сборки (editingId != null) квоту не расходует.
 */
export function useBuildQuota() {
  const { tier, loading } = useSubscription();
  const used = useBuildStore((s) => s.saved.length);
  const editingId = useBuildStore((s) => s.editingId);

  const limit = buildLimit(tier);
  const unlimited = !Number.isFinite(limit);
  const canSave = unlimited || editingId !== null || used < limit;

  return {
    tier,
    loading,
    /** Сколько сборок уже сохранено. */
    used,
    /** Потолок тира (Infinity у платных). */
    limit,
    unlimited,
    /** Сколько слотов осталось (Infinity у платных). */
    left: unlimited ? Number.POSITIVE_INFINITY : Math.max(0, limit - used),
    /** Можно ли сохранить текущий черновик. */
    canSave,
    /** Готовая подпись для UI: «2 / 3» или «∞». */
    label: unlimited ? '∞' : `${used} / ${limit}`,
  };
}