-- Модернизация обсуждений (2026-08-28): ветки-ответы + метка правки.
-- ⚠️ Таблица public.entity_comments принадлежит роли supabase_admin, а наша тулза
--    (db:sql / db:migrate-all) ходит под postgres → ALTER падает с "must be owner".
--    Поэтому применять ПРИВИЛЕГИРОВАННОЙ ролью: self-hosted Supabase Studio → SQL Editor,
--    либо на VPS `docker exec -u postgres <db-container> psql` как суперпользователь.
-- Идемпотентно, аддитивно, обратимо (колонки nullable).
alter table public.entity_comments add column if not exists parent_id uuid;
alter table public.entity_comments add column if not exists edited_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'entity_comments_parent_fk') then
    alter table public.entity_comments
      add constraint entity_comments_parent_fk
      foreign key (parent_id) references public.entity_comments(id) on delete cascade;
  end if;
end $$;

create index if not exists entity_comments_parent_idx
  on public.entity_comments (parent_id, created_at);
