// DDL чекпоинтов прогресса (именованные save-слоты). Идемпотентно — накатывается
// `db:migrate-all` (авто-подхват по экспорту *_DDL). db:push с телефона недоступен,
// поэтому таблица живёт DDL-модулем (паттерн comlink-ddl).
//
// RLS: юзер читает ТОЛЬКО свои строки (user_id = auth.uid()); пишет owner-роль через
// API-роуты (Drizzle мимо RLS) — безопасность держит сессия, как в остальном проекте.
export const CHECKPOINTS_DDL: string[] = [
  `create table if not exists public.cta_quest_checkpoints (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.profiles(id) on delete cascade,
    game_id    uuid not null references public.games(id) on delete cascade,
    name       text not null,
    payload    jsonb not null,
    created_at timestamptz not null default now()
  )`,

  `create index if not exists cta_quest_checkpoints_list_idx
     on public.cta_quest_checkpoints (user_id, game_id, created_at desc)`,

  // Слоты: 0 = автосохранение (страховка перед restore/сбросом), 1..3 = ручные.
  // Максимум 4 строки на юзера+игру; сохранение = upsert по слоту.
  `alter table public.cta_quest_checkpoints add column if not exists slot smallint not null default 1`,
  `create unique index if not exists cta_quest_checkpoints_slot_uq
     on public.cta_quest_checkpoints (user_id, game_id, slot)`,

  /* ─────────── RLS ─────────── */
  `alter table public.cta_quest_checkpoints enable row level security`,
  `drop policy if exists cta_quest_checkpoints_read on public.cta_quest_checkpoints`,
  `create policy cta_quest_checkpoints_read on public.cta_quest_checkpoints
     for select to authenticated using (user_id = auth.uid())`,
];
