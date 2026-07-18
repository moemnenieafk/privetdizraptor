// DDL слоя комментариев к сборкам — накатывается РОУТОМ
// (/api/cron/migrate-build-comments), мобильный воркфлоу без SQL Editor.
//
//   build_comments       — ветка под опубликованной сборкой (плоская, без тредов)
//   build_comment_votes  — голоса, дедуп через составной PK (один голос на человека)
//
// `value` заведён как integer (не boolean) СПЕЦИАЛЬНО: сейчас пишем только +1
// («Полезно»), но если решим включить минусы — меняется валидация в роуте и UI,
// схема и агрегаты остаются как есть.
//
// Формы 1:1 с Drizzle-схемой (buildComments / buildCommentVotes в src/db/schema.ts).
// SQL-зеркало — supabase/build-comments.sql. Все стейтменты идемпотентны.
export const COMMENTS_DDL: string[] = [
  `create extension if not exists pgcrypto`,

  `create table if not exists public.build_comments (
    id         uuid primary key default gen_random_uuid(),
    build_id   uuid not null references public.weapon_builds(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    body       text not null,
    score      integer not null default 0,
    -- модерация: скрыто модератором (видно только ему и автору)
    hidden_at  timestamptz,
    hidden_by  uuid references public.profiles(id) on delete set null,
    -- мягкое удаление автором: строку держим ради целостности голосов
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,

  `create index if not exists build_comments_build_idx
     on public.build_comments (build_id, created_at desc)`,

  `create index if not exists build_comments_score_idx
     on public.build_comments (build_id, score desc)`,

  `create table if not exists public.build_comment_votes (
    comment_id uuid not null references public.build_comments(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    value      integer not null default 1,
    created_at timestamptz not null default now(),
    primary key (comment_id, user_id)
  )`,

  `create index if not exists build_comment_votes_user_idx
     on public.build_comment_votes (user_id)`,

  // ─── RLS. Пишем Drizzle owner-ролью (мимо RLS); политики закрывают прямой доступ
  // supabase-клиента. Гейт «писать может платный тир» живёт в роуте — в SQL тира нет.
  `alter table public.build_comments enable row level security`,
  `drop policy if exists build_comments_read on public.build_comments`,
  `create policy build_comments_read on public.build_comments
     for select using (deleted_at is null and hidden_at is null or user_id = auth.uid())`,
  `drop policy if exists build_comments_owner_write on public.build_comments`,
  `create policy build_comments_owner_write on public.build_comments
     for all using (user_id = auth.uid()) with check (user_id = auth.uid())`,

  `alter table public.build_comment_votes enable row level security`,
  `drop policy if exists build_comment_votes_read on public.build_comment_votes`,
  `create policy build_comment_votes_read on public.build_comment_votes
     for select using (true)`,
  `drop policy if exists build_comment_votes_owner_write on public.build_comment_votes`,
  `create policy build_comment_votes_owner_write on public.build_comment_votes
     for all using (user_id = auth.uid()) with check (user_id = auth.uid())`,
];
