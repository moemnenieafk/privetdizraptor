-- RLS для `price_history` (своя история цен: снимки snapshot-prices + бэкфил tarkovdev).
-- Гигиена БД 2026-07-23: таблица была БЕЗ RLS — единственная public-таблица без него
-- (аноним мог писать через PostgREST). Запускать через `npm run db:sql` (после db:push).
-- Данные публичные (графики цен) → read-only всем; запись кроном под owner (в обход RLS).

alter table public.price_history enable row level security;
drop policy if exists "price_history_read_all" on public.price_history;
create policy "price_history_read_all" on public.price_history for select using (true);
