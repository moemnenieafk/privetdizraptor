---
status: ✅ решено — появился db:migrate-all
affects: db, drizzle, migrations, db:push, backend-autonomy, comlink, codex, media, gunsmith, story
date: 2026-07-23
done: 2026-07-27
---

# ГОЧА: `db:push --force` дропнет 14 таблиц вне `schema.ts`

**TL;DR.** `drizzle.config.ts` грузит **только `./src/db/schema.ts`**. Но в БД живут ещё 14
таблиц, описанных в **отдельных** `schema-*.ts` и созданных **сырым DDL через migrate-роуты**.
Для drizzle они «лишние» → **`npm run db:push --force` предложит их УДАЛИТЬ** вместе с данными.
Никогда не гонять `db:push` вслепую в этом репо.

## Как всплыло
Задача синка [[eft-data-autonomy-research|Tarkov Silent Changes]] (2026-07-23): добавил таблицу
`silent_changes`. `db:push` упал (в неинтерактивной агент-сессии нет TTY для промпта
create/rename), поэтому таблицу накатил **явным идемпотентным DDL** через session-пул + RLS
через `db:sql`. При проверке дрифта схемы обнаружилось расхождение (ниже). Оказалось — выбор
«DDL вместо push» был не просто обходом TTY, а **спас от дропа 14 таблиц**.

## Доказательства (из кода)
- `drizzle.config.ts` → `schema: "./src/db/schema.ts"` (один файл, не массив/глоб).
- `schema.ts` **не** реэкспортит другие `schema-*.ts`.
- Есть 6 отдельных схем-файлов: `schema-articles.ts`, `schema-codex.ts`, `schema-comlink.ts`,
  `schema-gunsmith.ts`, `schema-media.ts`, `schema-story.ts`.
- Их таблицы создаются **migrate-роутами** сырым DDL. Цитата из `migrate-comlink/route.ts`:
  > «db:push и SQL Editor с телефона недоступны — накатываем роутом (паттерн migrate-weapons)».
  То есть их **намеренно вывели из-под drizzle-push**.

## 14 «осиротевших» таблиц (есть в БД, нет в `schema.ts`)
`comlink_articles`, `comlink_posts`, `comlink_profiles`, `comlink_raids`, `comlink_reports`,
`comlink_reviews`, `comlink_topics`, `codex_articles`, `media_assets`, `gunsmith_specs`,
`karma_events`, `story_guides`, `player_verifications`, `eft_player_lookup_cache`.

Сверка на 2026-07-23: `schema.ts` = 37 таблиц, public в БД = 51. Разница = эти 14.
`silent_changes` — колонки 1:1 со схемой, дрифта нет.

## Правило (пока не пофикшено)
- **НЕ запускать `npm run db:push` (`--force`) вслепую.** На живом терминале — читать, что он
  предлагает, и **никогда не подтверждать `drop table`** для перечисленных 14.
- Новые таблицы для разделов вне schema.ts (Связь/Кодекс/Медиа/…) — накатывать **migrate-роутом**
  или явным DDL, как и раньше.
- Для таблиц ВНУТРИ `schema.ts` (prices, barters, weapons, `silent_changes`, …) push безопасен —
  но всё равно на живом терминале из-за интерактивных промптов (TTY).

## Рекомендованный фикс (отдельная задача, аккуратно)
Показать drizzle все таблицы, чтобы push перестал быть миной:
```ts
// drizzle.config.ts
schema: [
  "./src/db/schema.ts",
  "./src/db/schema-articles.ts", "./src/db/schema-codex.ts",
  "./src/db/schema-comlink.ts",  "./src/db/schema-gunsmith.ts",
  "./src/db/schema-media.ts",    "./src/db/schema-story.ts",
],
```
⚠️ Делать осторожно и отдельно: после подключения drizzle сравнит определения из `schema-*.ts`
с живым DDL migrate-роутов — может всплыть **дифф на уровне колонок/типов/дефолтов** (их писали
руками, не через drizzle). Сперва прогнать дифф без применения (интроспект `information_schema`
vs схема-файлы), выровнять определения, и только потом переключать конфиг.

## Связи
- [[eft-data-autonomy-research]] — задача, в ходе которой всплыло.
- Скилл `cta-backend` — гоча №1 там про «push --force откатывает RLS»; ЭТА заметка добавляет
  второй слой опасности (дроп таблиц вне schema.ts). Стоит дописать в скилл.

---

## Закрытие (ревизия 2026-07-27)

Гоча зафиксирована 23.07, когда единственной защитой была осторожность. Сейчас проблема решена
инструментом: `npm run db:migrate-all` (`scripts/migrate-all-ddl.ts`) идемпотентно пересоздаёт
таблицы разделов из 9 модулей `src/db/*-ddl.ts`, а правильный порядок
`db:push` → `db:migrate-all` → `db:sql` описан в скилле `/cta-backend`.

Заметку не удаляем: список 14 осиротевших таблиц и разбор — это память о том, зачем
`db:migrate-all` вообще появился.
