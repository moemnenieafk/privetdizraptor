import { createClient } from '@/lib/supabase/server';
import { isTierId, type TierId } from '@/data/subscription-tiers';

export interface SubscriptionInfo {
  tier: TierId;
  /** ISO; null — бессрочно / нет данных. */
  validUntil: string | null;
}

/**
 * Серверная истина подписки для Server Components (кабинет). Читает own-строку
 * `subscriptions` через server-клиент. Устойчива к отсутствию строки/таблицы/колонки
 * → деградирует в 'free'. Истёкшая по valid_until — тоже 'free' (честный статус).
 * select('*') — чтобы отсутствие колонки valid_until не роняло весь запрос в ошибку.
 */
export async function getSubscription(userId: string | null): Promise<SubscriptionInfo> {
  if (!userId) return { tier: 'free', validUntil: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return { tier: 'free', validUntil: null };
    const row = data as { tier?: unknown; valid_until?: unknown };
    const validUntil = typeof row.valid_until === 'string' ? row.valid_until : null;
    const expired = validUntil !== null && new Date(validUntil).getTime() < Date.now();
    const tier = !expired && isTierId(row.tier) ? row.tier : 'free';
    return { tier, validUntil };
  } catch {
    return { tier: 'free', validUntil: null };
  }
}
