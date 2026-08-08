---
status: ✅ ЖИВЁТ НА ПРОДЕ 2026-08-02 — Ф0–Ф4 исполнены, катовер задеплоен (grill2→main 6c0701dc), карты читают единую `markers`. Ф5 (DROP старых таблиц) — на ОТЛЁЖКЕ (выбор V4DYA): страховочная сеть отката, снести отдельным коммитом после соака
affects: maps, markers, editorial, supabase, sync, cms
date: 2026-08-02
---
# Единая система маркеров карт (synced + user в одной модели)

## Проблема
Два разъединённых слоя маркеров на интерактивной карте:
- **`map_markers`** — зеркало tarkov.dev (крон `sync-maps-geometry`: prune+upsert). Рендер через
  `layerKeyForMarker` → `positionsByLayerRef` → drawer-секции «Контейнеры»/«Случайная добыча»,
  фильтр слоёв, ПКМ-цикл.
- **`editorial_markers`** — Wizard/CMS (RLS, admin/editor). **ИЗОЛИРОВАННЫЙ** рендер (свой
  `editorialLayerRef`, свои иконки/карточки/override), НЕ проходит через систему слоёв/позиций.

→ Маркер, добавленный **Wizard'ом** (контейнер/лут), появляется на карте, но **НЕ попадает** в
drawer-секции, фильтр, ПКМ-цикл, счётчики. А задумано было «все маркеры одинаковы».

## Решение (грил 2026-08-02) — МОДЕЛЬ
Единая таблица `markers`, где synced и user — граждане одного класса, один рендер-пайплайн.
1. **Цель = полная единая система:** любой маркер (вкл. синканный) редактируем через Wizard, всё в
   одном хранилище и одном UI-пайплайне.
2. **`source` ∈ `sync` | `user`.** Крон upsert/prune **ТОЛЬКО `WHERE source='sync'`**; user-маркеры
   неприкосновенны (крон их не видит).
3. **Wizard пишет `source='user'`.** Новый маркер — самостоятельная user-строка.
4. **Правка синканного = user-override** (`sourceMarkerId` → базовый sync-маркер; подавляет/дополняет
   его на рендере; `hidden` — скрыть). База остаётся под кроном → **свежесть tarkov.dev сохраняется**.
   Это ровно текущий механизм editorial, перенесённый в общую таблицу.
5. **ОДИН рендер-пайплайн для всех** → drawer-секции/фильтр/ПКМ-цикл/иконки видят ВСЕ маркеры —
   **это и закрывает изначальный gap**.

## Схема `markers` (superset) — ✅ НАКАЧЕНА НА ПРОД 2026-08-02
Реализация: **`src/db/markers-ddl.ts`** (`MARKERS_DDL`, идемпотентно, RLS read-all внутри модуля) +
**`src/db/schema-markers.ts`** (Drizzle query-дефиниция). Накат `db:migrate-all` (158 стейтментов ок),
`db:audit-rls` подтвердил RLS. Наполнена бэкфиллом: **17457 sync + 39 user**.

**Развилки схемы — как РЕШЕНО (в проде):**
- **id/PK:** surrogate `uuid` PK + `external_id text` (tarkov.dev id у sync); апсерт крона — partial-
  unique `(map_id, external_id) WHERE source='sync'`.
- **Координаты:** real-колонки `x/y/z` (индексируемо), NULLABLE — боссы/чисто-полигональные зоны.
- **Вокабуляр типов:** ⚠️ ИЗМЕНЕНО против чернового плана — **НЕ ремапим**, храним НАТИВНЫЙ по source
  (sync = `loot_container`/`loot_loose`, user = editorial `container`/`loot`). Причина: для мерж-
  рендерера (Б) ридер ветвится по source, а ремап ломал бы editorial-иконку (`editorialIcon` ждёт
  `m.type==='loot'`). Колонка `type` — свободный `text`. Кросс-вокабуляр для дериваций — мост Ф0.
