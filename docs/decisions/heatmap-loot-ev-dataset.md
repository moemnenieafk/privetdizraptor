---
status: ✅ ФАЗА 1 (датасет) + ФАЗА 2 v1 (loose heat-визуал) — реализованы; TODO: контейнеры в heat + полиш градиента (V4DYA)
affects: eft-maps, loot, data-ingest, supabase, heatmap
date: 2026-08-01
---
# Loot-EV датасет — фундамент heatmap плотности денег (ФАЗА 1)

## Цель
Тепловая карта «где на локации реально нападает больше всего ₽» требует данных, которых
НЕТ во внешнем API: json.tarkov.dev даёт ПОЗИЦИИ лута, но не шансы спавна и не пулы предметов.
Эта спека — **фаза 1**: завести в зеркало loot-таблицы EFT из файлов SPT (шанс × пул на точку),
чтобы фаза 2 (heat-визуал) считала **EV = Σ P(предмет) × цена(предмет)**. Визуал — отдельной спекой.

Ресёрч-база: [[heatmap-research]]. Playbook исполнения: `/game-data-ingest`.
Инварианты: CLAUDE.md §4.11 (автономность), §5 (db:push — отмашка), §6 (dynamic Leaflet — фаза 2).

## Решения грил-сессии (2026-08-01) — зафиксированы, не переоткрывать без причины
1. **Смысл heat = матожидание ₽ (EV).** `EV(точка) = Σ по пулу [ P(предмет) × цена ]`. Цена —
   live-барахолка `lastLowPrice ?? avg24hPrice` (тот же курс, что `keyPrice` на странице карты),
   тихая деградация к последним ценам. **EV считается на РЕНДЕРЕ** (join `priceIndex`), в зеркале
   НЕ хранится — цена живая.
2. **Охват = весь лут:** loose + контейнеры (staticLoot) + закопанные схроны + marked-room.
   marked/схроны — особые (условный шанс, напр. от ключа/квеста).
3. **Пространство = собственные loot-точки SPT** (координата + пул + шанс в одной записи),
   трансформ SPT→наш игровой простор `[x,z]`; per-point (heat всё равно размывает в области).
4. **Данные-first:** сначала датасет (эта спека), heat-визуал — фаза 2.

## Границы
- **В scope (фаза 1):** SPT-ресёрч → извлечение loot-таблиц → нормализация в
  `{точка, sourceType, пул[{itemId, prob}]}` → mirror-таблица → синк. Валидация на 1–2 картах.
- **НЕ в scope (фаза 2, ЗАПАРКОВАНО — развилки a/d/e/g в [[heatmap-research]]):** сам heat-слой
  (гипотеза `leaflet.heat`, CRS-safe), подача (режим-toggle рядом с линейкой), перф (все точки →
  грид-фоллбэк), уживание с существующим лут-фильтром.
- **НЕ трогаем:** цены (уже зеркалятся, крон `sync-prices`), tarkov.dev-позиции-маркеры (heat —
  отдельный SPT-набор точек, не переиспользует существующие маркеры).

