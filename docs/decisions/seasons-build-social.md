# Сезоны — соц-слой к сборкам перков (лайк/дизлайк + комментарии)

Статус: **ИСПОЛНЕНО 2026-08-28 (код + миграция), ждёт live-verify V4DYA + пуш.**
Развилки зафиксированы 2026-08-28 (V4DYA).
Источник: идея [[ideas/2026-08-28-1457--seasons-build-social-likes-comments.md]] (TG msg 370, V4DYA).
Предпосылка снята: permalink шаринга починен ([[bugs/2026-08-28-1148--perks-constructor-share-broken.md]]).

## Суть
Под расшаренной сборкой перков (`/eft/progress/seasons/b/[code]`) — блок реакций (лайк/дизлайк) и ветка комментариев. Сборки перестают быть «одноразовой ссылкой»: появляется рейтинг и обсуждение.

## Ключевой факт: инфра уже есть
Это **не greenfield-бэкенд, а сборка из готового**. Переиспользуем 1:1:
- **Комментарии** — полиморфный слой `entity_comments`/`entity_comment_votes` (`src/db/comments-ddl.ts`, ридер `src/db/entity-comments.ts`), API `src/app/api/eft/comments/*`, UI `<EntityComments>` (`src/components/features/comments/`), модерация (hide/soft-delete), карма. `target_type` — **свободный текст без CHECK/enum** → новый тип цели = только запись в TS-реестре, БЕЗ миграции слоя комментов.
- **Лайки** — прецедент `weapon_builds.likes` + `weapon_build_likes` + `toggleBuildLike` (`src/db/public-builds.ts`) + API `builds/like`.
- **Auth** `getMe()`, **rate-limit** `rateLimit()`, **RLS-конвенции** (owner-write + public-read; пишем Drizzle owner-ролью мимо RLS).
- **Ключ сборки детерминирован**: `encodeBuild = [...ids].sort().join('.')` → одинаковая комбинация перков сходится в один тред.

## Решения V4DYA (2026-08-28) — развилки закрыты
- **A → лайк/дизлайк** (не лайк-only). `value ∈ {+1,-1}`, два денорм-счётчика.
- **B → строка `season_builds(slug↔code)`**, ленивый upsert из канон-кода. Даёт короткий url-safe slug (raw-код с точками и ~100 симв. НЕ проходит `TARGET_ID_RE` реестра целей), дом для счётчиков и slug→code для ленты модерации.
- **C → вариант 1**: блок под конструктором на существующей `/b/[code]`, нового роута нет.
- **D → все залогиненные** пишут комменты сборок (НЕ платный пейволл — сознательный рассинхрон с остальным порталом). Значит гейт `canWriteComments` в `comments/route.ts` делаем **type-aware**: для `season-build` пишет любой залогиненный; для прочих типов — прежний платный тир.
- **E** решена B (`season_slug` + глобально-уникальный slug).

## Модель данных (новое)
DDL-модуль `src/db/season-builds-ddl.ts` (+ зеркало в `schema.ts` для ридера), накат через `db:migrate-all` (аддитивно, идемпотентно — БЕЗ `db:push`):

```
season_builds
  id          uuid pk
  slug        text unique      -- короткий, /^[a-z0-9]{6,16}$/, = target_id комментов и ключ реакций
  code        text unique      -- канон encodeBuild (сорт-джойн перков)
  season_slug text not null
  up          int  default 0   -- денорм-счётчик лайков
  down        int  default 0   -- денорм-счётчик дизлайков
  created_at  timestamptz

season_build_reactions
  build_id  uuid → season_builds.id (cascade)
  user_id   uuid → profiles.id (cascade)
  value     smallint  -- +1 | -1
  pk (build_id, user_id)
```

RLS: `season_builds` — public read, owner-нет (пишем сервером); `season_build_reactions` — read all, owner-write (`user_id = auth.uid()`). По шаблону `build-ddl.ts`.

## Поток
1. Страница `/b/[code]` (server): `ensureSeasonBuild(seasonSlug, code)` — декодирует+валидирует; пустой/битый код → соц-блок скрыт. Иначе канонизирует код, SELECT по code, при отсутствии INSERT с рандом-slug (unique(code) + ретрай на гонку). Возвращает `{ slug, up, down, myValue }`. Параметр `[code]` также принимает уже-slug (лента модерации) → резолв в code из строки.
2. Client: `<SeasonBuildReactions>` (лайк/дизлайк, оптимистично) + `<EntityComments type="season-build" id={slug} />`.
3. Реакции API `POST /api/eft/seasons/reactions` `{ code, value: 1|-1|0 }` (0 = снять): `getMe` → 401 аноним, `rateLimit`, ensure→toggle/set, пересчёт `up`/`down`, вернуть состояние.
4. Комменты — существующий API/компонент как есть; `targetExists('season-build', slug)` = строка `season_builds` со slug есть.

