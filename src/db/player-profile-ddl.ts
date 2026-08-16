// DDL профиля игрока (серверная точка истины). Идемпотентно — накатывается `db:migrate-all`
// (авто-подхват по экспорту *_DDL). db:push с телефона недоступен → таблица живёт DDL-модулем
// (паттерн checkpoints-ddl/comlink-ddl). Спека: docs/decisions/player-profile-persistence.md.
//
// RLS: юзер читает ТОЛЬКО свою строку (user_id = auth.uid()); пишет owner-роль через server-action
// (Drizzle мимо RLS) — из-за ES256-гочи юзер-JWT (memory supabase-jwt-es256-dataplane).
export const PLAYER_PROFILE_DDL: string[] = [
  `create table if not exists public.cta_player_profiles (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.profiles(id) on delete cascade,
    game_id    uuid not null references public.games(id) on delete cascade,
    snapshot   jsonb not null,
    level      integer,
    experience bigint,
    source     text,
    updated_at timestamptz not null default now()
  )`,

  // Один профиль на юзера+игру; сохранение = upsert по этому ключу.
  `create unique index if not exists cta_player_profiles_user_game_uq
     on public.cta_player_profiles (user_id, game_id)`,

  /* ─────────── RLS ─────────── */
  `alter table public.cta_player_profiles enable row level security`,
  `drop policy if exists cta_player_profiles_read on public.cta_player_profiles`,
  `create policy cta_player_profiles_read on public.cta_player_profiles
     for select to authenticated using (user_id = auth.uid())`,
];
