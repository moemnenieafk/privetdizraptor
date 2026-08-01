// ЕДИНАЯ ТАБЛИЦА МАРКЕРОВ — Фаза 1 решения docs/decisions/unified-markers.md.
// ⚠️ ПРЕДЛОЖЕНИЕ (не активно): таблица создаётся, но НИ ОДИН ридер/райтер на неё ещё не переведён
//    (Фазы 2–4). Пока не запущен `db:migrate-all` — на прод не влияет. Создание идемпотентно и
//    аддитивно (create if not exists), db:push её НЕ трогает (не в schema.ts) → чужой db:push не
//    откатит RLS этой таблицы. Паттерн — как editorial-markers-ddl.ts (накат db:migrate-all,
//    auto-discovery по экспорту *_DDL). Query-дефиниция для Drizzle — schema-markers.ts.
//
// НАЗНАЧЕНИЕ: synced (tarkov.dev, зеркалит крон) и user (Wizard/CMS) маркеры — граждане одного
// класса в ОДНОМ хранилище и ОДНОМ рендер-пайплайне. Различает их `source`:
//   • source='sync' — пишет/прюнит ТОЛЬКО крон-синк (WHERE source='sync'); user неприкосновенен.
//   • source='user' — Wizard пишет самостоятельную строку ИЛИ оверрайд синканной (source_marker_id
//     → external_id базовой sync-строки; подавляет/дополняет её на рендере; hidden — скрыть).
//
// РАЗРЕШЁННЫЕ РАЗВИЛКИ (заметка §«Открытые развилки» — ПОДТВЕРДИТЬ перед накатом):
//   1. PK: surrogate uuid + external_id(text) для sync (partial-unique по map_id+external_id).
//   2. Координаты: real-колонки x/y/z (как editorial), НЕ jsonb (как map_markers) — индексируемо.
//      x/y/z NULLABLE: боссы (спавн по зоне, без точки) и чисто-полигональные зоны.
//   3. Вокабуляр типов: канон = SYNCED-имена (loot_container/loot_loose/stationary_weapon);
//      миграция editorial маппит container→loot_container и т.д. (прецедент — editorial-bridge.ts).
//   4. Полигон зоны: одно jsonb-поле `polygon` (outline map_markers + polygon editorial → сюда).
//   5. Размещение: DDL-модуль (db:migrate-all), НЕ schema.ts+db:push — безопаснее (см. шапку).
export const MARKERS_DDL: string[] = [
  `create table if not exists public.markers (
    id               uuid primary key default gen_random_uuid(),
    game_id          uuid not null references public.games(id) on delete cascade,
    map_id           text not null references public.maps(id) on delete cascade,
    source           text not null,                       -- 'sync' | 'user'
    external_id      text,                                -- tarkov.dev id (source='sync'); null у user
    type             text not null,                       -- канон MapMarkerKind (synced-вокабуляр)
    floor            integer,                             -- этаж мультиэтажки; null — базовый
    x                real,                                -- nullable: боссы/зоны без точки
    y                real,
    z                real,
    top              real,                                -- диапазон игровой высоты (sync, фильтр этажа)
    bottom           real,
    polygon          jsonb,                               -- точки зоны (outline/лассо)
    label            text,
    faction          text,                                -- 'all'|'pmc'|'scav'
    sides            jsonb,                               -- string[] (spawn)
    categories       jsonb,                               -- string[] (spawn: boss/sniper/…)
    linked_item_id   text,                                -- контейнер/лут/ключ замка/transferItem
    linked_quest_id  text,                                -- зона объектива квеста
    meta             jsonb,                               -- тип-специфичная нагрузка
    -- user-надстройка (из editorial_markers):
    category         text,
    title            text,
    description      text,
    screenshots      jsonb not null default '[]'::jsonb,
    link_kind        text not null default 'none',        -- 'story'|'quest'|'event'|'item'|'none'
    link_id          text,
    link_step        integer,
    source_marker_id text,                                -- оверрайд synced → external_id базовой строки
    hidden           boolean not null default false,      -- подавить synced на рендере
    author_id        uuid references public.profiles(id) on delete set null,
    synced_at        timestamptz,                         -- метка кронового апсерта (source='sync')
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
  )`,

  // Прюн крона — per-map И ТОЛЬКО source='sync' (user-маркеры крон не видит).
  `create index if not exists markers_map_source_idx on public.markers (map_id, source)`,
  // Рендер/фильтр по типу на карте.
  `create index if not exists markers_map_type_idx on public.markers (game_id, map_id, type)`,
  // Оверрайды synced ищутся по source_marker_id (мерж на рендере) — как editorial.
  `create index if not exists markers_source_marker_idx on public.markers (source_marker_id)`,
  // Привязка к квесту/истории (чип СЮЖЕТ, quest-слой).
  `create index if not exists markers_link_idx on public.markers (link_kind, link_id)`,
  // Апсерт крона: одна sync-строка на (map_id, external_id). Partial — user строки не ограничены.
  `create unique index if not exists markers_sync_external_uidx
     on public.markers (map_id, external_id) where source = 'sync'`,

  `alter table public.markers enable row level security`,

  // Публике — чтение всех (маркеры публичны, нужны для рендера/SEO). Запись отдаёт сервер
  // (owner-роль, обходит RLS): крон — source='sync'; /api/admin/* — source='user' после проверки роли.
  `drop policy if exists markers_read on public.markers`,
  `create policy markers_read on public.markers
     for select using (true)`,
];
