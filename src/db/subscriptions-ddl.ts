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

  // Защита от мусора на уровне БД: тир только из трёх допустимых значений.
  `alter table public.subscriptions drop constraint if exists subscriptions_tier_chk`,
  `alter table public.subscriptions
     add constraint subscriptions_tier_chk check (tier in ('free', 'operative', 'veteran'))`,

  `alter table public.subscriptions enable row level security`,
  `drop policy if exists subscriptions_read on public.subscriptions`,
  `create policy subscriptions_read on public.subscriptions
     for select to authenticated using (user_id = auth.uid())`,
];
