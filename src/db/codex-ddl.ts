// DDL Кодекса как массив стейтментов — накатывается роутом /api/cron/migrate-codex
// (db:push с телефона недоступен; паттерн comlink-ddl / weapons-ddl). Идемпотентно.
//
// RLS: читают опубликованное все (лор — публичный контент, ради него и SEO);
// черновики и запись — только серверная owner-роль через API-роуты, где безопасность
// держит сессия (canEditContent). Прямого клиентского доступа к таблице нет.
export const CODEX_DDL: string[] = [
  `create table if not exists public.codex_articles (
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

  `create unique index if not exists codex_articles_slug_uq
     on public.codex_articles (game_id, slug)`,

  `create index if not exists codex_articles_list_idx
     on public.codex_articles (game_id, published, title)`,

  `alter table public.codex_articles enable row level security`,

  // Публике — только опубликованное. Черновики отдаёт сервер (owner-роль) после проверки роли.
  `drop policy if exists codex_articles_read on public.codex_articles`,
  `create policy codex_articles_read on public.codex_articles
     for select using (published = true)`,
];
