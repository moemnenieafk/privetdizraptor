-- Слой 4 (account-real-data) — additive колонки настроек рассылок профиля.
-- Безопасно и идемпотентно; накатывается `npm run db:sql` вместе с остальными.
-- НЕ требует db:push. Opt-out модель (зеркалит UI кабинета): по умолчанию всё включено.

alter table public.profiles
  add column if not exists notify_account boolean not null default true,
  add column if not exists notify_offers  boolean not null default true,
  add column if not exists notify_news    boolean not null default true;
