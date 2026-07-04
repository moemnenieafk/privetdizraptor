-- Форма «Сообщить об ошибке» (Figma 1588:1322) — таблица обращений пользователей.
-- Additive и идемпотентно (db:sql, без db:push). Бэкенд-онли: пишет серверный API-роут
-- (Drizzle owner-роль, мимо RLS), читает CMS/админ. RLS включён БЕЗ policy — anon/
-- authenticated через supabase-клиент доступа не имеют (паттерн rate_limits).
-- Зеркалится в schema.ts (чтобы db:push не снёс таблицу).

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  page_url text not null,
  email text not null,
  message text not null,
  attachments jsonb not null default '[]'::jsonb,
  user_id uuid,
  user_agent text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists feedback_status_created_idx
  on public.feedback (status, created_at);

alter table public.feedback enable row level security;
-- Никаких policy: только owner (серверный Drizzle) пишет; RLS режет anon/authenticated.
