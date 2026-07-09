import { createClient } from '@/lib/supabase/client';
import { isTierId, type TierId } from '@/data/subscription-tiers';

// Ожидаемая схема (создать через db:sql — ручной пункт):
//   subscriptions ( user_id uuid pk/fk -> auth.users, tier text check in
//   ('free','operative','veteran'), valid_until timestamptz null, updated_at ... )
//   RLS: select — только own row.

/**
 * Тир пользователя из БД. Устойчиво к отсутствию юзера/строки/таблицы → 'free'.
 * Это позволяет гейтингу работать до создания таблицы `subscriptions`.
 */
export async function fetchTier(userId: string | null): Promise<TierId> {
  if (!userId) return 'free';
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return 'free';
    const row = data as { tier?: unknown };
    return isTierId(row.tier) ? row.tier : 'free';
  } catch {
    return 'free';
  }
}
