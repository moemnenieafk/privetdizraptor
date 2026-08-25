// DDL таблицы `billing_events` (леджер начислений/платежей — аудит + идемпотентность
// вебхука) как массив идемпотентных стейтментов — накатывается роутом
// /api/cron/migrate-billing. Повторный прогон безопасен.
//
// Пишется при grant (ручная выдача), payment/refund/renewal/downgrade (вебхук).
// provider = 'manual' для ручных выдач, иначе имя платёжки. unique(provider,
// external_id) where external_id is not null — повторный вебхук с тем же external_id
// не задваивает запись. RLS: юзер читает свои строки; пишет owner-роль.
export const BILLING_EVENTS_DDL: string[] = [
  `create table if not exists public.billing_events (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    provider    text not null default 'manual',
    external_id text,
    type        text not null,
    tier        text,
    amount      numeric,
    currency    text not null default 'RUB',
    status      text,
    raw         jsonb,
    created_at  timestamptz not null default now()
  )`,

  // Идемпотентность вебхука: один external_id на провайдера. Частичный уникальный
  // индекс — ручные выдачи (external_id = null) не конфликтуют между собой.
  `create unique index if not exists billing_events_provider_ext
     on public.billing_events(provider, external_id)
     where external_id is not null`,

  `create index if not exists billing_events_user_idx
     on public.billing_events(user_id, created_at)`,

  `alter table public.billing_events enable row level security`,
  `drop policy if exists billing_events_read_own on public.billing_events`,
  `create policy billing_events_read_own on public.billing_events
     for select to authenticated using (user_id = auth.uid())`,
];
