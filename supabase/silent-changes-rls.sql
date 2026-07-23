-- RLS для таблицы `silent_changes` (self-mirror «Tarkov Silent Changes»).
-- Запускать через `npm run db:sql` (ОБЯЗАТЕЛЬНО после каждого db:push).
-- Включаем RLS + только чтение; запись идёт кроном под owner-ролью (в обход RLS).

alter table public.silent_changes enable row level security;
drop policy if exists "silent_changes_read_all" on public.silent_changes;
create policy "silent_changes_read_all" on public.silent_changes for select using (true);
