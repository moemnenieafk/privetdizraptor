-- Слой 4 (Фаза 2-идентичность) — additive обвязка для смены логина и аватара.
-- Безопасно и идемпотентно; накатывается `npm run db:sql` вместе с остальными.
-- НЕ требует db:push: только `add column if not exists` + storage-политики.
-- Сортируется первым по алфавиту, поэтому storage-часть обёрнута в DO/EXCEPTION —
-- если у роли нет прав на storage.objects, прогон не падает (политики ставятся из дашборда).

-- 1. Кулдаун смены логина: когда username менялся в последний раз.
alter table public.profiles
  add column if not exists username_changed_at timestamptz;

-- 1b. Уникальность логина без учёта регистра — реальная гарантия на уровне БД
--     (app-level SELECT+UPDATE в роуте не атомарен; Drizzle ходит мимо RLS).
--     Партиал: только заданные username. В DO/EXCEPTION — если в БД уже есть
--     дубликаты (старый авто-сид ника из email), индекс не создастся, но прогон
--     не упадёт; роут продолжит отдавать дружелюбный 409 по app-level проверке.
do $$
begin
  create unique index if not exists profiles_username_lower_uniq
    on public.profiles (lower(username))
    where username is not null;
exception
  when others then
    raise notice 'account-identity.sql: profiles_username_lower_uniq не создан (вероятно дубликаты username): %', sqlerrm;
end $$;

-- 2. Storage-RLS: аватары в бакете cta-media под ключом avatars/{uid}.webp.
--    Бакет публичный на чтение (там же лежат иконки предметов). Запись — только свой объект.
--    storage.objects уже под RLS (Supabase включает по умолчанию); добавляем INSERT/UPDATE.
do $$
begin
  drop policy if exists "avatars_insert_own" on storage.objects;
  create policy "avatars_insert_own" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'cta-media'
      and name = 'avatars/' || auth.uid()::text || '.webp'
    );

  drop policy if exists "avatars_update_own" on storage.objects;
  create policy "avatars_update_own" on storage.objects
    for update to authenticated
    using (
      bucket_id = 'cta-media'
      and name = 'avatars/' || auth.uid()::text || '.webp'
    )
    with check (
      bucket_id = 'cta-media'
      and name = 'avatars/' || auth.uid()::text || '.webp'
    );
exception
  when insufficient_privilege then
    raise notice 'account-identity.sql: нет прав на storage.objects — задайте политики avatars_* через Supabase Dashboard';
end $$;
