-- Слой 3+ — таблица + RLS для `companion_flea_offers` (краудсорс-офферы компаньона).
-- Запускать через `npm run db:sql` (идемпотентно). Применяется и как обычный post-push
-- RLS-восстановитель.
--
-- ⚠️ Почему DDL таблицы ЗДЕСЬ, а не только в schema.ts: `drizzle-kit push` требует
-- интерактивный TTY (резолвер «новая таблица / переименование»), которого нет в нашем
-- неинтерактивном шелле. Таблица чисто АДДИТИВНАЯ, поэтому заводим её идемпотентным
-- `create table if not exists` — это не конфликтует с schema.ts (там та же форма для
-- типизации Drizzle-запросов; будущий `db:push` с TTY увидит совпадение и не тронет).
-- Определение ДОЛЖНО совпадать с `companionFleaOffers` в src/db/schema.ts.

create table if not exists public.companion_flea_offers (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games(id) on delete cascade,
  in_game_id    text not null,
  game_mode     text not null default 'regular',
  price         integer not null,
  submitted_by  uuid not null,
  trusted       boolean not null default false,
  submitted_at  timestamptz not null default now()
);

-- Для уже созданной таблицы (аддитивно, идемпотентно).
alter table public.companion_flea_offers add column if not exists trusted boolean not null default false;

create index if not exists companion_offers_item_idx
  on public.companion_flea_offers (game_id, in_game_id, game_mode);
create index if not exists companion_offers_time_idx
  on public.companion_flea_offers (submitted_at);

-- RLS: публичного ЧТЕНИЯ нет вовсе (анти-скрейп: чтобы нашу зарождающуюся ценовую сеть
-- не выкачивали пачкой). Портал читает только АГРЕГАТ (median по окну,
-- src/db/companion-prices.ts). Приём офферов — ТОЛЬКО через route `/api/companion/flea`,
-- который валидирует и пишет owner-ролью (Drizzle, в обход RLS). Включаем RLS без
-- permissive-политик → anon/authenticated через PostgREST не видят и не пишут ничего.
alter table public.companion_flea_offers enable row level security;
drop policy if exists "companion_offers_read_all" on public.companion_flea_offers;
drop policy if exists "companion_offers_insert_own" on public.companion_flea_offers;
