-- Слой 3+ — RLS для таблицы `prices` (self-mirror цен из tarkov.dev).
-- Запускать через `npm run db:sql` (ОБЯЗАТЕЛЬНО после каждого db:push).
--
-- Цены не секретны, но без RLS любой с публичным anon-ключом мог бы ПИСАТЬ в
-- таблицу через PostgREST. Включаем RLS, разрешаем ТОЛЬКО чтение. Запись идёт
-- через крон под owner-ролью (Drizzle, в обход RLS), поэтому select-only не мешает.

alter table public.prices enable row level security;
drop policy if exists "prices_read_all" on public.prices;
create policy "prices_read_all" on public.prices for select using (true);
