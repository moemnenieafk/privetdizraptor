---
status: 🟢 фазы A+B готовы
affects: maps
parent: "[[fix-maps]]"
date: 2026-07-02
---
# Карты: отрисовать уже-синканные типы маркеров

**Статус:** эпик [[fix-maps]] закрыт (2026-07-01), задача в самостоятельном бэклоге. Направление решено (рендерим своё), но A/B + дизайн слоёв/легенды не выбраны, синканные типы во вьюере не отрисованы.
**Затрагивает:** `MapViewerClient.tsx` · `MapLegend` · `map-marker-icons.ts` · `[slug]/page.tsx` (фильтр типов)

## Контекст
**Главный контент-выигрыш эпика.** БД (`mapMarkers`) уже хранит 11 типов, вьюер v1 рендерит 4 (`extract, spawn, transit, hazard`). Надо отрисовать остальные **7, которые уже синкаются из tarkov.dev**:
`loot_container · loot_loose · lock · switch · boss · stationary_weapon · quest_zone`.
Это закрывает «заполнить инфу о spawnpoint предметов и npc» без реверса tarkov.help. Иконки/таксономию берём из дампа `!non-related/tarkov_help_maps/map_markers/` (боссы, лут-категории, двери, экстракты).
открыть страницу https://tarkov.help/ru/map/labirint - и попробовать оттуда вытащить позиции маркеров и зафиксировать эти позиции у себя в разделе Карты - Лабиринт

## Открытые вопросы (для дизайна решения)
- **Слои/фильтры.** Сейчас 4 LayerGroups + панель toggle (top-right). Как группируем 11 типов — плоско или категориями (Лут / NPC-боссы / Двери-замки / Переключатели / Зоны квестов)?
- **⚠️ Производительность loose loot.** `loot_loose` может быть тысячи точек на карту → кластеризация / рендер только при достаточном зуме / выключен по умолчанию. Решить до реализации.
- **Легенда.** `MapLegend` сейчас статичный `LEGEND_V1`. Расширить под новые типы + иконки из дампа.
- **Связи.** `linkedItemId` (лут/замки → предмет) и `linkedQuestId` (quest_zone → задание) — кросс-линки на наши страницы `/eft/items/` и questmap (как уже сделано Item↔Barter↔Quest).
- **boss** позиции — `position: null`, у боссов `meta.spawnLocations` (несколько зон) — отрисовать как зоны/мультимаркеры.

## Варианты
- **A —** Всё сразу: 7 типов + категорийные фильтры + расширенная легенда одним заходом.
- **B —** Поэтапно: сначала «дешёвые» (boss, switch, lock, stationary_weapon, quest_zone), затем тяжёлый лут (loot_container, loot_loose) с кластеризацией отдельно.

## Вывод
*(выбрать A/B + решить группировку слоёв и стратегию loose loot)* → затем Claude Code. Зависимая: [[the-lab-parity]].

---

## Расширение: иконки от V4DYA + «на поток» (2026-07-06)
V4DYA дорисовал маркер-иконки: `public/images/maps/eft/markers/` (webp 512, для карты) + `public/icons/eft/01-maps/markers/` (svg). Задача: сверить + системный резолвер.

**Решения V4DYA (2026-07-06):** объём — **фазами** (сначала готовое: контейнеры/выходы/спавны/замки/стационарки; loot_loose с кластеризацией — отдельно); пробелы (loot_loose/quest_zone/hazard без своих иконок) — **generic пока**, PNG→webp конвертнуть.

**Сверка ассетов ↔ данные `map_markers` (1000+ маркеров):**
- Типы в данных: loot_container 596 (**29 видов**), loot_loose 156, spawn 119, quest_zone 42, lock 38, extract 36, boss 5, hazard 5, transit 3.
- Иконки: 31 webp контейнеров (✅ покрывают 29), 7 svg exfil, 3 svg lock, 3 svg spawn, 2 png stationary, 1 png spawn-btr80.
- **Ключ маппинга = `linkedItemId`** (не label — label не различает под-виды). Контейнеры НЕ в нашем каталоге items (свои BSG-id world-объектов); имя берём из marker.`label` (ru).

**Архитектура «на поток»:** резолвер `markerIconUrl(marker)` (type + linkedItemId/faction/categories/подвид → путь к иконке) заменяет плоский `MAP_MARKER_ICONS`; таблица `linkedItemId → файл` по 29 контейнерам; рендер иконками вместо CSS-фигур; легенда из резолвера.

**⚠️ Блокер сверки (нужен V4DYA):** 4 id с label «Оружейный ящик» (`5909d5ef/5909d76c/5909d89086/5909d7cf`) → 4 размера (4x4/5x2/5x5/6x3); 3 id «Куртка» (`578f8778/5914944186/5937ef2b`) → jacket/jacket-worker-blue. Нужен маппинг id→вариант (какой id какой размер/вид). Остальные ~22 — однозначно по label.

