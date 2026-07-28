-- RLS для таблиц журнала изменений игры (движок «что реально изменилось в патче»).
-- Запускать через `npm run db:sql` (ОБЯЗАТЕЛЬНО после каждого db:push).
--
-- Данные не секретные — это публичный журнал патчей, он и так отрисован на сайте.
-- Но без RLS любой с anon-ключом (а он лежит в JS-бандле) мог бы ПИСАТЬ в эти
-- таблицы через PostgREST: стереть историю или залить мусор. Включаем RLS и
-- разрешаем ТОЛЬКО чтение.
--
-- Запись идёт кронами через Drizzle по DATABASE_URL — это коннект владельцем
-- таблиц, он RLS обходит, поэтому select-only политика синки не ломает.
-- Поводом стало письмо линтера Supabase «RLS Disabled in Public» от 2026-07-26.

-- item_changes — журнал дельт: added | removed | field
alter table public.item_changes enable row level security;
drop policy if exists "item_changes_read_all" on public.item_changes;
create policy "item_changes_read_all" on public.item_changes for select using (true);

-- item_change_state — снимок предыдущего среза предметов (база для диффа)
alter table public.item_change_state enable row level security;
drop policy if exists "item_change_state_read_all" on public.item_change_state;
create policy "item_change_state_read_all" on public.item_change_state for select using (true);

-- change_digests — сгруппированные чейнджсеты по detected_at
alter table public.change_digests enable row level security;
drop policy if exists "change_digests_read_all" on public.change_digests;
create policy "change_digests_read_all" on public.change_digests for select using (true);

-- trader_offer_state — снимок ассортимента торговцев
alter table public.trader_offer_state enable row level security;
drop policy if exists "trader_offer_state_read_all" on public.trader_offer_state;
create policy "trader_offer_state_read_all" on public.trader_offer_state for select using (true);

-- craft_state — снимок рецептов крафта
alter table public.craft_state enable row level security;
drop policy if exists "craft_state_read_all" on public.craft_state;
create policy "craft_state_read_all" on public.craft_state for select using (true);

-- quest_state — снимок квестов
alter table public.quest_state enable row level security;
drop policy if exists "quest_state_read_all" on public.quest_state;
create policy "quest_state_read_all" on public.quest_state for select using (true);