## План (шаги)
1. **SPT-ресёрч (РИСК #1, БЛОКЕР) — ✅ СНЯТ (2026-08-01).** Вердикт: ПРИГОДЕН, см.
   [[spt-loot-tables-research]]. Подтверждено: loose-лут — `assets/database/locations/{map}/looseLoot.json`,
   `ISpawnpoint = { probability, template{Position{x,y,z}, Items[]}, itemDistribution[{composedKey,
   relativeProbability}] }` (per-point шанс + пул с весами). Контейнеры: позиция+шанс в `base.json`
   `Loot`, содержимое per-ТИП в общем `db/loot/staticLoot.json`. Координаты = сырой Unity/BSG-простор
   (тот же, что tarkov.dev). `_tpl` = наш item id. Осталось эмпирически на шаге 2: точный camelCase
   static-моделей, origin-сверка на 1–2 точках.
2. **Извлечение (dump).** По `/game-data-ingest`: снять loot-таблицы из файлов SPT в сырой JSON под
   `scripts/…` (офлайн, НЕ рантайм — §4.11).
3. **Нормализация.** На каждую loot-точку:
   `{ mapId, floor?, x, z (в НАШЕМ просторе после трансформа SPT→CRS), sourceType, containerType?,
   pool: [{ itemId, prob }] }`.
   - **Координаты (подтверждено):** SPT `Position` = сырой BSG/Unity-простор = тот же, что tarkov.dev
     → доп. трансформ SPT→BSG НЕ нужен, наш `ll(p)=[p.z,p.x]`+CRS кладёт напрямую. Только origin-сверка
     на 1–2 известных точках (шаг 2).
   - **Item id (подтверждено):** `_tpl` == BSG id == наш item id → `priceIndex.get(_tpl)` напрямую,
     маппинг-таблица не нужна.
   - **Шанс:** веса `relativeProbability` ОТНОСИТЕЛЬНЫЕ → нормировать самим: `P = rel / Σrel` по точке/типу.
   - **Контейнеры — нюанс:** экземпляр даёт позицию+шанс контейнера, а содержимое — per-ТИП (`staticLoot`)
     → `EV(контейнер) = EV его типа`, не уникален на экземпляр. Loose — честно per-point.
4. **Mirror-схема.** Новая self-mirror таблица (паттерн `hideout_upgrades`/map-geometry в
   `schema.ts`), напр. `loot_spawns`. Предложенная форма (из ресёрча):
   `{ mapId, sourceType('loose'|'container'|'cache'|'marked'), x, z, y?, probability,
   containerTpl?, pool: [{ tpl, relativeProbability }], sourceVersion }`. Хранит пул+шанс, НЕ EV
   (EV живой, join на рендере). **db:push необратим → отмашка V4DYA одной строкой (§5), схему заранее показать.**
5. **Синк.** `db:sync-loot-tables` (+ vercel cron если нужна свежесть; иначе статический дамп на
   версию SPT). Не затирать при пустом ответе (как `sync-prices`).
6. **→ ФАЗА 2 (отдельная спека):** heat-визуал по [[heatmap-research]] (leaflet.heat, режим-toggle,
   EV = join priceIndex на рендере).

## Шаг 2 — прогресс (2026-08-01, прототип на локальном SPT)
Источник (выбор V4DYA): `D:/Games/SPT/SPT/SPT_Data/database` — текущий SPT, все карты (вкл. labyrinth/terminal/town).
- **Формат подтверждён (ТЕКУЩИЙ):** looseLoot `spawnpoints[]` — у ВСЕХ есть
  `itemDistribution:[{composedKey:{key}, relativeProbability}]`; `template.Items[]` = union (~133/точку)
  с `composedKey`→`_tpl`; `probability` = шанс точки. staticLoot per-type:
  `itemDistribution:[{tpl, relativeProbability}]` + `itemcountDistribution:[{count, relativeProbability}]`.
- **Нормализатор-прототип (Customs):** 1768 loose + 552 container точек.
  `EV = probability × Σ (relProb/Σrel) × price(tpl)`, цена из нашего `getEftPriceIndex` (5060 позиций).
  **1586/1768 (90%) loose с EV>0**, суммарный EV карты ≈ **15.2M ₽**. `_tpl` == наш item id (join без маппинга).
- **Origin-сверка ✅ PASS:** loose bounds `z∈[-235..210]` ≈ наши customs-маркеры `z∈[-233..213]`,
  x-min совпал (-331 vs -320) → тот же простор, доп. трансформ SPT→наш CRS НЕ нужен.
- ⚠️ **Контейнер-позиции (открытый рефайн):** в `staticContainers.json` координаты обнулены `{0,0,0}`
  (топ-EV контейнеры схлопнулись в origin). Реальные позиции — не там; источник TBD (`base.json` Loot /
  `statics.json`). Loose (главный сигнал) — с реальными позициями, контейнеры доработать перед полным синком.

## Риски
1. ~~Доступность/формат SPT loot-таблиц~~ — ✅ СНЯТ (шаг 1: пригоден). Лицензия-нюанс: JSON базы =
   данные BSG (© Battlestate), NCSA-код SPT их не «отмывает» — риск ТОГО ЖЕ класса, что весь наш
   game-data-ingest (берём факты-числа, не ассеты/код); зеркалить с атрибуцией.
2. ~~Трансформ SPT→наш CRS~~ — снижен: координаты подтверждены как ОДИН простор с tarkov.dev (доп.
   трансформ не нужен); осталась origin-сверка на 1–2 точках (шаг 2).
3. **marked/схроны** — особая нормализация. SPT loot НЕ размечает key-gating (ключ гейтит доступ
   игрока, не спавн) → «условность» навешиваем нашим editorial-слоём поверх.
4. **`loot_spawns` + db:push** — необратимо → отмашка §5.
5. **EV зависит от live-барахолки** — единственная не-автономная связь портала; деградирует к
   последним ценам, не падает.
6. **Свежесть vs вайп:** SPT-таблицы лагают за live-вайпом EFT → EV это «≈»; отметить оговоркой в UI
   фазы 2 (не выдавать за точное матожидание текущего патча).

## Критерий готовности (фаза 1)
- [x] Шаг 1: подтверждён пригодный SPT-источник ([[spt-loot-tables-research]], вердикт «пригоден»).
- [x] `loot_spawns`/`loot_container_pools` в зеркале (28484 + 228, 11 карт), ингест идемпотентен,
  origin PASS на Customs, EV считается join'ом `priceIndex` (проверено из зеркала: топ-EV точки Customs).
- [x] Точки + пулы в зеркале, EV вычислим — **фаза 2 (heat-визуал) РАЗБЛОКИРОВАНА**.

## Фаза 1 — ИТОГ (2026-08-01)
Код: `feat(loot)` `b6e37a21`. Схема `src/db/schema.ts` (`lootSpawns`+`lootContainerPools`), RLS
`supabase/loot-tables-rls.sql`, ингест `src/db/loot-tables.ts` + `db:ingest-loot` (читает ЛОКАЛЬНЫЙ
SPT `D:/Games/SPT/SPT/SPT_Data/database`). Наполнено: 28484 loose-точки + 228 container-пулов, 11 карт
(streets 7873 макс). `_tpl` == наш item id (join цен без маппинга). SPT-key→slug словарь в `loot-tables.ts`.

**ГОЧА db:push (важно на будущее):** `drizzle-kit push --force` требует ИНТЕРАКТИВНЫЙ TTY — в
неинтерактивном шелле падает на rename-prompt (`drizzle.config` без `tablesFilter` → видит DDL-модульные
таблицы как «drop» + новые как «create» → спрашивает про rename). Схема-ДОБАВЛЕНИЕ применена прямым
идемпотентным SQL (точно по schema.ts) → безопаснее (не роняет RLS, в отличие от push --force), будущий
интерактивный db:push видит совпадение. Порядок был: create-tables (SQL) → `db:sql` (RLS) →
`db:audit-rls` (55/55 ✅) → `db:ingest-loot`.

**Контейнер-позиции решены:** SPT JSON их не хранит (все `{0,0,0}`) → берём из НАШИХ tarkov.dev
container-маркеров (уже в зеркале), джойн `containerTpl == linkedItemId`; SPT даёт per-тип пул+eCount.

**Пере-ингест при обновлении SPT:** `npm run db:ingest-loot` (delete-by-map → insert; `sourceVersion`).

## Фаза 2 — heat-визуал v1 (2026-08-01) ✅ loose
Код: `feat(maps)` `79cab645`. `leaflet.heat` (CRS-safe), EV считается СЕРВЕРОМ (`src/db/loot-heat.ts`
`getLootHeatPoints` → `page.tsx` join `priceIndex`) → клиент получает `[z,x,ev]`. Слой в
`MapViewerClient` (вне LOD, как рецепт 2), режим-toggle (огонёк в зум-кластере, `useHeatmapStore`),
градиент NIGHTFALL, нормировка p95. Verify (Playwright): canvas рендерится/чистится на toggle.
- **ГОЧА leaflet.heat + Turbopack:** неймспейс `import * as L` НЕ видит `heatLayer` (плагин патчит
  leaflet-синглтон ПОСЛЕ eval модуля) → плагин грузим ДИНАМИКОЙ в эффекте, `heatLayer` берём с
  `(await import('leaflet')).default`, не с неймспейса.
- **v1 = loose-лут.** Контейнеры (позиции из наших tarkov.dev-маркеров × SPT per-тип EV) — следующий
  инкремент; пока интерьер зданий пустоват (ценное там в контейнерах).
- **Черновое (за V4DYA):** градиент-стопы, радиус/blur/opacity, нормировка. Токен-стопы в Figma.

---
*Процесс: [[engineering-loop]] · ресёрч: [[heatmap-research]] · playbook: `/game-data-ingest` ·
статус: фаза 1 ✅ + фаза 2 v1 ✅ (loose). Дальше: контейнеры в heat + полиш градиента (V4DYA).*