**Файлы-иконки без маркера в текущих данных** (либо карты ещё не синканы, либо запас): airdrop, laborant, common-fund-stash, plastic-suitcase, civilian-body, cash-register-tar2-2, wooden-toolbox, jacket-worker-blue.

---

## ✅ Фаза A выполнена (2026-07-06) — static/manual ветка (Ледокол + devtool)
**Решения V4DYA:** контейнеры — **generic-fallback** (id→вариант отложен); loose loot — **с кластеризацией** (→ фаза B, non-static).

**Сделано (код):**
- `src/data/map-marker-icons.ts` — переписан в **резолвер `markerIconUrl(marker)`** (единая точка правды): type + faction/category/label → путь к иконке (webp `<img>` / svg mask цветом типа) либо `null` (плейсхолдер). Таблица `CONTAINER_FILE` (категория→webp), exfil/spawn/lock под-виды. Экспорт `MAP_LEGEND`, `markerColor`.
- `manual-marker-icon.ts` — рендер через резолвер; сохранены (1) таксономия-иконки лута `icon-eft-*`, (2) глифы `quest !` / `hazard ⚠`.
- `MapMarkerEditor.tsx` — палитра с иконками типов + новый тип **«Стационарка»**; `colorOf` → `markerColor`.
- `MapLegend.tsx` — из `MAP_LEGEND` (все канонические типы).

**Проверено:** `tsc` чист; визуально на `/eft/maps/icebreaker?edit=1` — маркеры рисуются реальными иконками (спавны/контейнеры/замки), палитра с иконками. TS-контракт `ManualMapMarker` не менялся (обратно совместимо).

## ✅ Фаза B выполнена (2026-07-06) — synced-DB ветка (интерактивные карты) + drawer «Слои»
**Триггер:** V4DYA — «хочу панель слоёв как на tarkov.dev/map/the-labyrinth: кнопка → drawer со всеми слоями вкл/выкл, наш дизайн».

**Сделано (код):**
- `map-types.ts` — `linkedItemId` в `MapViewMarker`.
- `[slug]/page.tsx` — `V1_TYPES` (4) → `RENDER_TYPES` (10 позиционированных типов; boss position=null → блок статы); протащен `linkedItemId`.
- `map-marker-icons.ts` — резолвер учитывает `sides` (synced-спавны: сторона в `sides`, не `faction`).
- **`map-layers.ts`** (новый) — таксономия слоёв: группы (Выходы/Спавны/Интерактив/Лут/Навигация/Прочее) → под-слои; `layerKeyForMarker`, `defaultLayerVisibility`. Единая для рендера и drawer'а.
- **`MapLayersDrawer.tsx`** (новый, NIGHTFALL) — кнопка «Слои» (top-right) → выезжающая правая панель, дерево чекбоксов: групп-тумблер (частичное = «минус»), под-слои с иконкой (резолвер) + счётчик, сворачивание, скрытие пустых под-слоёв.
- `MapViewerClient.tsx` — интерактивная ветка переписана: все типы через резолвер в **per-layer L.LayerGroup**; видимость add/removeLayer из drawer'а; **грид-кластер loot_loose** (кастом, без плагина; пересбор на zoomend; default OFF). Убраны: плоская панель 4-слоёв, 3-позиц. фильтр фракций, spawn→exit CSS-подсветка (`sel`), отдельная `MapLegend` (drawer = легенда). Статик-ветка (Ледокол+редактор) не тронута.
- `globals.css` — `.cta-cluster`.

**Проверено вживую (factory):** все типы рисуются иконками; drawer группы+под-слои; per-item тумблер (Loose Loot → появились кластеры-бейджи); групп-тумблер (СПАВНЫ off → спавны исчезли); пустые под-слои скрыты; счётчики верны. `tsc` чист.

## ✅ Фаза C (2026-07-06) — цветные иконки V4DYA + loose loot = предметы + контейнеры по именам
**Правило V4DYA:** у маркеров СВОЯ расцветка в svg — рендерим как есть (`mode:'img'`), БЕЗ mask-перекраски и БЕЗ игрового rarity-цвета.