- **Полигон:** одно jsonb-поле `polygon` (`outline` map_markers + `polygon` editorial → сюда).
- **Размещение:** DDL-модуль (`db:migrate-all`), НЕ `schema.ts`+`db:push` — безопаснее (db:push --force
  откатывает RLS своих таблиц; DDL-модуль аддитивен и не трогается чужим db:push).

## План миграции (ПОЭТАПНО; db:push/миграция прод-данных = §5, необратимо → отмашка V4DYA)
- **✅ Фаза 0 — мост на ЧТЕНИИ (безопасно, обратимо, БЕЗ схемы) — ИСПОЛНЕНА 2026-08-02:** временно
  влить `editorialMarkers` в drawer-деривации (`containerGroups`/`looseTiles`, нормализация типов) +
  их позиции в `positionsByLayerRef` → Wizard-маркеры сразу видны в секциях/фильтре/цикле. **Даёт
  ценность немедленно, де-рискует большую миграцию.**
  *Реализация:* новый чистый нормализатор `src/components/features/maps/editorial-bridge.ts`
  (`buildEditorialBridge`: editorial → `MapViewMarker[]`, вокабуляр `loot→loot_loose`/
  `container→loot_container`/`stationary→stationary_weapon`, центроид для polygon, `lootCat` тем же
  `classifyLoot15`, что синканный loose). Собирается на сервере (`page.tsx`, где есть каталог+прайс),
  прокинут пропом `editorialBridge` через `MapFrame` → `MapSearchDrawer` (секции считают из
  `[...markers, ...bridge]`) и `MapViewerLoader`→`MapViewerClient` (позиции моста мёржатся в
  `cycleToLayer` read-time — БЕЗ дубль-рендера: капли рисует свой editorial-слой).
  *Верификация:* `tsc --noEmit` 0 · `eslint` изменённых файлов чист (3 проблемы `MapViewerClient` —
  предобработанные React-Compiler, доказано `git stash`) · `next build` 0 (прод-компиляция + 249 стр.).
  **Не тронуты (вне названного скоупа):** правая легенда `counts` (`MapLayersDrawer`), синканный
  рендер, схема/крон. Live-verify (тайл+цикл на Wizard-маркере) — при наличии editorial-данных карты.
  Обратимо: убрать `editorial-bridge.ts` + проброс пропа → поведение 1:1.
### Фазы 1–5 — ИСПОЛНЕНО с V4DYA 2026-08-02 (Ф0–Ф4 в проде; Ф5 на отлёжке)
> Развилка рендера решена — **Б (мерж-рендерер)**: ридер ветвится по `source`, ВЫХОДНЫЕ формы
> (`MapMarkerRow`/`EditorialMarkerRow`) сохранены → страница/рендер НЕ менялись, риск минимален.
> DB-операции V4DYA делегировал боту («сам с БД разрулишь»); все аддитивны/обратимы (кроме Ф5).

- **✅ Фаза 1 — накат `markers`.** `db:migrate-all` (158 ок) + `db:audit-rls` (RLS цел). Таблица на проде.
- **✅ Фаза 3 — бэкфилл** (сделан ПЕРЕД Ф2, чтобы доказать модель до кода). `scripts/backfill-markers.ts`
  (идемпотентно, `WHERE NOT EXISTS`) + `scripts/verify-markers.ts`. Результат: 17457 sync + 39 user,
  counts 1:1, **все 39 override-связей резолвятся**. Откат = `delete from markers`.
- **✅ Фаза 2 — MIRROR (НЕ рефактор крона).** Уточнённый безопасный подход: `mirrorSyncMarkers()`
  (`src/db/maps.ts`) — `map_markers`→`markers(sync)` upsert+prune, прюн **ТОЛЬКО `source='sync'`**.
  Крон/райтеры `map_markers` НЕ тронуты → нулевой регресс + `map_markers` остаётся свежим (сеть отката).
  Вызов в `/api/cron/sync-prices` после синков (best-effort). Live-verify: `synced 17457`, ON CONFLICT ок.
