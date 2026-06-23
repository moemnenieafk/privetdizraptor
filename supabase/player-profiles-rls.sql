-- Слой 4d — RLS для public.player_profiles (облачные игровые профили).
-- Запустить после `npm run db:push` (таблицу создаёт push, RLS — это). Подхватывается db:sql.
-- Route handlers и так пишут только строку текущего юзера, но RLS гарантирует
-- это и при любом прямом доступе через supabase-клиент.

alter table public.player_profiles enable row level security;

drop policy if exists "player_profiles_own" on public.player_profiles;
create policy "player_profiles_own" on public.player_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
