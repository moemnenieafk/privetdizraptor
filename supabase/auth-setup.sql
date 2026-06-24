-- Слой 4 — обвязка Supabase Auth для public.profiles.
-- Запустить ОДИН раз в Supabase → SQL Editor ПОСЛЕ `npm run db:push`
-- (push создаёт таблицу profiles; этот скрипт навешивает FK на auth.users,
-- авто-создание профиля и RLS — то, чем drizzle-kit не управляет).

-- 1. FK: profiles.id → auth.users.id, каскадное удаление профиля вместе с юзером.
alter table public.profiles
  drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

-- 2. Триггер: при регистрации пользователя автоматически создаём профиль.
--    Имя берём из метаданных OAuth (Discord/Twitch) или из части email до @.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  base text;
  cand text;
  n int := 0;
begin
  -- Базовый ник: OAuth-метаданные или local-part email. Чистим под формат
  -- ([A-Za-z0-9_-]), непустой, не длиннее 15 символов.
  base := coalesce(
    nullif(new.raw_user_meta_data ->> 'user_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'user'
  );
  base := nullif(regexp_replace(base, '[^A-Za-z0-9_-]', '', 'g'), '');
  base := left(coalesce(base, 'user'), 15);
  cand := base;

  -- Race-safe: вставляем, при коллизии username (profiles_username_lower_uniq,
  -- account-identity.sql) добавляем суффикс и повторяем. on conflict (id) ловит
  -- только PK, поэтому конфликт ника перехватываем явно. Длину держим ≤15.
  loop
    begin
      insert into public.profiles (id, username, avatar_url)
      values (new.id, cand, new.raw_user_meta_data ->> 'avatar_url')
      on conflict (id) do nothing;
      exit;
    exception when unique_violation then
      n := n + 1;
      cand := left(base, greatest(1, 15 - length(n::text))) || n::text;
      if n > 99 then
        -- крайний случай — гарантированно уникальный хвост из id
        cand := left(replace(new.id::text, '-', ''), 15);
        insert into public.profiles (id, username, avatar_url)
        values (new.id, cand, new.raw_user_meta_data ->> 'avatar_url')
        on conflict (id) do nothing;
        exit;
      end if;
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. RLS: профили читают все (публичные ники), редактирует только владелец.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
