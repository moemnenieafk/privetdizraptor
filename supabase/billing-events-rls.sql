-- RLS для таблицы `billing_events` (леджер начислений/платежей — аудит).
-- Запускать через `npm run db:sql`. Дублирует RLS из /api/cron/migrate-billing как
-- канон-источник (паттерн supabase/prices-rls.sql).
--
-- Юзер видит ТОЛЬКО свои начисления (own-строки). Пишет owner-роль (ручная выдача /
-- вебхук через Drizzle, в обход RLS), поэтому write-политики нет. Полный леджер в
-- админке читается owner-ролью, не через RLS.

alter table public.billing_events enable row level security;
drop policy if exists billing_events_read_own on public.billing_events;
create policy billing_events_read_own on public.billing_events
  for select to authenticated using (user_id = auth.uid());
