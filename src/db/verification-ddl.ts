// DDL подтверждения ЧВК-профиля как массив стейтментов — накатывается роутом
// /api/cron/migrate-verification (db:push с телефона недоступен, паттерн weapons-ddl).
// Все стейтменты идемпотентны, повторный прогон безопасен.
//
// Механизм ручной (BSG-владение напрямую не доказуемо): код-челлендж + скрин +
// разбор модератором. Доступ гейтит POST-роут (только платные тиры). Скрин-пруф —
// инлайн base64 в jsonb (паттерн feedback). RLS: читает только владелец свою
// строку; пишет owner-роль через API. Очередь модерации отдаёт серверный роут
// (Drizzle мимо RLS).
export const VERIFICATION_DDL: string[] = [
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