- **✅ Фаза 4 — ридеры/райтер → `markers`, мерж-рендерер Б.** `getEftMapData`→`markers(sync)` (id=
  external_id, x/y/z→position, polygon→outline); `editorial-markers.ts` get/upsert/delete→`markers(user)`;
  формы сохранены → `page.tsx`/рендер не тронуты, **мост Ф0 ОСТАВЛЕН** (всё ещё мостит user→деривации).
  `editorial_markers` заморожена (снапшот отката). Live-verify: customs 1340 sync + 37 user, формы 1:1.
  **Катовер:** `next build` 0 → ff-push `grill2→main` (`6c0701dc`) → Vercel-деплой. Прод-карты здоровы.
- **⏳ Фаза 5 — уборка. НА ОТЛЁЖКЕ (выбор V4DYA 2026-08-02).** Старые таблицы = сеть отката, снести
  отдельным коммитом после соака. **Шаги пост-соак:** (1) рефактор `syncEftMapsGeometry`/
  `syncEftQuestZones` — писать `markers(sync)` НАПРЯМУЮ + убрать `mirrorSyncMarkers`; (2) `DROP TABLE
  map_markers, editorial_markers`; (3) убрать скаффолд — `mapMarkers` из `schema.ts`, `schema-editorial.ts`
  + `editorial-markers-ddl.ts`. **Откат ДО Ф5 (во время соака):** revert катовер-коммита + редеплой →
  старые ридеры на `map_markers` (свеж, крон не трогали) / `editorial_markers` (пред-катовер снапшот;
  правки editorial В ОКНЕ соака идут в `markers(user)` → при откате потерялись бы — редких правок мало).

## Риски / гарды
1. **§5:** миграция прод-маркеров необратима → отмашка на db-шаге.
2. **Крон prune только `source='sync'`** — иначе сотрёт всё пользовательское (критично; тест до прод-крона).
3. **Override-связи `sourceMarkerId`** при миграции сохранить (иначе правки синканных «отвяжутся»).
4. **RLS:** крон-owner (в обход RLS) пишет sync; user-RLS (admin/editor) пишет user; чтение — всем.
5. **§4.11 автономность цела:** всё в нашей БД, наружу — только крон sync-maps-geometry.
6. **Единый рендер:** синканные должны пойти через тот же путь, что user (или мерж) — не потерять
   editorial-фичи (медиа/линки/карточка) и synced-фичи (кросс-линк лут→предмет, зоны выходов).

## Развилки — статус
- ✅ **id/PK:** surrogate uuid + `external_id(text)` для sync (решено, в `markers-ddl.ts`).
- ✅ **Координаты:** real-колонки `x/y/z` (решено).
- ✅ **Вокабуляр типов:** НАТИВНЫЙ по source (sync=synced-имена, user=editorial) — НЕ ремапим (иначе
  ломается editorial-иконка); ридер ветвится по source. `type` — свободный text.
- ✅ **outline/polygon:** одно jsonb-поле `polygon` (решено).
- ✅ **Размещение:** DDL-модуль вместо schema.ts+db:push (решено — безопаснее).
- ✅ **Фазировка:** Ф0 исполнена; Ф1 схема написана; Ф1(накат)–5 = runbook под надзором.
- ✅ **Единый рендер (Ф4):** выбран **Б — мерж-рендерер** (V4DYA 2026-08-02). Ридер ветвится по
  `source`, формы сохранены → UX игрока цел (синканные лёгкие: кросс-линк/инфо-карточка), богатая
  editorial-карточка + правка у user и в админ-оверрайде. Опция A (богатая карточка для ВСЕХ) НЕ взята.

---
*Процесс: [[engineering-loop]] · грил 2026-08-02 (цель=полная единая · source-колонка · override для
правки синканного) · связано: `editorial-markers-tool.md`, `CTA-MAPS-MARKER-UGC-SPEC.md`, `/cta-backend`.*
