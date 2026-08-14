-- Слой 4e — таблица + RLS для public.battlepass_progress (облачный прогресс трекера Боевого Пропуска).
-- ADDITIVE и идемпотентно (db:sql, БЕЗ db:push — прецедент rate_limits/feedback): не откатывает RLS
-- и обходит TTY-гочу push. Зеркалится в schema.ts (чтобы будущий push не снёс таблицу).
-- Route handlers пишут только строку текущего юзера; RLS гарантирует owner-only и при прямом
-- доступе через supabase-клиент.

create table if not exists public.battlepass_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  claimed jsonb not null,
  doc_counts jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.battlepass_progress enable row level security;

drop policy if exists "battlepass_progress_own" on public.battlepass_progress;
create policy "battlepass_progress_own" on public.battlepass_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
