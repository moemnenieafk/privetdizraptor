-- Слой 4c — RLS для public.barter_progress.
-- Запустить после `npm run db:push` (таблицу создаёт push, RLS — это).
-- Route handlers и так пишут только строку текущего юзера, но RLS гарантирует
-- это и при любом прямом доступе через supabase-клиент.

alter table public.barter_progress enable row level security;

drop policy if exists "barter_progress_own" on public.barter_progress;
create policy "barter_progress_own" on public.barter_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
