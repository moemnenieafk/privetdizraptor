-- Оружейный слой CTA: конструктор сборок (weapon_bases/slots/parts/presets)
-- + облачные сборки игрока (weapon_builds).
--
-- Накатывается через SQL Editor (db:push недоступен с телефона). Идемпотентно:
-- IF NOT EXISTS везде, повторный прогон безопасен.
--
-- Зеркало tarkov.dev. ВАЖНО: recoil_modifier / accuracy_modifier хранятся ДОЛЕЙ
-- (-0.06 = −6%), как в источнике. Складывает их движок src/lib/weapon-build.ts.

/* ─────────────── weapon_bases: оружие-база ─────────────── */
create table if not exists public.weapon_bases (
  game_id             uuid not null references public.games(id) on delete cascade,
  item_id             text not null,
  caliber             text,
  ergonomics          real not null default 0,
  recoil_vertical     integer not null default 0,
  recoil_horizontal   integer not null default 0,
  fire_rate           integer,
  fire_modes          jsonb,
  sighting_range      integer,
  center_of_impact    real,
  deviation_curve     real,
  deviation_max       real,
  default_preset_id   text,
  default_ammo_id     text,
  allowed_ammo_ids    jsonb not null default '[]'::jsonb,
  synced_at           timestamptz not null default now(),
  primary key (game_id, item_id)
);

/* ─────────────── weapon_slots: дерево слотов ───────────────
   Родитель — оружие ИЛИ сам модуль (планка → крышка → прицел).
   allowed_item_ids уже с вычтенными excluded: пикер фильтрует IN-проверкой. */
create table if not exists public.weapon_slots (
  game_id          uuid not null references public.games(id) on delete cascade,
  parent_item_id   text not null,
  slot_id          text not null,
  name_id          text not null,
  name             text not null,
  required         boolean not null default false,
  ord              integer not null default 0,
  allowed_item_ids jsonb not null default '[]'::jsonb,
  synced_at        timestamptz not null default now(),
  primary key (game_id, parent_item_id, slot_id)
);

create index if not exists weapon_slots_parent_idx
  on public.weapon_slots (game_id, parent_item_id);

/* ─────────────── weapon_parts: модуль ИЛИ патрон ─────────────── */
create table if not exists public.weapon_parts (
  game_id               uuid not null references public.games(id) on delete cascade,
  item_id               text not null,
  kind                  text not null,               -- 'mod' | 'ammo'
  ergonomics            real not null default 0,     -- плоская прибавка, может быть < 0
  recoil_modifier       real not null default 0,     -- доля
  accuracy_modifier     real not null default 0,     -- доля
  velocity              real not null default 0,     -- % к скорости пули (мод)
  loudness              integer not null default 0,
  capacity              integer,                     -- магазины
  initial_speed         real,                        -- патроны
  conflicting_item_ids  jsonb not null default '[]'::jsonb,
  conflicting_slot_ids  jsonb not null default '[]'::jsonb,
  synced_at             timestamptz not null default now(),
  primary key (game_id, item_id)
);

create index if not exists weapon_parts_kind_idx
  on public.weapon_parts (game_id, kind);

/* ─────────────── weapon_presets ───────────────
   Пресет = самостоятельный item со своим id → у него есть СОБСТВЕННАЯ отрендеренная
   картинка собранного ствола. Отсюда hero-картинки сборок. */
create table if not exists public.weapon_presets (
  id                 text primary key,
  game_id            uuid not null references public.games(id) on delete cascade,
  base_item_id       text not null,
  name               text not null,
  is_default         boolean not null default false,
  ergonomics         real,
  recoil_vertical    integer,
  recoil_horizontal  integer,
  moa                real,
  parts              jsonb not null default '[]'::jsonb,
  synced_at          timestamptz not null default now()
);

create index if not exists weapon_presets_base_idx
  on public.weapon_presets (game_id, base_item_id);

/* ─────────────── weapon_builds: сборки игрока ───────────────
   tree 1:1 = BuildNode из src/lib/weapon-build.ts → синк без конвертации.
   stats — денормализованный снимок (сортировка ленты + OG-картинка без справочника). */
create table if not exists public.weapon_builds (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  game_id       uuid not null references public.games(id) on delete cascade,
  name          text not null,
  purpose       text not null default '',
  base_item_id  text not null,
  tree          jsonb not null,
  stats         jsonb not null,
  is_public     boolean not null default false,
  slug          text unique,
  likes         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists weapon_builds_user_idx
  on public.weapon_builds (user_id, game_id);

create index if not exists weapon_builds_public_idx
  on public.weapon_builds (is_public, base_item_id);

/* ─────────────── RLS ───────────────
   Справочные weapon_* (bases/slots/parts/presets) — читает кто угодно, пишет только
   owner-роль (Drizzle ходит мимо RLS). Пишущих policy НЕТ намеренно. */
alter table public.weapon_bases   enable row level security;
alter table public.weapon_slots   enable row level security;
alter table public.weapon_parts   enable row level security;
alter table public.weapon_presets enable row level security;

drop policy if exists weapon_bases_read   on public.weapon_bases;
drop policy if exists weapon_slots_read   on public.weapon_slots;
drop policy if exists weapon_parts_read   on public.weapon_parts;
drop policy if exists weapon_presets_read on public.weapon_presets;

create policy weapon_bases_read   on public.weapon_bases   for select using (true);
create policy weapon_slots_read   on public.weapon_slots   for select using (true);
create policy weapon_parts_read   on public.weapon_parts   for select using (true);
create policy weapon_presets_read on public.weapon_presets for select using (true);

-- Сборки: свои — целиком, чужие — только опубликованные.
alter table public.weapon_builds enable row level security;

drop policy if exists weapon_builds_select on public.weapon_builds;
drop policy if exists weapon_builds_insert on public.weapon_builds;
drop policy if exists weapon_builds_update on public.weapon_builds;
drop policy if exists weapon_builds_delete on public.weapon_builds;

create policy weapon_builds_select on public.weapon_builds
  for select using (auth.uid() = user_id or is_public = true);

create policy weapon_builds_insert on public.weapon_builds
  for insert with check (auth.uid() = user_id);

create policy weapon_builds_update on public.weapon_builds
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy weapon_builds_delete on public.weapon_builds
  for delete using (auth.uid() = user_id);