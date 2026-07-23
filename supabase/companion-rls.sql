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
-- Использования X/Y (ключи/износ) — две цены 1/Y и Y/Y. Additive, NULL = без износа.
alter table public.companion_flea_offers add column if not exists uses integer;
alter table public.companion_flea_offers add column if not exists max_uses integer;

-- Репутация компаньона на profiles (микро-начисление за выгрузку, ~0.01). Additive.
alter table public.profiles add column if not exists companion_karma real not null default 0;
-- Бан автора (zero-tolerance к ботам/скрапингу/скаму) — блокирует сабмит компаньона. Additive.
alter table public.profiles add column if not exists banned boolean not null default false;
-- Дневной лимит начисления кармы (анти-фарм). Additive.
alter table public.profiles add column if not exists companion_karma_day date;
alter table public.profiles add column if not exists companion_karma_today real not null default 0;

-- Очередь аномалий (модерация companion-цен). Внутренняя: публичного доступа нет,
-- читают/пишут owner-ролью серверные роуты (детект + админ-действия) после проверки роли.
create table if not exists public.companion_anomalies (
  game_id         uuid not null references public.games(id) on delete cascade,
  in_game_id      text not null,
  companion_price integer not null,
  ref_price       integer not null,
  deviation_pct   real not null,
  deviation_abs   integer not null,
  offers          integer not null,
  submitters      integer not null,
  status          text not null default 'pending',
  detected_at     timestamptz not null default now(),
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  primary key (game_id, in_game_id)
);
create index if not exists companion_anomalies_status_idx on public.companion_anomalies (status);
alter table public.companion_anomalies enable row level security;
drop policy if exists "companion_anomalies_read_all" on public.companion_anomalies;

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
