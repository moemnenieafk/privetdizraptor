---
status: ✅ реализовано (фазы 1–4, 2026-07-30) — ветка feat/eft-maps-grill2
affects: maps, cms, editorial, story-quests, admin, moderators, supabase, rls
date: 2026-07-30
---

## ✅ Готово (2026-07-30)
Полный CRUD editorial-маркеров на интерактивной карте, инлайн-редактор в карточке-popup:
- **Бэкенд** — таблица `editorial_markers` (накатана, RLS read-all), reader/CRUD, API
  `/api/admin/editorial-markers` (GET/POST/DELETE, гард `canEditContent`).
- **Рендер** — страница читает маркеры (+резолв квеста), слой на карте (амбер-капля),
  клик → карточка-popup НАД каплей (уголок 28×14, backdrop-blur, закрытие кликом вне окна).
- **Карточка** (Figma 2349-929) — галерея скринов с лайтбоксом (фуллскрин + пролистывание,
  стрелки/Esc), ряд трейдер/квест+ур.+каппа, заголовок/описание, «Выполнено?»(toggleQuest)+
  скрепка(togglePin).
- **Редактор** (admin/editor, `getCmsUser`) — карандаш 36×36 → инлайн-правка заголовка/описания,
  «+»→`MediaPicker` (скрины), автокомплит привязки к квесту, Сохранить/Удалить, постановка
  нового маркера кликом (crosshair) → сразу в правке.
Осталось опционально: «+ шаг сюжета» (`link_step`) в UI, СЮЖЕТ-фаза B (пины сюжетки из этих
маркеров), floor-фильтр editorial-слоя на мультиэтажках, чистка демо-маркера.

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

## Дизайн карточки (Figma node 2349-929, V4DYA 2026-07-30)
**Карточка ПОКАЗА = редактор (инлайн-редактирование, «прогрессивный подход»).** Один вариант
карточки, ширина 348. Структура сверху вниз:
- **Галерея скринов** — ряд миниатюр 49×28 (`rounded-xs`; активная — рамка tactical-amber,
  прочие — `lines-hover`) + большой скрин `aspect-[348/196]`. Добавление скрина — **свободная
  клетка галереи с иконкой «+»** (в режиме правки).
- **Ряд привязки** — аватар трейдера + имя квеста (слева), `ур. N+` + иконка каппы (справа).
  Трейдер/уровень/каппа — **производные** от связанного квеста.
- **Заголовок** (`title`, blender-medium 16) + **описание** (`description`, blender-book 12,
  text-secondary). В правке — инлайн-инпут/textarea.
- **Ряд действий**: **«Выполнено?»** = существующая кнопка закрытия квеста (`useQuestStore.
  toggleQuest(linkId)`, переиспользуем) + **скрепка** = существующий контрол «закрепить на Карте
  Квестов» (`useQuestStore.togglePin(linkId)`, переиспользуем). Шеврон вниз — след. маркер.
- **Привязка квеста** — инпут с автоподбором по вводу → подтверждение да/нет выбранного квеста.

Токены Figma→NIGHTFALL: #E68E25→tactical-amber · #313135→lines-hover · #F2F2F2→text-primary ·
#9696A1→text-secondary · #BDA550→kappa · тинт карточки (#45998b в макете) = `traderCssVar` квеста.

## Открытое (не блокирует)
- Автокомплит привязки квеста, загрузка скринов через `MediaPicker`, персист правок в API — вайринг.
- Работа на интерактивных (Leaflet) картах — проекция x/z↔lat/lng (у `MapViewerClient` есть).
- Модерация UGC-фаз (загрузка юзерами) — отдельно, ждёт домена (см. UGC-спека).
