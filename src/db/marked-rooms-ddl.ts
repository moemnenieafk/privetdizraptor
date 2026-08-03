// МЕЧЕНЫЕ И ЦВЕТНЫЕ КОМНАТЫ — трекер открытий. Решение docs/decisions/done/marked-rooms.md (Фаза 1).
// ⚠️ Таблицы создаются аддитивно и идемпотентно (create if not exists); db:push их НЕ трогает
//    (не в schema.ts) → чужой db:push не откатит их RLS. Паттерн — markers-ddl.ts (накат
//    db:migrate-all, auto-discovery по экспорту *_DDL). Query-дефиниция для Drizzle —
//    schema-marked-rooms.ts.
//
// МОДЕЛЬ: marked_rooms (реестр комнат) ◄─ room_opens (заявки-открытия) ◄─ room_open_items (предметы);
//    reputation_events (леджер репутации, баланс = sum(delta)).
// §4.11: room_opens — НАША community-таблица (UGC после модерации), НЕ зеркало внешнего API →
//    легальная запись. Пишет сервер owner-ролью (обходит RLS); RLS ниже — публичный/анон floor.
export const MARKED_ROOMS_DDL: string[] = [
  // ── marked_rooms: реестр (сущность страницы + границы подсветки на карте) ──
  `create table if not exists public.marked_rooms (
    id            uuid primary key default gen_random_uuid(),
    game_id       uuid not null references public.games(id) on delete cascade,
    map_id        text not null references public.maps(id) on delete cascade,
    slug          text not null,                       -- маршрут /eft/maps/<map>/rooms/<slug>
    kind          text not null,                       -- 'marked' | 'lab_color'
    color         text,                                -- цветные Лабы: 'black'|'purple'|'green'|…
    key_item_id   text,                                -- ключ/карта (id зеркала цен) → экономика
    polygon       jsonb,                               -- границы подсветки (точки зоны)
    title         text not null,
    description   text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
  )`,
  `create unique index if not exists marked_rooms_slug_uidx on public.marked_rooms (game_id, map_id, slug)`,
  `create index if not exists marked_rooms_map_idx on public.marked_rooms (map_id)`,

  // ── room_opens: одно открытие (заявка сообщества) ──
  `create table if not exists public.room_opens (
    id                   uuid primary key default gen_random_uuid(),
    room_id              uuid not null references public.marked_rooms(id) on delete cascade,
    author_id            uuid references public.profiles(id) on delete set null,  -- держим для модерации/антиабуза
    is_anonymous         boolean not null default false,   -- скрыть авторство на странице
    status               text not null default 'pending',  -- 'pending'|'approved'|'rejected'
    moderator_id         uuid references public.profiles(id) on delete set null,
    moderated_at         timestamptz,
    proof_youtube_url    text,
    proof_screenshot_key text,                          -- ключ ВРЕМЕННОГО бакета; → null после авто-удаления
    game_version         text,                          -- регламент пруфов: видна версия игры
    opened_at            timestamptz,
    created_at           timestamptz not null default now()
  )`,
  `create index if not exists room_opens_room_status_idx on public.room_opens (room_id, status, created_at desc)`,

  // ── room_open_items: предметы открытия (M:N; лента + пересчёт шанса по 100 последним) ──
  `create table if not exists public.room_open_items (
    open_id  uuid not null references public.room_opens(id) on delete cascade,
    item_id  text not null,                             -- id зеркала цен
    qty      integer not null default 1,
    primary key (open_id, item_id)
  )`,

  // ── reputation_events: леджер (баланс = sum(delta)) ──
  `create table if not exists public.reputation_events (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.profiles(id) on delete cascade,
    delta      integer not null,
    reason     text not null,                           -- 'room_open_approved'|…
    ref_type   text,
    ref_id     text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists reputation_events_user_idx on public.reputation_events (user_id)`,

  // ── RLS: чтение — публичный/анон floor; запись отдаёт сервер owner-ролью (обходит RLS) ──
  `alter table public.marked_rooms enable row level security`,
  `drop policy if exists marked_rooms_read on public.marked_rooms`,
  `create policy marked_rooms_read on public.marked_rooms for select using (true)`,

  // Публике видны ТОЛЬКО одобренные открытия; pending/rejected читает сервер (owner-роль).
  `alter table public.room_opens enable row level security`,
  `drop policy if exists room_opens_read on public.room_opens`,
  `create policy room_opens_read on public.room_opens for select using (status = 'approved')`,

  `alter table public.room_open_items enable row level security`,
  `drop policy if exists room_open_items_read on public.room_open_items`,
  `create policy room_open_items_read on public.room_open_items for select using (true)`,

  // Репутация — только своя строка (лидерборд-публичность добавим позже, если понадобится).
  `alter table public.reputation_events enable row level security`,
  `drop policy if exists reputation_events_read on public.reputation_events`,
  `create policy reputation_events_read on public.reputation_events for select using ((select auth.uid()) = user_id)`,
];
