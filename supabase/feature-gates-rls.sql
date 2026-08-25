-- RLS для таблицы `feature_gates` (маппинг «фича/раздел → мин. тир + поведение»).
-- Запускать через `npm run db:sql`. Дублирует RLS из /api/cron/migrate-billing как
-- канон-источник (паттерн supabase/prices-rls.sql).
--
-- Карту гейтов читают авторизованные (не секрет, но не для анона — фронт клиента).
-- Запись — из админ-матрицы через owner-роль (Drizzle, в обход RLS), write-политики нет.

alter table public.feature_gates enable row level security;
drop policy if exists feature_gates_read on public.feature_gates;
create policy feature_gates_read on public.feature_gates for select to authenticated using (true);
