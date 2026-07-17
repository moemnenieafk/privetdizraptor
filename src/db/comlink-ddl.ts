// DDL раздела «Связь» как массив стейтментов — накатывается роутом
// /api/cron/migrate-comlink (db:push с телефона недоступен, паттерн weapons-ddl).
// Все стейтменты идемпотентны, повторный прогон безопасен.
//
// RLS-политика раздела:
//   • Анкеты, темы, ответы, НЕскрытые отзывы — читают только АВТОРИЗОВАННЫЕ
//     (социальный слой закрыт от анонимов и парсеров: контакты и ники не светим).
//   • Пишет всё серверная owner-роль через API-роуты (Drizzle мимо RLS) —
//     безопасность держит сессия, как в остальном проекте.
//   • karma_events / reports — прямого доступа нет вообще (RLS без policy,
//     паттерн rate_limits): суммы кармы отдаёт API, жалобы видят модераторы.
export const COMLINK_DDL: string[] = [
  // Роль moderator: колонка role уже есть ('user' | 'admin'), просто расширяем
  // множество значений на уровне приложения — DDL не нужен. Констрейнта на role нет.

  `create table if not exists public.comlink_profiles (
    user_id       uuid not null references public.profiles(id) on delete cascade,
    game_id       uuid not null references public.games(id) on delete cascade,
    goal          text not null,
    maps          jsonb not null default '[]'::jsonb,
    play_time     jsonb not null default '[]'::jsonb,
    play_style    jsonb not null default '[]'::jsonb,
    voice         boolean not null default true,
    tz_offset     integer,
    about         text not null default '',
    active        boolean not null default true,
    game_snapshot jsonb,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    primary key (user_id, game_id)
  )`,

  `create index if not exists comlink_profiles_search_idx
     on public.comlink_profiles (game_id, active, goal)`,

  `create table if not exists public.comlink_raids (
    id           uuid primary key default gen_random_uuid(),
    game_id      uuid not null references public.games(id) on delete cascade,
    initiator_id uuid not null references public.profiles(id) on delete cascade,
    partner_id   uuid not null references public.profiles(id) on delete cascade,
    status       text not null default 'pending',
    note         text not null default '',
    created_at   timestamptz not null default now(),
    resolved_at  timestamptz
  )`,

  `create index if not exists comlink_raids_partner_idx
     on public.comlink_raids (partner_id, status)`,

  `create index if not exists comlink_raids_initiator_idx
     on public.comlink_raids (initiator_id, status)`,

  `create table if not exists public.comlink_reviews (
    raid_id    uuid not null references public.comlink_raids(id) on delete cascade,
    author_id  uuid not null references public.profiles(id) on delete cascade,
    target_id  uuid not null references public.profiles(id) on delete cascade,
    positive   boolean not null,
    comment    text not null default '',
    hidden     boolean not null default true,
    created_at timestamptz not null default now(),
    primary key (raid_id, author_id)
  )`,

  `create index if not exists comlink_reviews_target_idx
     on public.comlink_reviews (target_id, hidden)`,

  `create table if not exists public.karma_events (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.profiles(id) on delete cascade,
    reason     text not null,
    delta      integer not null,
    ref_type   text not null,
    ref_id     text not null,
    issued_by  uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
  )`,

  `create index if not exists karma_events_user_idx
     on public.karma_events (user_id)`,

  // Защита от двойного начисления: одна причина на один источник одному пользователю.
  `create unique index if not exists karma_events_dedupe_uq
     on public.karma_events (user_id, reason, ref_type, ref_id)`,

  `create table if not exists public.comlink_reports (
    id          uuid primary key default gen_random_uuid(),
    reporter_id uuid not null references public.profiles(id) on delete cascade,
    target_id   uuid not null references public.profiles(id) on delete cascade,
    ref_type    text not null,
    ref_id      text not null,
    reason      text not null,
    status      text not null default 'open',
    resolved_by uuid references public.profiles(id) on delete set null,
    resolved_at timestamptz,
    created_at  timestamptz not null default now()
  )`,

  `create index if not exists comlink_reports_queue_idx
     on public.comlink_reports (status, created_at)`,

  `create table if not exists public.comlink_topics (
    id            uuid primary key default gen_random_uuid(),
    game_id       uuid not null references public.games(id) on delete cascade,
    author_id     uuid not null references public.profiles(id) on delete cascade,
    title         text not null,
    body          text not null,
    locked        boolean not null default false,
    pinned        boolean not null default false,
    reply_count   integer not null default 0,
    last_reply_at timestamptz,
    created_at    timestamptz not null default now()
  )`,

  `create index if not exists comlink_topics_list_idx
     on public.comlink_topics (game_id, pinned, last_reply_at)`,

  `create table if not exists public.comlink_posts (
    id         uuid primary key default gen_random_uuid(),
    topic_id   uuid not null references public.comlink_topics(id) on delete cascade,
    author_id  uuid not null references public.profiles(id) on delete cascade,
    body       text not null,
    hidden     boolean not null default false,
    created_at timestamptz not null default now()
  )`,

  `create index if not exists comlink_posts_topic_idx
     on public.comlink_posts (topic_id, created_at)`,

  // Контентные подразделы: Обновления игры (импорт из Steam), Блог, Мастер-классы.
  // Один движок, различает kind. Полный текст патчноутов BSG не зеркалим — только
  // выжимка + ссылка; ценность добавляем своим разбором в body_ru.
  `create table if not exists public.comlink_articles (
    id           uuid primary key default gen_random_uuid(),
    game_id      uuid not null references public.games(id) on delete cascade,
    kind         text not null,
    title        text not null,
    slug         text not null,
    excerpt      text not null default '',
    body_ru      text not null default '',
    cover_url    text,
    source       text not null default 'cta',
    external_id  text,
    external_url text,
    published_at timestamptz not null,
    event_at     timestamptz,
    video_url    text,
    author_id    uuid references public.profiles(id) on delete set null,
    published    boolean not null default true,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
  )`,

  `create index if not exists comlink_articles_feed_idx
     on public.comlink_articles (game_id, kind, published, published_at)`,

  `create unique index if not exists comlink_articles_slug_uq
     on public.comlink_articles (game_id, slug)`,

  // Дедуп импорта: один gid Steam = одна запись (повторный синк не плодит дубли
  // и не затирает наш русский разбор).
  `create unique index if not exists comlink_articles_external_uq
     on public.comlink_articles (game_id, source, external_id)`,

  /* ─────────── RLS ─────────── */
  // Социальный контент читают только авторизованные; пишет owner-роль через API.
  `alter table public.comlink_profiles enable row level security`,
  `alter table public.comlink_raids    enable row level security`,
  `alter table public.comlink_reviews  enable row level security`,
  `alter table public.karma_events     enable row level security`,
  `alter table public.comlink_reports  enable row level security`,
  `alter table public.comlink_topics   enable row level security`,
  `alter table public.comlink_posts    enable row level security`,

  `drop policy if exists comlink_profiles_read on public.comlink_profiles`,
  `create policy comlink_profiles_read on public.comlink_profiles
     for select to authenticated using (active = true or user_id = auth.uid())`,

  // Рейды видят только участники.
  `drop policy if exists comlink_raids_read on public.comlink_raids`,
  `create policy comlink_raids_read on public.comlink_raids
     for select to authenticated
     using (initiator_id = auth.uid() or partner_id = auth.uid())`,

  // Отзывы: открытые — всем авторизованным; свой скрытый автор видит.
  `drop policy if exists comlink_reviews_read on public.comlink_reviews`,
  `create policy comlink_reviews_read on public.comlink_reviews
     for select to authenticated
     using (hidden = false or author_id = auth.uid())`,

  // karma_events и reports: прямого доступа нет (RLS без policy, паттерн rate_limits).
  // Суммы кармы отдаёт API, очередь жалоб — роут модератора.

  `drop policy if exists comlink_topics_read on public.comlink_topics`,
  `create policy comlink_topics_read on public.comlink_topics
     for select to authenticated using (true)`,

  `drop policy if exists comlink_posts_read on public.comlink_posts`,
  `create policy comlink_posts_read on public.comlink_posts
     for select to authenticated using (hidden = false or author_id = auth.uid())`,

  // Статьи и патчноуты — ПУБЛИЧНЫЕ (в отличие от анкет): их индексирует поиск,
  // это входная воронка в раздел.
  `alter table public.comlink_articles enable row level security`,
  `drop policy if exists comlink_articles_read on public.comlink_articles`,
  `create policy comlink_articles_read on public.comlink_articles
     for select using (published = true)`,

  /* ─────────── player_verifications: подтверждение ЧВК-профиля ───────────
   * Ручная верификация (BSG-владение напрямую не доказуемо): код-челлендж +
   * скрин + разбор модератором. Доступ гейтит POST-роут (только платные тиры).
   * Скрин-пруф — инлайн base64 в jsonb (патттерн feedback). RLS: читает только
   * владелец свою строку; пишет owner-роль через API. Очередь модерации отдаёт
   * серверный роут (Drizzle мимо RLS). */
  `create table if not exists public.player_verifications (
    user_id          uuid not null references public.profiles(id) on delete cascade,
    game_id          uuid not null references public.games(id) on delete cascade,
    status           text not null default 'awaiting',
    claimed_nickname text not null default '',
    code             text not null,
    account_ref      text,
    proof            jsonb,
    note             text not null default '',
    reviewed_by      uuid references public.profiles(id) on delete set null,
    reviewed_at      timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    primary key (user_id, game_id)
  )`,

  `create index if not exists player_verifications_queue_idx
     on public.player_verifications (status, updated_at)`,

  `alter table public.player_verifications enable row level security`,
  `drop policy if exists player_verifications_read on public.player_verifications`,
  `create policy player_verifications_read on public.player_verifications
     for select to authenticated using (user_id = auth.uid())`,
];
