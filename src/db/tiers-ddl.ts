// DDL таблицы `tiers` (динамические уровни подписки) как массив идемпотентных
// стейтментов — накатывается роутом /api/cron/migrate-billing (db:push с телефона
// недоступен, паттерн subscriptions-ddl). Повторный прогон безопасен.
//
// Тиры уходят из кода (CHECK на subscriptions.tier снят) в БД: админ может создать
// новый тир / переоценить / архивировать без деплоя. rank — целое, лестница доступа:
// доступ к ключу = rank(userTier) >= rank(gateTier). game_id null = портальный тир.
// RLS: витрина цен публична (anon+authenticated read); запись — owner-роль (Drizzle,
// в обход RLS), без write-policy.
export const TIERS_DDL: string[] = [
  `create table if not exists public.tiers (
    id         uuid primary key default gen_random_uuid(),
    slug       text unique not null,
    name       text not null,
    price      integer not null default 0,
    rank       integer not null default 0,
    game_id    uuid references public.games(id) on delete cascade,
    archived   boolean not null default false,
    perks      jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,

  `alter table public.tiers enable row level security`,
  `drop policy if exists tiers_read on public.tiers`,
  // Витрина цен публична: и анон, и авторизованные читают весь список тиров.
  `create policy tiers_read on public.tiers
     for select to anon, authenticated using (true)`,

  // Сид базовых портальных тиров (game_id = null). free — ЗАЩИЩЁННЫЙ канон: сид ВСЕГДА
  // восстанавливает rank/price/archived (нельзя платный/архивный/сдвинутый free), но имя
  // и perks не перетирает — их разрешено переименовывать. operative/veteran — do nothing
  // (повторный прогон не трогает отредактированные админом строки).
  `insert into public.tiers (slug, name, price, rank, game_id, archived)
     values ('free', 'Боец', 0, 0, null, false)
     on conflict (slug) do update set
       rank = 0, price = 0, archived = false, updated_at = now()`,
  `insert into public.tiers (slug, name, price, rank, game_id, archived)
     values ('operative', 'Оперативник', 199, 1, null, false)
     on conflict (slug) do nothing`,
  `insert into public.tiers (slug, name, price, rank, game_id, archived)
     values ('veteran', 'Ветеран', 449, 2, null, false)
     on conflict (slug) do nothing`,
];
