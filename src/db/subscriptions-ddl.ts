// DDL таблицы подписок как массив стейтментов — накатывается роутом
// /api/cron/migrate-subscriptions (db:push с телефона недоступен, паттерн weapons-ddl).
// Все стейтменты идемпотентны, повторный прогон безопасен.
//
// Тир читают getSubscription (server) и fetchTier (client) через Supabase-клиент;
// пишет owner-роль (вебхук платёжки или ручной /api/cron/set-tier). До появления
// этой таблицы читалки деградировали в 'free' — то есть весь пэйвол был закрыт для
// всех. RLS: пользователь читает свою строку; апдейты — только серверной ролью.
export const SUBSCRIPTIONS_DDL: string[] = [
  `create table if not exists public.subscriptions (
    user_id     uuid primary key references public.profiles(id) on delete cascade,
    tier        text not null default 'free',
    valid_until timestamptz,
    source      text not null default 'manual',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
  )`,

  // CHECK на tier СНЯТ: тиры уехали в таблицу public.tiers (динамические, админ
  // создаёт/переименовывает их без деплоя). CHECK по фикс-списку блокировал бы новый
  // тир → валидация slug теперь в коде (src/lib/gating/tiers.ts). Не воссоздаём.
  `alter table public.subscriptions drop constraint if exists subscriptions_tier_chk`,

  // Задел per-game: игровая подписка (scope_game_id != null) применима только к своей
  // игре, портальная (null) — везде. На запуске всегда null. Additive, идемпотентно.
  `alter table public.subscriptions
     add column if not exists scope_game_id uuid references public.games(id)`,

  `alter table public.subscriptions enable row level security`,
  `drop policy if exists subscriptions_read on public.subscriptions`,
  `create policy subscriptions_read on public.subscriptions
     for select to authenticated using (user_id = auth.uid())`,
];
