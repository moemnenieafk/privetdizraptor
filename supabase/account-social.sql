-- Слой 4 (account-real-data, slice 1) — additive колонки соц-привязок профиля.
-- Безопасно и идемпотентно; накатывается `npm run db:sql` вместе с остальными.
-- НЕ требует db:push. Юзер вводит хендлы вручную (без OAuth); NULL = не привязано.

alter table public.profiles
  add column if not exists twitch  text,
  add column if not exists youtube text,
  add column if not exists discord text,
  add column if not exists steam   text;
