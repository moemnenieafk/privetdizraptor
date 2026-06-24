-- S5 — таблица app-level rate-limit для публичных auth-эндпоинтов (login/register).
-- Additive и идемпотентно (db:sql, без db:push). Бэкенд-онли: доступ только серверной
-- owner-роли (Drizzle ходит мимо RLS); RLS включаем БЕЗ policy — anon/authenticated
-- через supabase-клиент доступа не имеют. Зеркалится в schema.ts (чтобы push не снёс).

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
-- Никаких policy: только owner (серверный Drizzle) пишет/читает; RLS режет всех остальных.
