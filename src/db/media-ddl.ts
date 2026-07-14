// DDL медиа-библиотеки — накатывается роутом /api/cron/migrate-media. Идемпотентно.
//
// RLS: прямого клиентского доступа к таблице НЕТ (enable без policy, паттерн
// rate_limits/feedback). Каталог видит только CMS через серверные роуты; сами файлы
// в бакете и так публичны по URL — прятать их бессмысленно, а вот кто и когда залил —
// внутренняя информация.
export const MEDIA_DDL: string[] = [
  `create table if not exists public.media_assets (
    id          uuid primary key default gen_random_uuid(),
    path        text not null,
    url         text not null,
    mime        text not null,
    bytes       integer not null,
    alt         text not null default '',
    uploaded_by uuid references public.profiles(id) on delete set null,
    created_at  timestamptz not null default now()
  )`,

  `create unique index if not exists media_assets_path_uq on public.media_assets (path)`,
  `create index if not exists media_assets_recent_idx on public.media_assets (created_at desc)`,

  `alter table public.media_assets enable row level security`,
];