## Порядок исполнения
1. `season-builds-ddl.ts` + таблицы в `schema.ts` + reader `src/db/season-build-social.ts`.
2. `comment-targets.ts` (+тип `season-build`, url `/eft/progress/seasons/b/{slug}`), `comment-targets.server.ts` (существование).
3. `comments/route.ts` — type-aware `canWriteComments`.
4. Реакции: API-роут + `<SeasonBuildReactions>`.
5. Обвязка `/b/[code]/page.tsx`.
6. Миграция: `npm run db:migrate-all` → `npm run db:sql` (RLS). Верификация `npx tsc --noEmit`.
7. Дизайн реакц-бара — по NIGHTFALL, финал за V4DYA (live-verify).

## Исполнение (2026-08-28)
Файлы: `src/db/season-builds-ddl.ts`, таблицы в `src/db/schema.ts` (`seasonBuilds`/`seasonBuildReactions`, +import `smallint`), ридер `src/db/season-build-social.ts` (`ensureBuild`/`getSeasonBuildState`/`setReaction`/`getSeasonBuildBySlug`/`seasonBuildExists`), реестр `src/lib/comment-targets{,.server}.ts` (тип `season-build`), type-aware гейт `src/app/api/eft/comments/route.ts`, реакции `src/app/api/eft/seasons/reactions/route.ts`, UI `src/components/features/seasons/SeasonBuildReactions.tsx`, обвязка `src/app/eft/progress/seasons/b/[code]/page.tsx`, прод-миграция `src/app/api/cron/migrate-season-builds/route.ts`.
Миграция накатана `npm run db:migrate-all` → таблицы+индексы+RLS применены и проверены прямым запросом (RLS on обе, 3 политики). `tsc --noEmit` + eslint зелёные.
⚠️ `db:migrate-all` отдаёт 155 «must be owner of table» по ЧУЖИМ таблицам (comlink и др.) — пред-существующее (роль сессии не владелец таблиц, заведённых другой ролью), НЕ регресс этой задачи; мои таблицы создаёт та же роль → мои DDL проходят.
Осталось: live-verify V4DYA (лайк/дизлайк + коммент под сборкой) + пуш; прод — вызвать `/api/cron/migrate-season-builds` (Bearer CRON_SECRET) один раз.

## Доработки 2026-08-28 (итерация V4DYA)
- **Короткий URL сборки (#1):** ссылка была длинной (dot-код ~180 симв.). Теперь `share()` в `SeasonPerkBuilder` просит короткий slug у нового `POST /api/eft/seasons/build-link` (заводит строку `season_builds`, отдаёт slug) → копирует `/b/{slug}`; фолбэк на dot-код при сбое. Роут `/b/[code]` уже принимал и slug, и код (`resolveBuild`). При заходе по длинному коду адресную строку укорачивает `<ShortenBuildUrl>` (history.replaceState). Иконки лайк/дизлайк проведены в `icons.css` (`.icon-eft-like/-dislike`, секция seasons).
- **Hero-шапка из Figma (#3, node 3257-130):** новый `SeasonBuildHero` заменил текстовую шапку `/b/[code]`: слева карточка билда (баннер курируемого / «Своя сборка» + бейдж сезона для кастома — матч через `findCuratedBuildByCode`), справа лого сезона + заголовок «Оцени сборку сезонного ЧВК» (тил-акцент сезона) + боксовые реакции 160×160 (`SeasonBuildReactions` переверстан: иконка сверху, счётчик снизу, активные зелёный/красный тинт). Токены — из variable-defs Figma → NIGHTFALL.

## Замыкание петли
По завершении live-verify+пуш: идее статус `done` → перенос в `ideas/done/`, этой заметке ✅.
Модернизация комментов вынесена в отдельную заметку (портал-wide): `docs/decisions/comments-modernization.md`. Долг: возможный вынос реакций в отдельную `reputation`-связь (сейчас изолированы), перенос лайков на профиль автора сборки — когда у сборок появится автор (сейчас автора нет, сборка анонимна по коду).
