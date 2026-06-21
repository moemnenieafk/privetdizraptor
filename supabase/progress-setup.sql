-- Слой 4b — RLS для public.quest_progress.
-- Запустить ОДИН раз после `npm run db:push` (таблицу создаёт push, RLS — это).
-- Второй контур защиты: route handlers и так пишут только строку текущего юзера,
-- но RLS гарантирует это и при любом прямом доступе через supabase-клиент.

alter table public.quest_progress enable row level security;

drop policy if exists "quest_progress_own" on public.quest_progress;
create policy "quest_progress_own" on public.quest_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
