---
status: 🚦 HANDOFF — старт нового чата, продолжение разработки визарда маркеров
date: 2026-07-31
read-first: true
---

# HANDOFF — Interactive Maps: editorial-маркеры → Step Marker Wizard

**Первым делом в новом чате прочитать:** этот файл + `docs/decisions/UI - Step Marker Creation
control.md` (полная дизайн-спека визарда) + `docs/decisions/editorial-markers-tool.md` (что уже
построено). Скилл реализации — `/figma` (брать отдельный скрин КАЖДОГО фрейма, не по памяти).

## Git-состояние
- Ветка **`feat/eft-maps-grill2`**, `main` влит в неё же (последний общий tip **`ca746b2`**).
- Всё закоммичено, дерево чистое. Работаем дальше на этой ветке; в `main` льём ff-push
  `git push origin feat/eft-maps-grill2:main` по отмашке V4DYA (необратимое, §5).

## Что УЖЕ готово (в main)
1. **Миграция GraphQL→flat-JSON** (`json.tarkov.dev`): maps-geometry, spt-quests, квест-зоны и
   пр. GraphQL — дремлющий fallback. Гоча: flat JSON НЕ отдаёт имён (плейсхолдеры) → имена из
   нашего зеркала по id. Детали: `docs/decisions/eft-data-autonomy-research.md`.
2. **Инструмент editorial-маркеров** (полный CRUD):
   - Таблица `editorial_markers` (в проде, RLS read-all). Reader/CRUD `src/db/editorial-markers.ts`,
     drizzle-дефиниция `src/db/schema-editorial.ts`, DDL `src/db/editorial-markers-ddl.ts`.
   - API `src/app/api/admin/editorial-markers/route.ts` (GET/POST/DELETE, гард `canEditContent`).
   - Карточка `src/components/features/maps/EditorialMarkerCard.tsx` — popup над каплей, показ +
     инлайн-правка: **пикер категорий** (типы+подкатегории с РЕАЛЬНЫМИ иконками маркеров через
     `markerIconUrl`), название/описание, скрины (MediaPicker + лайтбокс), привязка (Без/Квест/
     Сюжет + шаг). Фон непрозрачный, кнопки со сплошной заливкой. Клэмп позиции в экран.
   - Постановка кликом: `MapViewerClient` addMode → **черновик в памяти, INSERT только на «Сохранить»**.
   - Рендер editorial-слоя + мерж привязки квеста/истории на странице `src/app/eft/maps/[slug]/page.tsx`.
3. **Чип СЮЖЕТ фаза B**: `src/lib/story-map-link.ts` (`storiesForMap`) + пины сюжетки из editorial-
   маркеров (`MapSearchDrawer`, `focusPoints`).
4. **Иконки маркеров**: новые SVG заведены масками в `src/styles/icons.css` (`.icon-eft-*`).
   На карте иконки — полноцветный `<img>` через `markerIconUrl`; маски — для UI.

## Что ДАЛЬШЕ — Step Marker Wizard (спека: `UI - Step Marker Creation control.md`)
Переработка плоской карточки в **4-шаговый визард** + **универсальный редактор**. Фазы:
- **Ф1.** Карточка ПОКАЗА по клику (Figma `Marker - On Click`, node 2374-2492): медиа/категория/
  заголовок/описание/чип-связи + для admin ряд **⇄ ПЕРЕМЕСТИТЬ / ✎ РЕДАКТИРОВАТЬ**. Чистый UI,
  схему не трогает — **лучший старт**.
- **Ф2.** Каркас визарда (шаги 1-4, навигация Далее/Назад, амбер прогресс-бар); раскидать
  текущий контент карточки по шагам.
- **Ф3.** Шаг 2 «выбор объекта» по категориям (Loot→поиск предмета уже есть в drawer — переиспользовать).
- **Ф4.** Шаг 4: новый `linkKind='event'` + **морфинг иконки** quest-маркера по типу связи
  (`quest-item-{side,story,event}.svg` уже в icons.css; обновить `markerIconUrl`/резолвер).
- **Ф5. Универсальный редактор** — правка СУЩЕСТВУЮЩИХ (в т.ч. синканных tarkov.dev):
  `editorial_markers += source_marker_id` (alter), мерж-оверрайд на рендере, синк не трогает.
  **Режим перемещения** (V4DYA): курсор=иконка → ЛКМ ставит точку → окно подтверждения →
  оверрайд x/z; Pan в режиме на СКМ. Механика подробно — в спеке.
- **Ф6.** Completed-превью финального пина + полировка 1:1 по фреймам.

**Открытые развилки (грилл перед Ф5):** полный редакт vs аннотации-поверх у синканного · флаг
«скрыть» кривой синканный · оверрайд позиции · `source_marker_id` vs отдельная `marker_overrides`
(рекомендую первое).

## Ключевые файлы / карта кода
| Что | Путь |
|---|---|
| Карточка/пикер (станет визардом) | `src/components/features/maps/EditorialMarkerCard.tsx` |
| Leaflet-вьюер (editorial-слой, popup, addMode, place-clamp) | `src/components/features/maps/MapViewerClient.tsx` |
| Проброс пропсов (canEdit/questIndex/storyIndex/mapId) | `MapFrame.tsx` → `MapViewerLoader.tsx` |
| Страница карты (читает маркеры, резолвит связи) | `src/app/eft/maps/[slug]/page.tsx` |
| БД editorial | `src/db/editorial-markers.ts`, `schema-editorial.ts`, `editorial-markers-ddl.ts` |
| API | `src/app/api/admin/editorial-markers/route.ts` |
| Таксономия категорий | `src/data/map-markers/categories.ts` |
| Резолвер иконок (markerIconUrl) | `src/data/map-marker-icons.ts` |
| Иконка-глиф в UI (ManualMarkerLike+meta) | `src/components/features/maps/manual-marker-icon.ts` |
| Сюжет↔карта | `src/lib/story-map-link.ts` |

## Гочи / конвенции (важное)
- **Схема:** менять через `*-ddl.ts` (`alter … add column if not exists`) + `npx tsx scripts/migrate-all-ddl.ts`
  (НЕ `db:push` — гоча RLS-роллбэка). RLS read-all уже стоит.
- **Запись** защищена сервером (`canEditContent`); клиентский `canEditMarkers` (из `getCmsUser`,
  проброшен со страницы) — только для показа кнопок. V4DYA (`vadimkahardcore@gmail.com`) = **admin**.
- **Синк не трогает `editorial_markers`** (отдельная таблица — ради переживания прюна).
- **Leaflet:** `ll = (p)=>[p.z, p.x]`; из клика `x = e.latlng.lng, z = e.latlng.lat`. Popup клэмпится
  в границы карты (`place()` + ResizeObserver). Иконки-глифы = `markerIconUrl` (img/mask).
- **Проверки:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` + `npx eslint <files>`.
  НЕ поднимать 2-й `npm run dev` на общий `.next` (гоча зависания). Leaflet-визуал проверяет V4DYA.
- **Демо-маркер** `[DEMO]…` лежит на customs — снести через редактор или скриптом, когда не нужен.

## Figma
Файл `Z1c9wK3AtqBrBhSwNt8qZz`, секция «UI - Step Marker Creation control»:
визард **node 2374-2468**, карточка-по-клику (Move/Edit) **node 2374-2492**.
Скилл `/figma` перед реализацией; `get_screenshot`/`get_metadata` по каждому фрейму.
