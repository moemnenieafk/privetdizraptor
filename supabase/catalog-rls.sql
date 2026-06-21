-- Слой 1-2 — RLS для каталожных таблиц (фикс линтера "RLS Disabled in Public").
-- Запускать через `npm run db:sql` (и ОБЯЗАТЕЛЬНО после каждого db:push).
--
-- Каталог игровых данных не секретный, но без RLS любой с публичным anon-ключом
-- мог бы ПИСАТЬ в эти таблицы через PostgREST. Включаем RLS и разрешаем ТОЛЬКО
-- чтение. Запись идёт через наши admin route handlers (Drizzle как owner таблиц —
-- в обход RLS), поэтому select-only политика приложение не ломает.

-- games
alter table public.games enable row level security;
drop policy if exists "games_read_all" on public.games;
create policy "games_read_all" on public.games for select using (true);

-- item_categories
alter table public.item_categories enable row level security;
drop policy if exists "item_categories_read_all" on public.item_categories;
create policy "item_categories_read_all" on public.item_categories for select using (true);

-- items
alter table public.items enable row level security;
drop policy if exists "items_read_all" on public.items;
create policy "items_read_all" on public.items for select using (true);

-- item_properties
alter table public.item_properties enable row level security;
drop policy if exists "item_properties_read_all" on public.item_properties;
create policy "item_properties_read_all" on public.item_properties for select using (true);
