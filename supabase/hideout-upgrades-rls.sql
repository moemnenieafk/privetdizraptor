-- Слой 3+ — RLS для таблицы `hideout_upgrades` (self-mirror из tarkov.dev).
-- Запускать через `npm run db:sql` (ОБЯЗАТЕЛЬНО после каждого db:push).
-- Включаем RLS + только чтение; запись идёт скриптом/кроном под owner-ролью (в обход RLS).

alter table public.hideout_upgrades enable row level security;
drop policy if exists "hideout_upgrades_read_all" on public.hideout_upgrades;
create policy "hideout_upgrades_read_all" on public.hideout_upgrades for select using (true);
