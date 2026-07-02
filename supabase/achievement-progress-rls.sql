-- Фаза 2 достижений — RLS для public.achievement_progress.
-- Запустить после `npm run db:push` (таблицу создаёт push, RLS — это).
-- Второй контур: route handlers пишут только строку текущего юзера, но RLS
-- гарантирует это и при любом прямом доступе через supabase-клиент.

alter table public.achievement_progress enable row level security;

drop policy if exists "achievement_progress_own" on public.achievement_progress;
create policy "achievement_progress_own" on public.achievement_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
