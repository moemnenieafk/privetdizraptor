-- RLS для таблицы `tiers` (динамические уровни подписки).
-- Запускать через `npm run db:sql` (после db:push, если таблица заводилась drizzle-kit;
-- при накате роутом /api/cron/migrate-billing RLS уже выставлен — этот файл дублирует
-- его как канон-источник, паттерн supabase/prices-rls.sql).
--
-- Витрина цен публична: и анон, и авторизованные читают весь список тиров. Запись
-- (create/rename/price/archive) идёт из админки через owner-роль (Drizzle, в обход RLS),
-- поэтому write-политики нет.

alter table public.tiers enable row level security;
drop policy if exists tiers_read on public.tiers;
create policy tiers_read on public.tiers for select to anon, authenticated using (true);
