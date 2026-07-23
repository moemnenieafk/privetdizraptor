-- FK-индексы (гигиена БД 2026-07-23). Внешние ключи на пользователей/авторов были без
-- покрывающего индекса → медленные джойны и, важнее, блокирующий скан этих таблиц при
-- удалении строки-родителя (юзера). Идемпотентно (create index if not exists).
-- Запускать через `npm run db:sql`.
--
-- Индексы на entity_comments заведены в schema.ts (та таблица под drizzle) — здесь те же
-- имена с IF NOT EXISTS, чтобы состояние сходилось и не возникал дрифт (см.
-- decisions/gotcha-drizzle-push-orphan-tables.md).
--
-- game_id-FK намеренно НЕ индексируем: в БД одна игра, планировщик их не использует.

-- entity_comments (schema.ts)
create index if not exists entity_comments_user_idx on public.entity_comments (user_id);
create index if not exists entity_comments_hidden_by_idx on public.entity_comments (hidden_by);

-- comlink (раздел «Связь», управляется migrate-роутами)
create index if not exists comlink_articles_author_idx on public.comlink_articles (author_id);
create index if not exists comlink_posts_author_idx on public.comlink_posts (author_id);
create index if not exists comlink_topics_author_idx on public.comlink_topics (author_id);
create index if not exists comlink_reviews_author_idx on public.comlink_reviews (author_id);
create index if not exists comlink_reports_reporter_idx on public.comlink_reports (reporter_id);
create index if not exists comlink_reports_resolved_by_idx on public.comlink_reports (resolved_by);
create index if not exists comlink_reports_target_idx on public.comlink_reports (target_id);

-- прочие разделы вне schema.ts
create index if not exists codex_articles_author_idx on public.codex_articles (author_id);
create index if not exists karma_events_issued_by_idx on public.karma_events (issued_by);
create index if not exists media_assets_uploaded_by_idx on public.media_assets (uploaded_by);
create index if not exists player_verifications_reviewed_by_idx on public.player_verifications (reviewed_by);
create index if not exists story_guides_author_idx on public.story_guides (author_id);
