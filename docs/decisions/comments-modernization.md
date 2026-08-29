# Обсуждения — модернизация 2026 (портал-wide)

Статус: **ИСПОЛНЕНО + МИГРАЦИЯ ПРИМЕНЕНА 2026-08-28; ждёт live-verify + пуш.**
Миграция `entity-comments-thread.sql` накатана на прод (201.51.20.217) через SSH → `docker exec -i supabase-db-… psql -U supabase_admin` (владелец таблицы; наш `postgres` не мог). Проверено: колонки `parent_id`/`edited_at` есть, FK создан, app-роль `postgres` имеет SELECT/INSERT/UPDATE. Флаг `threadReady` на холодном старте = full-режим.
Решение V4DYA: обновляем ОБЩИЙ `<EntityComments>` (не только сборки перков). Фичи: ветки-ответы, правка своих, относительное время + аватары, @упоминания.

## Что сделано
- **Ветки-ответы (1 уровень):** колонка `entity_comments.parent_id` (self-FK, cascade). Ответ на ответ подшивается к верхнеуровневому предку. Ридер группирует плоский список в top-level + ответы (хронология).
- **Правка своих:** колонка `entity_comments.edited_at`; `editOwnComment` (автор, не удалён); API `PATCH {id, body}` (автор) разведён с `PATCH {id, hidden}` (модератор). Метка «изменено» в UI.
- **Относительное время:** `Intl.RelativeTimeFormat('ru')` («5 мин назад»), абсолютная дата — в `title`.
- **Аватары:** `profiles.avatar_url` уже отдавался ридером; в UI — `<Avatar>` (img с фолбэком на инициал).
- **@упоминания:** парсинг `@ник` в теле → ссылка на `/u/ник` + подсветка `--primary`. (Автокомплит и уведомления — ДОЛГ, не в этой итерации.)

## Файлы
Схема: `src/db/schema.ts` (entityComments +parentId +editedAt +index), DDL-модуль `src/db/comments-ddl.ts` (alter add column + FK + index), SQL-зеркало `supabase/entity-comments-thread.sql`.
Данные: `src/db/entity-comments.ts` (DTO +parentId/editedAt; createComment(parentId); editOwnComment; getEntityComments/getRecentComments — устойчивый режим, см. ниже).
API: `src/app/api/eft/comments/route.ts` (POST parentId; PATCH раздвоён author-edit / mod-hide; rate-limit `comment-edit` 60/ч).
UI: `src/components/features/comments/EntityComments.tsx` (полный редизайн: аватары, относит.время, renderBody с @-ссылками, ветки, инлайн-ответ `ReplyComposer`, инлайн-правка `EditBox`).

## ⚠️ Блокер миграции (важно)
`public.entity_comments` принадлежит роли **`supabase_admin`**, а наша тулза (`db:sql`/`db:migrate-all`) и `DATABASE_URL_SESSION` ходят под **`postgres`**, который НЕ владелец и НЕ может `set role supabase_admin` (проверено на живой БД 201.51.20.217). → `ALTER TABLE entity_comments …` нашими средствами НЕ проходит.

**Применить привилегированной ролью** (одно из):
- self-hosted **Supabase Studio → SQL Editor** (выполнить `supabase/entity-comments-thread.sql`);
- на VPS `docker exec -u postgres <db-container> psql -f …` как суперпользователь.

**Защита от регресса до применения:** ридер/райтер `entity-comments.ts` держат флаг `threadReady`. Полный запрос с `parent_id/edited_at` пробуется первым; при ошибке (колонок нет) флаг гаснет и всё деградирует к ПЛОСКОМУ режиму — обычные комментарии, голоса, аватары, относит.время, @-ссылки работают; недоступны лишь ответы и метка «изменено». Самолечится после рестарта, когда колонки появятся. Значит код можно деплоить и ДО миграции без падения обсуждений портала.

## Осталось
1. ~~Применить SQL привилегированной ролью~~ ✅ накатано через SSH (supabase_admin).
2. Live-verify: ответы, правка, @ник-ссылка, аватары, относит.время под сборкой и на ещё одной странице (напр. босс) — проверить не-регресс общего компонента.
3. Долг: автокомплит @упоминаний + уведомления (нужен user-search + notifications).
