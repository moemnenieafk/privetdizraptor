// DDL таблицы editorial_markers как массив стейтментов — накатывается db:migrate-all
// (auto-discovery по экспорту *_DDL; db:push с телефона недоступен, паттерн codex-ddl).
// Идемпотентно. Решения: docs/decisions/editorial-markers-tool.md.
//
// Назначение: ручные маркеры карт (координаты + скрины + описание + привязка к квесту),
// которые админ/модератор вбивает через редактор. Отдельно от map_markers, потому что синк
// геометрии tarkov.dev прюнит map_markers по свежему набору — ручной маркер там снесло бы.
//
// RLS: читают все (маркеры публичны — рендерятся на карте, нужны для SEO); запись — только
// серверная owner-роль через /api/admin/editorial-markers после проверки canEditContent.
export const EDITORIAL_MARKERS_DDL: string[] = [
  `create table if not exists public.editorial_markers (
    id          uuid primary key default gen_random_uuid(),
    game_id     uuid not null references public.games(id) on delete cascade,
    map_id      text not null references public.maps(id) on delete cascade,
    floor       integer,
    x           real not null,
    y           real,
    z           real not null,
    type        text not null default 'poi',
    category    text,
    faction     text,
    title       text not null,
    description text,
    screenshots jsonb not null default '[]'::jsonb,
    link_kind   text not null default 'none',
    link_id     text,
    link_step   integer,
    polygon     jsonb,
    author_id   uuid references public.profiles(id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
  )`,

  // Аддитивно для уже созданной таблицы (create if not exists её бы пропустил).
  `alter table public.editorial_markers add column if not exists faction text`,
  `alter table public.editorial_markers add column if not exists polygon jsonb`,

  `create index if not exists editorial_markers_map_idx
     on public.editorial_markers (game_id, map_id)`,

  // Привязка к квесту/истории — для чипа СЮЖЕТ (фаза B) и quest-слоя.
  `create index if not exists editorial_markers_link_idx
     on public.editorial_markers (link_kind, link_id)`,

  `alter table public.editorial_markers enable row level security`,

  // Публике — чтение всех (маркеры публичны). Запись отдаёт сервер (owner-роль) после проверки роли.
  `drop policy if exists editorial_markers_read on public.editorial_markers`,
  `create policy editorial_markers_read on public.editorial_markers
     for select using (true)`,
];
