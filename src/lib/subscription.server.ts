import { createClient } from '@/lib/supabase/server';
import { type TierId } from '@/data/subscription-tiers';

export interface SubscriptionInfo {
  tier: TierId;
  /** ISO; null — бессрочно / нет данных. */
  validUntil: string | null;
  /** Откуда подписка: manual | yookassa | … Показывается в кабинете. */
  source: string | null;
  /**
   * Продлевать ли подписку дальше. `null` — колонки `auto_renew` в БД ещё нет
   * (её накатывают правами supabase_admin, см. спеку): кабинет тогда строку не рисует,
   * а не показывает выдуманное состояние. Появится колонка — строка появится сама.
   */
  autoRenew: boolean | null;
}

/** Запись леджера начислений для вкладки «Платежи» (own-строки через RLS). */
export interface BillingHistoryEntry {
  id: string;
  type: string;
  provider: string;
  tier: string | null;
  /** ₽. null — суммы нет (напр. ручная выдача админом). */
  amount: number | null;
  currency: string | null;
  status: string | null;
  createdAt: string;
}

/**
 * Серверная истина подписки для Server Components (кабинет). Читает own-строку
 * `subscriptions` через server-клиент. Устойчива к отсутствию строки/таблицы/колонки
 * → деградирует в 'free'. Истёкшая по valid_until — тоже 'free' (честный статус).
 * select('*') — чтобы отсутствие колонки valid_until не роняло весь запрос в ошибку.
 */
export async function getSubscription(userId: string | null): Promise<SubscriptionInfo> {
  if (!userId) return { tier: 'free', validUntil: null, source: null, autoRenew: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return { tier: 'free', validUntil: null, source: null, autoRenew: null };
    const row = data as {
      tier?: unknown;
      valid_until?: unknown;
      source?: unknown;
      auto_renew?: unknown;
    };
    const validUntil = typeof row.valid_until === 'string' ? row.valid_until : null;
    const expired = validUntil !== null && new Date(validUntil).getTime() < Date.now();
    // Пропускаем ЛЮБОЙ непустой строковый slug (динамические, админ-созданные тиры тоже):
    // ранг посчитает снимок tiers. Сужение до базовых трёх занижало платника до free.
    const slug = typeof row.tier === 'string' ? row.tier.trim() : '';
    const tier: TierId = !expired && slug !== '' ? slug : 'free';
    const source = typeof row.source === 'string' && row.source.trim() !== '' ? row.source : null;
    // select('*') отдаёт колонку, только если она есть в таблице — отсюда null-ветка.
    const autoRenew = typeof row.auto_renew === 'boolean' ? row.auto_renew : null;
    return { tier, validUntil, source, autoRenew };
  } catch {
    return { tier: 'free', validUntil: null, source: null, autoRenew: null };
  }
}

/**
 * История начислений пользователя для вкладки «Платежи». Читаем СВОИ строки через
 * server-клиент Supabase (политика billing_events_read_own), а НЕ owner-клиентом Drizzle:
 * кабинет не должен уметь смотреть чужой леджер даже теоретически.
 *
 * Fail-safe: нет таблицы/строк/доступа → пустой список, вкладка покажет пустое состояние,
 * а не ошибку.
 */
export async function getBillingHistory(
  userId: string | null,
  limit = 20,
): Promise<BillingHistoryEntry[]> {
  if (!userId) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('billing_events')
      .select('id, type, provider, tier, amount, currency, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      type: typeof r.type === 'string' ? r.type : 'unknown',
      provider: typeof r.provider === 'string' ? r.provider : 'manual',
      tier: typeof r.tier === 'string' ? r.tier : null,
      // numeric приезжает строкой — приводим и отбрасываем нечисловое.
      amount: r.amount === null || r.amount === undefined ? null : Number(r.amount),
      currency: typeof r.currency === 'string' ? r.currency : null,
      status: typeof r.status === 'string' ? r.status : null,
      createdAt: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}
