// Статический DDL таблицы кэша лукапа игроков. Зеркалит supabase/eft-player-cache.sql
// (тот — для локального db:sql; этот — для миграции с телефона через cron-роут, т.к.
// db:push и Supabase SQL Editor недоступны без компа). Идемпотентно, по одному стейтменту.
export const PLAYER_CACHE_DDL: string[] = [
  `create table if not exists public.eft_player_lookup_cache (
     aid text not null,
     game_mode text not null,
     nickname text,
     profile jsonb not null,
     fetched_at timestamptz not null default now(),
     primary key (aid, game_mode)
   )`,
  `create index if not exists eft_player_lookup_cache_fetched_at_idx
     on public.eft_player_lookup_cache (fetched_at)`,
  `alter table public.eft_player_lookup_cache enable row level security`,
];
