// DDL слоя сборок оружия как массив стейтментов — накатывается РОУТОМ
// (/api/cron/migrate-weapon-builds), когда доступа к SQL Editor нет (мобильный воркфлоу).
//
// Заводит две таблицы:
//   weapon_builds        — облачные + community-сборки (снимок дерева + статов, slug, likes)
//   weapon_build_likes   — дедуп лайков (один пользователь = один лайк на сборку)
//
// Формы 1:1 совпадают с Drizzle-схемой (src/db/schema.ts): weaponBuilds / weaponBuildLikes.
// SQL-зеркало для истории — supabase/weapon-builds.sql. Источник истины — этот файл.
//
// Все стейтменты ИДЕМПОТЕНТНЫ (if not exists / drop policy if exists) — повторный
// прогон безопасен.
export const BUILD_DDL: string[] = [
  `create extension if not exists pgcrypto`,

  `create table if not exists public.weapon_builds (
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
  )`,

  `create index if not exists weapon_builds_user_idx
     on public.weapon_builds (user_id, game_id)`,

  `create index if not exists weapon_builds_public_idx
     on public.weapon_builds (is_public, base_item_id)`,

  `create table if not exists public.weapon_build_likes (
    build_id   uuid not null references public.weapon_builds(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (build_id, user_id)
  )`,

  `create index if not exists weapon_build_likes_user_idx
     on public.weapon_build_likes (user_id)`,

  // ─── RLS. Пишем через Drizzle owner-ролью (мимо RLS) — политики защищают прямой
  // доступ supabase-клиента: публичные сборки читают все, править может только владелец.
  `alter table public.weapon_builds enable row level security`,
  `drop policy if exists weapon_builds_public_read on public.weapon_builds`,
  `create policy weapon_builds_public_read on public.weapon_builds
     for select using (is_public = true or user_id = auth.uid())`,
  `drop policy if exists weapon_builds_owner_write on public.weapon_builds`,
  `create policy weapon_builds_owner_write on public.weapon_builds
     for all using (user_id = auth.uid()) with check (user_id = auth.uid())`,

  `alter table public.weapon_build_likes enable row level security`,
  `drop policy if exists weapon_build_likes_read on public.weapon_build_likes`,
  `create policy weapon_build_likes_read on public.weapon_build_likes
     for select using (true)`,
  `drop policy if exists weapon_build_likes_owner_write on public.weapon_build_likes`,
  `create policy weapon_build_likes_owner_write on public.weapon_build_likes
     for all using (user_id = auth.uid()) with check (user_id = auth.uid())`,
];
