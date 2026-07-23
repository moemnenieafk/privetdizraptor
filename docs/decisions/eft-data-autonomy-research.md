---
status: 🔬 research — открыто, цель: полный отказ от api.tarkov.dev
affects: prices, sync, cron, eft-prices, eft-catalog, backend-autonomy, release-readiness
date: 2026-07-22
---

# Поиск решений автономной синхронизации / парсинга информации из Escape from Tarkov

**Цель:** полностью уйти от зависимости от **api.tarkov.dev** — сделать все данные EFT автономными (из клиента игры / SPT / собственного зеркала), чтобы релиз не висел на чужом стороннем API.
Связано: [[autonomy-prices-research]] · [[eft-asset-extraction]] · [[game-asset-extraction]] (скилл) · CLAUDE.md §4.11 · [[hosting-vercel-first]].

## Почему это критично сейчас

- **Релиз близко**, а `api.tarkov.dev` — единственная точка отказа для цен/экономики.
- **ПОДТВЕРЖДЁННЫЙ тотальный даун их GraphQL** (не наш баг, не бот-защита, не rate-limit): issue **[the-hideout/tarkov-api#474](https://github.com/the-hideout/tarkov-api/issues/474)** (OPEN) — `api.tarkov.dev/graphql` отдаёт `HTTP 503 {"errors":["GraphQL server unavailable. Try again later."]}` **на ЛЮБОЙ запрос**, включая базовый `{ tasks(limit:1){ id name } }` через `curl -X POST`. Началось ~**2026-07-21 08:00 UTC**, ≥31 час непрерывно (на 2026-07-22 14:45 UTC). Страдают все консюмеры.
- **`minLevelForFlea`, вероятно, уже пофикшен апстримом:** закрытый **#417** «Flea market playerLevel requirements not updated for 1.0 tiered system» (completed, март 2026). Наш null — потому что не синкались после фикса (API лежит). После восстановления → `db:sync-prices` должен заполнить колонку.
- Формального «доступа»/ключей у tarkov.dev нет (API открытый/бесплатный) — «попросить доступ» не решает. Писать им не нужно: 503 уже трекается в #474.
- **Наша устойчивость сейчас:** `syncEftPrices()` при пустой карте НЕ затирает данные → каталог живёт на последних успешных ценах; `minLevelForFlea` закрыт оверрайдом. Так что даун нас не роняет — но это ровно демонстрация риска: 31+ час чужого дауна в пред-релиз.

## Что мы берём у tarkov.dev СЕЙЧАС (карта зависимостей)

Единственная точка контакта — серверный крон/CLI (рантайм в API не ходит, читает только нашу Supabase).

| Данные | Источник сейчас | Механизм | Автономно? |
|---|---|---|---|
| **Живые цены барахолки** (lastLow/avg24h/low/high, sellFor/buyFor флиа) | tarkov.dev | `getEftPriceMap()` GraphQL → `syncEftPrices()` → таблица `prices` | ❌ нет |
| Тренды 24ч/7д, changeLast48h | tarkov.dev | тот же синк | ❌ нет |
| Цены торговцев (buyFor/sellFor не-флиа) | tarkov.dev | тот же синк | ⚠️ частично (есть в SPT-конфигах) |
| **minLevelForFlea** (уровень доступа на барахолку) | tarkov.dev (поле есть в схеме, но отдаёт `null` → 0/5056 в БД) | синк + сейчас **ручной JSON-оверрайд** `src/data/eft-flea-levels.json` | ✅ оверрайдом / SPT |
| bsgCategoryId, types, normalizedName, backgroundColor | tarkov.dev prices + items_database | синк / каталог | ✅ есть в SPT |
| Бартеры / крафты | tarkov.dev | `sync-barters-crafts` | ⚠️ есть в SPT |
| Каталог предметов + свойства (класс, калибр, эрго…) | **SPT `items_database.json`** (клиент) | ETL `etl-items.ts` | ✅ автономно |
| Сетки вместимости контейнеров | **SPT dump** (`grids`) | `dump-container-grids-spt.mjs` | ✅ автономно |
| Иконки предметов | **рендер из клиента** (5044 шт в Supabase) | скилл `game-asset-extraction` | ✅ автономно |
| Квесты, карты, боссы | статические данные / наш арт | — | ✅ автономно |

**Вывод:** «жёстко зависим» от tarkov.dev по факту только в одном — **живые цены барахолки + их тренды**. Всё остальное (мета, свойства, категории, флиа-уровни, бартеры/крафты) **есть в файлах игры / SPT** и может быть спарсено автономно.

## Ключевые точки в коде (что менять при миграции)

- `src/lib/eft-prices.ts` — `getEftPriceMap(gameMode)`: GraphQL-запрос к `api.tarkov.dev` (единственный сетевой вызов наружу). `buildQuery()` — список полей. `OPTIONAL_FIELDS = ['minLevelForFlea']` (fallback-дроп при ошибке схемы).
- `src/db/prices.ts` — `syncEftPrices()` (пишет `prices`), `getEftPriceMapFromDb()` (рантайм-чтение). Upsert уже поддерживает `minLevelForFlea`.
- `src/lib/eft-catalog.ts` — `getEftCatalog()` (каталог из нашей БД + SPT).
- Кроны: `/api/cron/sync-prices`, `sync-barters-crafts`, `sync-hideout`, `sync-maps-geometry`, `sync-quest-zones`; CLI-зеркала в `scripts/`.
- **Оверрайд-паттерн (уже применён):** `src/data/eft-flea-levels.json` мержится на чтении в `eft-category.ts` (`fleaLevelFor`: БД → byItem → byBsgCategory). Тот же паттерн, что `container-grid-overrides`.
- **✅ Чистка §4.11 (2026-07-23):** из `src/lib/eft-api.ts` удалены мёртвые рантайм-фетчи `getAllEftItems()` / `getAmmoData()` (били в `api.tarkov.dev/graphql` прямо из рантайма — латентная мина §4.11, но вызовов уже не было). Файл ужат 176→24 строк, упоминаний `api.tarkov.dev` в нём больше нет; оставлены только тип `EftItem` (для поиска) и статический `getQuestMapTasks()` (из `EFT_QUESTS`, без сети). Итог: рантайм чист от tarkov.dev по всему коду, единственная реальная зависимость — синк живых цен (ниже, **тема НЕ закрыта**).

## Направления решения (к полной автономии)

### A. Мета/статика (minLevelForFlea, категории, бартеры, крафты, цены торговцев) → из SPT
SPT (Single-Player Tarkov) сервер несёт **собственные данные игры**: конфиг барахолки (blacklist + уровневые требования), ассорты торговцев (их цены/бартеры), крафты убежища, свойства предметов. Это тот же источник, что уже используем для каталога/сеток. **Рекомендация:** распарсить flea-config и trader-ассорты из SPT — тогда minLevelForFlea, бартеры, крафты и цены торговцев становятся автономными (BattlEye-safe, из клиента). Рецепт — как `dump-container-grids-spt.mjs`.

> 🔬 **Мультигейм-развитие темы:** [[deep-research-live-price-sync.md]] (2026-07-23) — способы фетча/скана живых цен по всем играм портала (EFT/GZW/ABI), классификация экономик (статичные vendor-цены vs динамический рынок) и fallback-план ручного ввода цен через CMS.

### B. Живые цены барахолки — самое сложное (см. [[autonomy-prices-research]])
Полностью автономного источника ЖИВЫХ цен барахолки нет (это динамический рынок сервера BSG). Опции:
1. **Свой лог-дамп/скан клиента** (техника из `autonomy-prices-research`) — читать цены из клиента (BattlEye-safe, не память). Сложно, но автономно.
2. **Собственная история** — снапшотить любой доступный источник по крону в свою mirror-таблицу (тогда и тренды 24ч/7д станут наши, см. backlog в [[items-filters-revision-2026-07-22]]).
3. **Деградация:** показывать base/SPT-цены (статические) без живой барахолки, живые — как «best-effort» пока есть источник.
4. **Аккуратный режим tarkov.dev** (если оставляем как один из источников): User-Agent, интервал, кэш, ретраи с backoff — снизить 503.

### C. Гибрид (прагматично к релизу)
- Статику/мету — на SPT (автономно, надёжно).
- Живые цены — оставить tarkov.dev как **один из** источников с graceful-деградацией (503 → старые данные, что уже реализовано: `syncEftPrices` не затирает при пустой карте), параллельно копить свою историю.

## Немедленные шаги
1. **minLevelForFlea** — закрыт оверрайдом `eft-flea-levels.json` (работает сейчас). Следующий уровень — парсинг из SPT flea-config.
2. **Спросить мейнтейнеров tarkov.dev** (Discord/GitHub `the-hideout/tarkov-api`): отдаёт ли `minLevelForFlea` реальные значения; есть ли rate-limit/бот-защита и best-practices для крон-зеркала (черновик письма — ниже/в чате).
3. **Research SPT flea-config** — где лежат уровневые требования барахолки и ассорты торговцев; оформить дамп-скрипт по образцу сеток.

## Источники
- Схема API: `the-hideout/tarkov-api/schema-static.mjs` — `Item.minLevelForFlea: Int` ЕСТЬ (запрос корректен, но значения `null`).
- Коммиты сайта `the-hideout/tarkov-dev/commits/main`: turnstile / API-субдомен (усиление защиты) — вероятная причина 503.
- Прошлый research автономии: [[autonomy-prices-research]], извлечение ассетов: [[eft-asset-extraction]] + скилл `game-asset-extraction`.
