// DDL слоя обсуждений — накатывается РОУТОМ (/api/cron/migrate-entity-comments).
//
//   entity_comments       — комментарии к ЛЮБОЙ сущности портала
//   entity_comment_votes  — голоса «Полезно», дедуп составным PK
//
// Полиморфная цель (target_type + target_id) вместо FK на конкретную таблицу:
// обсуждение вешается на сборки, патчи, Кодекс, боссов и торговцев одним слоем.
// Цена решения — нет ссылочной целостности на уровне БД, поэтому существование
// цели проверяет сервер (src/lib/comment-targets.server.ts) до вставки.
//
// Первые стейтменты сносят недолгий build_comments (жёсткий FK на weapon_builds):
// таблица была пуста, данных не теряем. Повторный прогон безопасен.
export const COMMENTS_DDL: string[] = [
  `create extension if not exists pgcrypto`,

  // ─── снос предыдущей, узкой версии слоя (была пуста)
  `drop table if exists public.build_comment_votes cascade`,
  `drop table if exists public.build_comments cascade`,

  `create table if not exists public.entity_comments (
    id          uuid primary key default gen_random_uuid(),
    target_type text not null,
    target_id   text not null,
    user_id     uuid not null references public.profiles(id) on delete cascade,
    body        text not null,
    score       integer not null default 0,
    hidden_at   timestamptz,
    hidden_by   uuid references public.profiles(id) on delete set null,
    deleted_at  timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
  )`,

  // ─── ветки-ответы + метка правки (модернизация обсуждений 2026-08-28). Аддитивно:
  // добавляем колонки к существующей таблице, если их ещё нет.
  `alter table public.entity_comments add column if not exists parent_id uuid`,
  `alter table public.entity_comments add column if not exists edited_at timestamptz`,
  `do $$ begin
     if not exists (select 1 from pg_constraint where conname = 'entity_comments_parent_fk') then
       alter table public.entity_comments
         add constraint entity_comments_parent_fk
         foreign key (parent_id) references public.entity_comments(id) on delete cascade;
     end if;
   end $$`,
  `create index if not exists entity_comments_parent_idx
     on public.entity_comments (parent_id, created_at)`,

  // Лента сущности: сорт «новые» и «лучшие».
  `create index if not exists entity_comments_target_idx
     on public.entity_comments (target_type, target_id, created_at desc)`,
  `create index if not exists entity_comments_score_idx
     on public.entity_comments (target_type, target_id, score desc)`,
  // Лента модерации: свежее по всему порталу.
  `create index if not exists entity_comments_recent_idx
     on public.entity_comments (created_at desc)`,

  `create table if not exists public.entity_comment_votes (
    comment_id uuid not null references public.entity_comments(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    value      integer not null default 1,
    created_at timestamptz not null default now(),
    primary key (comment_id, user_id)
  )`,

  `create index if not exists entity_comment_votes_user_idx
     on public.entity_comment_votes (user_id)`,

  // ─── RLS. Пишем Drizzle owner-ролью (мимо RLS); политики закрывают прямой доступ
  // supabase-клиента. Гейт «писать может платный тир» — в роуте, в SQL тира нет.
  `alter table public.entity_comments enable row level security`,
  `drop policy if exists entity_comments_read on public.entity_comments`,
  `create policy entity_comments_read on public.entity_comments
     for select using (deleted_at is null and hidden_at is null or user_id = auth.uid())`,
  `drop policy if exists entity_comments_owner_write on public.entity_comments`,
  `create policy entity_comments_owner_write on public.entity_comments
     for all using (user_id = auth.uid()) with check (user_id = auth.uid())`,

  `alter table public.entity_comment_votes enable row level security`,
  `drop policy if exists entity_comment_votes_read on public.entity_comment_votes`,
  `create policy entity_comment_votes_read on public.entity_comment_votes
     for select using (true)`,
  `drop policy if exists entity_comment_votes_owner_write on public.entity_comment_votes`,
  `create policy entity_comment_votes_owner_write on public.entity_comment_votes
     for all using (user_id = auth.uid()) with check (user_id = auth.uid())`,
];
