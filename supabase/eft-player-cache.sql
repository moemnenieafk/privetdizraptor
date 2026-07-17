-- Кэш внешнего лукапа игроков (публичные профили BSG через player.tarkov.dev).
-- Additive и идемпотентно (db:sql, без db:push). Бэкенд-онли: доступ только серверной
-- owner-роли (Drizzle ходит мимо RLS); RLS включаем БЕЗ policy — anon/authenticated
-- через supabase-клиент доступа не имеют. Зеркалится в schema.ts (чтобы push не снёс).

create table if not exists public.eft_player_lookup_cache (
  aid text not null,
  game_mode text not null,
  nickname text,
  profile jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (aid, game_mode)
);

-- Индекс для опортунистической чистки протухших строк (по возрасту).
create index if not exists eft_player_lookup_cache_fetched_at_idx
  on public.eft_player_lookup_cache (fetched_at);

alter table public.eft_player_lookup_cache enable row level security;
-- Никаких policy: только owner (серверный Drizzle) пишет/читает; RLS режет остальных.
