---
status: 📥 принято (грил 2026-08-02) — модель/спека; код/миграция/db НЕ трогались
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

## Схема `markers` (superset, ЧЕРНОВИК — дожать)
Объединяет поля обеих таблиц:
- **Общее:** `id` (см. развилку id), `gameId`, `mapId`, `source`, `type`, `floor?`, координаты,
  `outline/polygon` (jsonb точек), `label`, `faction`, `sides`, `categories`, `linkedItemId`,
  `linkedQuestId`, `meta`, `syncedAt/createdAt/updatedAt`.
- **User-надстройка** (из editorial): `category`, `title`, `description`, `screenshots` (jsonb),
  `linkKind`, `linkId`, `linkStep`, `sourceMarkerId` (override), `hidden`, `authorId`.

Расхождения, которые надо свести (см. развилки):
- **Координаты:** `map_markers.position` (jsonb `{x,y,z}`) vs `editorial.x/y/z` (real). → одно.
- **id/PK:** synced — стабильный tarkov.dev text-id (composite PK `mapId,id`); user — uuid. → свести
  (напр. surrogate `uuid` PK + `externalId text` для sync).
- **Вокабуляр типов:** synced `loot_container`/`loot_loose` vs editorial `container`/`loot`. → единый.
- `outline` (map_markers) vs `polygon` (editorial) — одно jsonb-поле.

## План миграции (ПОЭТАПНО; db:push/миграция прод-данных = §5, необратимо → отмашка V4DYA)
- **Фаза 0 — мост на ЧТЕНИИ (безопасно, обратимо, БЕЗ схемы):** временно влить `editorialMarkers` в
  drawer-деривации (`containerGroups`/`looseTiles`, нормализация типов) + их позиции в
  `positionsByLayerRef` → Wizard-маркеры сразу видны в секциях/фильтре/цикле. **Даёт ценность
  немедленно, де-рискует большую миграцию.** Рекомендуется как первый шаг.
- **Фаза 1:** новая таблица `markers` (superset) в `schema.ts` + `markers-rls.sql` (крон-owner пишет
  sync; user-RLS admin/editor). `db:push → db:migrate-all → db:sql` (порядок cta-backend).
- **Фаза 2:** рефактор крона → пишет в `markers` `source='sync'`, prune `WHERE source='sync'` (НЕ
  трогает user — критично, тест обязателен).
- **Фаза 3:** миграция данных: `editorial_markers` → `markers` `source='user'` (сохранить
  `sourceMarkerId`-override-связи); `map_markers` → `source='sync'` (или первый прогон крона наполнит).
- **Фаза 4:** CMS/Wizard-райтеры + ридеры (`getEditorialMarkers`/`getEftMapData`) → на `markers`;
  **рендер унифицировать** (синканные через тот же путь, что user).
- **Фаза 5:** удалить старые `map_markers`/`editorial_markers` после live-верификации.

## Риски / гарды
1. **§5:** миграция прод-маркеров необратима → отмашка на db-шаге.
2. **Крон prune только `source='sync'`** — иначе сотрёт всё пользовательское (критично; тест до прод-крона).
3. **Override-связи `sourceMarkerId`** при миграции сохранить (иначе правки синканных «отвяжутся»).
4. **RLS:** крон-owner (в обход RLS) пишет sync; user-RLS (admin/editor) пишет user; чтение — всем.
5. **§4.11 автономность цела:** всё в нашей БД, наружу — только крон sync-maps-geometry.
6. **Единый рендер:** синканные должны пойти через тот же путь, что user (или мерж) — не потерять
   editorial-фичи (медиа/линки/карточка) и synced-фичи (кросс-линк лут→предмет, зоны выходов).

## Открытые развилки (дожать перед/в исполнении)
- **id/PK:** surrogate uuid + externalId(text) для sync?
- **Координаты:** jsonb `position` vs `x/y/z`.
- **Вокабуляр типов** (привести к synced-именам?).
- **Единый рендер:** синканные через editorial-путь (богатый: карточка/медиа) vs мерж-рендерер.
- **Карточка/медиа для синканных:** клик по любому маркеру → единая карточка (можно добавить медиа/описание)?
- **Фазировка:** делать Фазу 0 (мост) сейчас как быстрый фикс gap, параллельно готовя Фазы 1–5?

---
*Процесс: [[engineering-loop]] · грил 2026-08-02 (цель=полная единая · source-колонка · override для
правки синканного) · связано: `editorial-markers-tool.md`, `CTA-MAPS-MARKER-UGC-SPEC.md`, `/cta-backend`.*
