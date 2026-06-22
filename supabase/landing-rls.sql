-- Слой 3+ — RLS для лендинговых справочников (achievements / maps / traders),
-- self-mirror из tarkov.dev. Запускать через `npm run db:sql` (после db:push).
-- Не секретно; включаем RLS + только чтение, запись — кроном под owner-ролью.

alter table public.achievements enable row level security;
drop policy if exists "achievements_read_all" on public.achievements;
create policy "achievements_read_all" on public.achievements for select using (true);

alter table public.maps enable row level security;
drop policy if exists "maps_read_all" on public.maps;
create policy "maps_read_all" on public.maps for select using (true);

alter table public.traders enable row level security;
drop policy if exists "traders_read_all" on public.traders;
create policy "traders_read_all" on public.traders for select using (true);
