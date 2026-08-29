// DDL соц-слоя сборок сезонных перков — накатывается `db:migrate-all` (авто-подхват
// любого *-ddl.ts с экспортом *_DDL) и роутом /api/cron/migrate-season-builds.
//
//   season_builds           — канонизация расшаренной сборки как строки: slug ↔ code,
//                             + денорм-счётчики лайков/дизлайков (up/down)
//   season_build_reactions  — реакции пользователей, дедуп составным PK (одна на юзера),
//                             value ∈ {+1,-1} (лайк/дизлайк)
//
// Зачем строка на stateless-сборку: код сборки (encodeBuild, с точками, ~100 симв.) НЕ
// проходит TARGET_ID_RE реестра целей комментов (без точек, ≤66). Поэтому у сборки —
// короткий url-safe slug: он и target_id ветки обсуждения, и ключ реакций. Строка также
// даёт slug→code для ленты модерации.
//
// Формы 1:1 совпадают с Drizzle-схемой (src/db/schema.ts): seasonBuilds / seasonBuildReactions.
// Все стейтменты идемпотентны (if not exists / drop policy if exists) — повторный прогон безопасен.
export const SEASON_BUILDS_DDL: string[] = [
  `create extension if not exists pgcrypto`,

  `create table if not exists public.season_builds (
    id          uuid primary key default gen_random_uuid(),
    slug        text unique not null,
    code        text unique not null,
    season_slug text not null,
    up          integer not null default 0,
    down        integer not null default 0,
    created_at  timestamptz not null default now()
  )`,

  `create index if not exists season_builds_season_idx
     on public.season_builds (season_slug)`,

  `create table if not exists public.season_build_reactions (
    build_id   uuid not null references public.season_builds(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    value      smallint not null,
    created_at timestamptz not null default now(),
    primary key (build_id, user_id)
  )`,

  `create index if not exists season_build_reactions_user_idx
     on public.season_build_reactions (user_id)`,

  // ─── RLS. Пишем через Drizzle owner-ролью (мимо RLS) — политики защищают прямой доступ
  // supabase-клиента. Сами сборки читают все, пишет только сервер (owner-роль, политики нет
  // на запись — прямой клиент вставить не может). Реакции читают все, правит только владелец.
  `alter table public.season_builds enable row level security`,
  `drop policy if exists season_builds_read on public.season_builds`,
  `create policy season_builds_read on public.season_builds
     for select using (true)`,

  `alter table public.season_build_reactions enable row level security`,
  `drop policy if exists season_build_reactions_read on public.season_build_reactions`,
  `create policy season_build_reactions_read on public.season_build_reactions
     for select using (true)`,
  `drop policy if exists season_build_reactions_owner_write on public.season_build_reactions`,
  `create policy season_build_reactions_owner_write on public.season_build_reactions
     for all using (user_id = auth.uid()) with check (user_id = auth.uid())`,
];