**Сделано:**
- `map-marker-icons.ts` — все маркеры `mode:'img'` (цветной svg/webp как есть). Новые пути: transit→`transition-point.svg`, switch→`switch-lever.svg`, quest→`quest/quest-maker.svg`, спавны→`spawn-{pmc,scav,scav-sniper,boss-add}`. **Контейнеры по ru-`label`** (`CONTAINER_LABEL_FILE`, 25 имён из БД → webp). Экспорт `spawnSubkind`.
- `manual-marker-icon.ts` — **loose loot = плитка предмета**: `itemIconUrl(linkedItemId)` на `getTarkovBackgroundColor(itemBg)` (тарк-фон слота). Остальное — цветной `<img>`.
- `map-types.ts` + `page.tsx` — поле `itemBg`; подмешивается из `getEftPriceIndex()` (loose loot: 6619 маркеров, 100% покрытие id+bg).
- `map-layers.ts` — выходы разбиты по фракции (ЧВК/Дикий/Общий), спавны (ЧВК/Дикий/Снайпер Дикого/Босс).
- **Выход по кодовому слову:** transferItem вида «Записка с кодовым словом …» (`/кодов/i`) → иконка `exfil-point-codeword` (приоритет над фракцией). Поле `transferItemName` протащено в `MapViewMarker` из `meta.transferItem.name`. Проверено DOM'ом (factory: 1 codeword + 5 pmc).
- **Выход «(Сигнал)» (зелёный фаер):** label содержит `(Сигнал)` → `exfil-point-pmc-greenflare` (активация зелёным сигнальным патроном РСП-30 / 26x75; в данных = метка в label, transferItem null). Есть на customs/ground-zero/streets/woods. Проверено DOM'ом (customs: 1 greenflare).

**Проверено (factory):** иконки цветные (выходы зелёные, спавны оранжевые, quest «?» серые); loose loot плитками предмет+фон; контейнеры по именам; кластеры работают; drawer с новыми под-слоями. `tsc` чист.

**Боссы (решение V4DYA):** НЕ точками на карте, а **иконками 28×28 в нижней панели** (`MapBottomBar`) рядом с % спавна. Резолвер `bossIconUrl(normalizedName)` (`map-marker-icons.ts`) → `/images/bosses/eft/{file}.webp` (маппинг 20 боссов, спелл-фиксы glukhar→gluhar, kollontay→kollontai, cultist-priest→sektant, shadow-of-tagilla→shadowoftagilla; нет ассета → null). Протащено в `MapBossStat.icon` из `page.tsx`. Слой «Босс» на карте = спавн-зоны boss-категории (точки) — остаётся отдельно. Иконки `spawn-boss-sniper`/`spawn-black-division` пока не задействованы (данные спавнов их не различают).

**Остальное (не блокеры):** точный контейнер weaponbox/jacket по id; кластер loose loot игнорирует этаж; клик-кросслинки на предмет/квест.

## ✅ Фаза D (2026-07-06) — пропорц. зум + раскрытие Добычи + переименования
- **Пропорциональный зум маркеров:** CSS-var `--marker-scale` на `.leaflet-container`, пересчёт на `zoom`/`zoomend` (0.5 при fit → 1.4 при max). Класс `.cta-mk-scale` на обёртке маркера/кластера. Решает видимость loose loot (мельче при отдалении, крупнее при приближении). Проверено: 0.518→0.806.
- **Drawer 3 уровня:** «Лут»→**«Добыча»**, «Loose Loot»→**«Случайная добыча»**. Контейнеры и Случайная добыча — раскрываемые узлы (chevron, свёрнуты по умолчанию): Контейнеры → ~24 типа по файлу иконки; Случайная добыча → 7 категорий (Бартер/Провизия/Инъекторы/Ключи/Постеры/Кейсы/Другое). Пустые под-типы скрыты.
- **Данные:** `layerKeyForMarker` → `container-{file}` / `loose-{catSlug}`; `lootCat` в `MapViewMarker` из `getEftCatalog()` (slug категории по linkedItemId). Кластеризация loose loot теперь **per-category** (свой L.LayerGroup на категорию).
- `MapLayersDrawer.tsx` переписан под вложенность (leaf/node), `map-layers.ts` — узлы с `children`.
Проверено (factory): Добыча partial, Контейнеры раскрываются (Спортивная сумка 13, Оружейный ящик 13, Ящик с инстр. 22, Деревянный ящик 64…), зум растит маркеры. `tsc` чист.

## ✅ Фаза E (2026-07-06) — навигация: ПКМ-цикл по слою + подлёт к спавнам босса
- **ПКМ по строке слоя в drawer** → подлёт к ближайшему (к центру вида) объекту слоя; повтор ПКМ → следующий по циклу (курсор на ключ слоя). `MapLayersDrawer.onCycle(keys)` → `MapViewerClient.cycleToLayer` (позиции по слою в `positionsByLayerRef`, курсор в `cycleCursorRef`). Работает и на группе/узле (все листья). `preventDefault` — без нативного меню.
- **Клик по иконке босса в нижней панели** → `MapViewerApi.focusPoints(boss.spawns)`: fit+пульс по возможным спавнам. Спавны резолвятся в `page.tsx`: `boss.meta.spawnLocations[].spawnKey` == `spawn.zoneName` (label) → координаты. `MapBossStat.spawns`. Боссы-роумеры без совпадений → кнопка disabled.
- **Пульс-подсветка** `.cta-flash` (пульсирующее кольцо, гаснет ~2.6с) — общая для обеих фич (`flashPoints`).
Проверено (customs): ПКМ «Дикий» цикл перескакивает между спавнами; клик «Решала» подлетает к его зонам. `tsc` чист.
