// DDL сюжетных гайдов — накатывается роутом /api/cron/migrate-stories. Идемпотентно.
// RLS: публике только published; черновики и запись — owner-роль через API (canEditContent).
export const STORY_DDL: string[] = [
  `create table if not exists public.story_guides (
    id         uuid primary key default gen_random_uuid(),
    game_id    uuid not null references public.games(id) on delete cascade,
    slug       text not null,
    title      text not null,
    doc        jsonb not null,
    published  boolean not null default true,
    author_id  uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,

  `create unique index if not exists story_guides_slug_uq on public.story_guides (game_id, slug)`,
  `create index if not exists story_guides_list_idx on public.story_guides (game_id, published)`,

  `alter table public.story_guides enable row level security`,

  `drop policy if exists story_guides_read on public.story_guides`,
  `create policy story_guides_read on public.story_guides
     for select using (published = true)`,
];
