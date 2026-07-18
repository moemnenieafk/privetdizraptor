-- Зеркало src/db/build-ddl.ts (источник истины — TS-файл, накат через
-- /api/cron/migrate-weapon-builds). Здесь — для тех, у кого есть SQL Editor.
-- Идемпотентно.

create extension if not exists pgcrypto;

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

create index if not exists weapon_builds_user_idx   on public.weapon_builds (user_id, game_id);
create index if not exists weapon_builds_public_idx  on public.weapon_builds (is_public, base_item_id);

create table if not exists public.weapon_build_likes (
  build_id   uuid not null references public.weapon_builds(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (build_id, user_id)
);

create index if not exists weapon_build_likes_user_idx on public.weapon_build_likes (user_id);

alter table public.weapon_builds enable row level security;
drop policy if exists weapon_builds_public_read on public.weapon_builds;
create policy weapon_builds_public_read on public.weapon_builds
  for select using (is_public = true or user_id = auth.uid());
drop policy if exists weapon_builds_owner_write on public.weapon_builds;
create policy weapon_builds_owner_write on public.weapon_builds
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.weapon_build_likes enable row level security;
drop policy if exists weapon_build_likes_read on public.weapon_build_likes;
create policy weapon_build_likes_read on public.weapon_build_likes
  for select using (true);
drop policy if exists weapon_build_likes_owner_write on public.weapon_build_likes;
create policy weapon_build_likes_owner_write on public.weapon_build_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
