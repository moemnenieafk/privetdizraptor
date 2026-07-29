---
status: 🔬 research — структурная миграция GraphQL→flat-JSON завершена; открыто только направление B (живые цены)
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

## Ревизия 2026-07-27 — направление A перестало быть теорией

Рекомендация «распарсить из SPT, рецепт как `dump-container-grids-spt.mjs`» реализована на эффектах
предметов: `scripts/dump-item-effects-spt.mjs` тянет `templates/items.json` + `globals.json`, кладёт
в каталог, `db:etl` льёт в зеркало. 87 предметов, рантайм-фетча наружу не добавилось.
Коммиты `59b65eb`, `d09c12e`, `1226fa7`. Обобщённый рецепт — скилл `/game-data-ingest`.

Показательно, что в момент работы `api.tarkov.dev` отдавал `INTERNAL_SERVER_ERROR` на любой запрос
к `items` — если бы блок зависел от него, он был бы пустым. Плюс данных там нет в принципе: у всех
21 инъекторов `properties` = `{"__typename":"ItemPropertiesStim"}` и больше ничего.

Следующие куски направления A по той же схеме: flea-config (`minLevelForFlea`), ассорты торговцев,
крафты убежища. Направление B (живые цены барахолки) без изменений — автономного источника нет.

## Ревизия 2026-07-30 — миграция GraphQL→JSON пошла (пилот: квест-зоны)
GraphQL (#474) так и лежит (503 с 21.07). Инфра устойчивости (`fetchTarkovJson` + `fetchWithFallback`,
JSON-primary → GraphQL-fallback) обкатана на первом синке: **`syncEftQuestZones` переведён на
`json.tarkov.dev/regular/{tasks,maps}`** и прогнан против прод-зеркала (`db:push` НЕ понадобился).

Гочи flat-JSON (для остальных синков):
1. Коллекции приходят **ОБЪЕКТОМ** (ключ = id), не массивом → `Object.values`.
2. У зоны `map` = **ID карты**, а не `{normalizedName}` → нужен `/regular/maps` для `id→slug`.
3. Объектив несёт `type` → `meta.objectiveKind` (item/target) → закрыло сплит легенды **#3**
   (426 зон: 303 цель / 123 предмет).
4. **☠️ КЛЮЧЕВОЕ: json.tarkov.dev НЕ отдаёт отображаемых имён.** `name` у tasks/items/
   контейнеров/боссов — плейсхолдеры `«<id> Name»`, `?lang` не влияет (проверено ru+en). Это
   зеркало **ID + структуры + координат + энамов**. Пилот квест-зон из-за этого записал в прод
   `label = "<taskId> name"` → пофикшено (имя из `EFT_QUESTS` по id, пере-синк 426 зон). **Вывод:
   на каждом синке имена резолвятся из НАШЕГО зеркала по id** — что и есть §4.11.

## Ревизия — миграция GraphQL→JSON завершена (аудит + последние синки)
Аудит `fetchTarkovGraphQL` vs `fetchWithFallback` по всему `src/` показал: барыги/крафты, hideout,
icons, landing, item-stats, gunsmith, weapons **уже были на JSON-primary** (GraphQL — fallback).
Реально на GraphQL-primary оставались двое, добиты:
- **`syncEftMapsGeometry`** → `mapsFromJson` (адаптер flat→`RawMap[]`, `markersForMap` 1:1). Имена:
  карта→`MAP_RU` (17/17), ключи замков + loose-лут→`items` (покрытие 100%), контейнеры/стационарки/
  боссы (их предметов нет в `items`)→**само-лечение**: ru-label по `linkedItemId` из уже лежащих
  маркеров. Прогон: 17 карт, 17031 маркеров, **0 плейсхолдеров**, координаты целы (объём ≈ прежний,
  prune-гард не сработал). Разовый ре-кей synth-id (flat даёт больше знаков в координатах).
- **`spt-quests`** → RU-имена из `EFT_QUESTS` вместо сетевого `tasks(lang:ru)`.

**Осознанные исключения (остаются GraphQL/особый источник):** `price-history-backfill` (historicalPrices —
time-series, в JSON-плоскости НЕТ) и `eft-prices` (живые цены барахолки — направление B, автономного
источника нет). Рантайм server-actions `tarkov-*` читают нашу Supabase (§4.11-чисто, не мигрируются).
Итог: весь структурный сток данных EFT на flat-JSON, GraphQL — дремлющий fallback.

## Немедленные шаги
1. **minLevelForFlea** — закрыт оверрайдом `eft-flea-levels.json` (работает сейчас). Следующий уровень — парсинг из SPT flea-config.
2. **Спросить мейнтейнеров tarkov.dev** (Discord/GitHub `the-hideout/tarkov-api`): отдаёт ли `minLevelForFlea` реальные значения; есть ли rate-limit/бот-защита и best-practices для крон-зеркала (черновик письма — ниже/в чате).
3. **Research SPT flea-config** — где лежат уровневые требования барахолки и ассорты торговцев; оформить дамп-скрипт по образцу сеток.

## Источники
- Схема API: `the-hideout/tarkov-api/schema-static.mjs` — `Item.minLevelForFlea: Int` ЕСТЬ (запрос корректен, но значения `null`).
- Коммиты сайта `the-hideout/tarkov-dev/commits/main`: turnstile / API-субдомен (усиление защиты) — вероятная причина 503.
- Прошлый research автономии: [[autonomy-prices-research]], извлечение ассетов: [[eft-asset-extraction]] + скилл `game-asset-extraction`.
