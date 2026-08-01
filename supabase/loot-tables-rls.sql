-- RLS для loot-таблиц SPT (self-mirror из файлов игры: loot_spawns + loot_container_pools).
-- Запускать через `npm run db:sql` (ОБЯЗАТЕЛЬНО после каждого db:push — db:push --force роняет RLS).
--
-- Данные не секретны (loot-пулы/шансы — игровые факты), но без RLS любой с публичным
-- anon-ключом мог бы ПИСАТЬ через PostgREST. Включаем RLS, разрешаем ТОЛЬКО чтение.
-- Наполнение идёт локальным ингестом под owner-ролью (Drizzle, в обход RLS) — select-only не мешает.

alter table public.loot_spawns enable row level security;
drop policy if exists "loot_spawns_read_all" on public.loot_spawns;
create policy "loot_spawns_read_all" on public.loot_spawns for select using (true);

alter table public.loot_container_pools enable row level security;
drop policy if exists "loot_container_pools_read_all" on public.loot_container_pools;
create policy "loot_container_pools_read_all" on public.loot_container_pools for select using (true);
