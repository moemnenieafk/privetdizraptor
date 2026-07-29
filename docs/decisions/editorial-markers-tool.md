---
status: 🏗️ spec — принято к разработке (грилл 2026-07-30), фаза 1 в работе
affects: maps, cms, editorial, story-quests, admin, moderators, supabase, rls
date: 2026-07-30
---

# Инструмент редактора карт-маркеров (editorial markers)

## Проблема
Новые квесты (особенно **сюжетные** — наши редакторские `story-*`, у которых нет
objectives/quest_zone) и POI, которых **нет в tarkov.dev**, негде взять автоматически.
Нужен инструмент, чтобы **админ/модератор за минуты вручную** ставил маркер на карту:
координаты кликом, скриншоты для наглядности, название + описание, привязка к нужному
квесту (в т.ч. сюжетному). Связано: [[CTA-MAPS-MARKER-UGC-SPEC]] (UGC-фаза 1), чип СЮЖЕТ
(`storiesForMap`, фаза B гибрида), [[project-cta-backend]].

## Что уже есть (переиспользуем, не с нуля)
- **`MapMarkerEditor`** (тоггл «Правка») — клик-постановка маркера (тип/категория/этаж/x/z).
  Сейчас **дев-инструмент**: экспорт TS в буфер → git (`src/data/map-markers/*.ts`), не в БД.
- **Медиа** — `MediaPicker`/`MediaLibrary` + `/api/admin/media` (Supabase Storage `cta-media`).
- **CMS-гард** — `getCmsUser()` = admin **ИЛИ editor** (модератор), `canEditContent`.
- **Резолвер ручных иконок** — `manual-marker-icon.ts`, `category`-ключи.

## Решения грилла (2026-07-30, V4DYA)
1. **Хранилище — ОТДЕЛЬНАЯ таблица `editorial_markers`** (не колонка в `map_markers`).
   Причина: синк геометрии прюнит `map_markers` по свежему набору tarkov.dev → ручной маркер
   там снесло бы. Отдельная таблица вне прюна. По рецепту cta-backend «new mirrored dataset».
2. **Охват — ЛЮБОЙ квест/POI** (не только сюжет). Привязка опциональна:
   `link_kind ∈ {story, quest, none}` + `link_id`. Сюжетка — частный случай.
3. **Таблица — `*-ddl.ts`-модуль** (как codex/stories/media), НЕ в `schema.ts` → **db:push НЕ
   нужен**, накат `db:migrate-all` (обходим гочу RLS-роллбэка).
4. **Доступ — admin + editor** через `getCmsUser()`.
5. **Редактор — расширяем `MapMarkerEditor`** режимом «сохранить в БД» + поля скрин/описание/
   квест (не пишем новый).

## Схема `editorial_markers`
```
id          uuid pk default gen_random_uuid()
game_id     uuid  → games(id) cascade
map_id      text  → maps(id) cascade          -- как в map_markers; редактор резолвит slug→id
floor       int?                               -- этаж мультиэтажных карт (null = базовый)
x, z        real (not null), y real?           -- игровые координаты
type        text default 'poi'                 -- вид (иконка), reuse manual-marker категорий
category    text?                              -- ключ категории иконки
title       text (not null)
description text?
screenshots jsonb default '[]'                 -- массив media-ключей (Storage)
link_kind   text default 'none'                -- 'story' | 'quest' | 'none'
link_id     text?                              -- story slug ИЛИ BSG quest id
link_step   int?                               -- опц. шаг сюжетной истории
author_id   uuid → profiles(id) set null
created_at / updated_at  timestamptz
```
Индексы: `(game_id, map_id)` — рендер карты; `(link_kind, link_id)` — чип СЮЖЕТ/привязка.
RLS: **чтение всем** (маркеры публичны, показываются на карте + SEO), **запись — серверная
owner-роль** через API-роут после проверки `canEditContent` (прямого клиентского доступа нет).

## Фазы
1. **Бэкенд-фундамент** (эта ветка): DDL-модуль + reader `getEditorialMarkers(mapId)` + типы.
   Накат `db:migrate-all` → таблица в проде (аддитивно, безопасно).
2. **API** `/api/admin/editorial-markers` (GET list / POST upsert / DELETE), гард `getCmsUser`.
3. **Редактор** — режим DB в `MapMarkerEditor`: сохранить/править/удалить маркер, поля
   title/description, `MediaPicker` → screenshots, селектор привязки (story/quest/none + step).
   **Визуал панели — под Figma-итерацию V4DYA (§6).**
4. **Рендер** — reader мержит editorial-маркеры в слой карты; чип СЮЖЕТ (фаза B) берёт координаты
   сюжетных editorial-маркеров (`link_kind='story'`) → реальные пины + подлёт.

## Открытое (не блокирует фундамент)
- Визуал строки/попапа editorial-маркера и панели редактора — Figma V4DYA.
- Работа редактора на интерактивных (Leaflet) картах, не только статик — проекция x/z↔lat/lng
  (у `MapViewerClient` уже есть, переиспользовать).
- Модерация UGC-фаз (загрузка юзерами) — отдельно, ждёт домена (см. UGC-спека).
