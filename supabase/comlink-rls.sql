-- RLS раздела «Связь» (Comlink) — канонический скрипт для db:sql-паритета.
-- ИСТОЧНИК ПРАВДЫ по факту накатывания — массив COMLINK_DDL в `src/db/comlink-ddl.ts`
-- (его гоняет роут /api/cron/migrate-comlink, т.к. db:push/SQL Editor с телефона нет).
-- Этот файл зеркалит те же политики 1:1, чтобы у Comlink, как и у остальных доменов,
-- был отдельный RLS-скрипт в supabase/ (подхватывается apply-sql глоббером).
-- Идемпотентно: enable RLS + drop policy if exists → create.
--
-- Модель доступа:
--   • Соц-контент (анкеты/рейды/отзывы/темы/ответы) — только АВТОРИЗОВАННЫЕ,
--     видимость сужена по владельцу/участнику/флагу hidden (контакты и ники не светим анонимам/парсерам).
--   • Пишет всё серверная owner-роль через API-роуты (Drizzle идёт мимо RLS) —
--     INSERT/UPDATE/DELETE-политик для anon/authenticated НЕТ намеренно.
--   • karma_events / comlink_reports — RLS без policy (паттерн rate_limits): прямого
--     доступа нет вообще; суммы кармы отдаёт API, очередь жалоб видит модератор.
--   • comlink_articles (блог/мастер-классы/патчноуты) — ПУБЛИЧНЫЕ (published=true):
--     входная воронка, индексируется поиском.

-- ── включаем RLS на всех таблицах раздела ──
alter table public.comlink_profiles enable row level security;
alter table public.comlink_raids    enable row level security;
alter table public.comlink_reviews  enable row level security;
alter table public.karma_events     enable row level security;
alter table public.comlink_reports  enable row level security;
alter table public.comlink_topics   enable row level security;
alter table public.comlink_posts    enable row level security;
alter table public.comlink_articles enable row level security;

-- Анкеты: активные видны всем авторизованным, свою (в т.ч. скрытую) видит владелец.
drop policy if exists comlink_profiles_read on public.comlink_profiles;
create policy comlink_profiles_read on public.comlink_profiles
  for select to authenticated using (active = true or user_id = auth.uid());

-- Рейды видят только участники.
drop policy if exists comlink_raids_read on public.comlink_raids;
create policy comlink_raids_read on public.comlink_raids
  for select to authenticated
  using (initiator_id = auth.uid() or partner_id = auth.uid());

-- Отзывы: открытые — всем авторизованным; свой скрытый видит автор.
drop policy if exists comlink_reviews_read on public.comlink_reviews;
create policy comlink_reviews_read on public.comlink_reviews
  for select to authenticated
  using (hidden = false or author_id = auth.uid());

-- Темы форума: всем авторизованным.
drop policy if exists comlink_topics_read on public.comlink_topics;
create policy comlink_topics_read on public.comlink_topics
  for select to authenticated using (true);

-- Ответы: нескрытые — всем авторизованным; свой скрытый видит автор.
drop policy if exists comlink_posts_read on public.comlink_posts;
create policy comlink_posts_read on public.comlink_posts
  for select to authenticated using (hidden = false or author_id = auth.uid());

-- Статьи/патчноуты: публичные (published=true).
drop policy if exists comlink_articles_read on public.comlink_articles;
create policy comlink_articles_read on public.comlink_articles
  for select using (published = true);

-- karma_events и comlink_reports: НАМЕРЕННО без policy → прямого доступа нет.
