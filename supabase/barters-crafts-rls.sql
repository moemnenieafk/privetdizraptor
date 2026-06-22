-- Слой 3+ — RLS для таблиц `barters` / `crafts` (self-mirror из tarkov.dev).
-- Запускать через `npm run db:sql` (ОБЯЗАТЕЛЬНО после каждого db:push).
-- Не секретно, но без RLS любой с anon-ключом мог бы писать через PostgREST.
-- Включаем RLS + только чтение; запись идёт кроном под owner-ролью (в обход RLS).

alter table public.barters enable row level security;
drop policy if exists "barters_read_all" on public.barters;
create policy "barters_read_all" on public.barters for select using (true);

alter table public.crafts enable row level security;
drop policy if exists "crafts_read_all" on public.crafts;
create policy "crafts_read_all" on public.crafts for select using (true);
