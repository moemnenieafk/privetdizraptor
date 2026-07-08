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

# SPT items.json разобрать и сказать что можно вытащить
Ну во первых вот файл - !for-deep-research\item.json - удалось вытащить SPT файл с позициями как ты просил. Попробуй синхронизировать его с нашими позициями и правильно поставить позиции weapon box - или контейнеров Оружейный контейнер.

## ✅ Фаза F (2026-07-08) — дизамбигуация weaponbox/jacket по world-id (SPT-сверка)
**Разбор `!for-deep-research/item.json`:** это НЕ позиции, а конфиг SPT (`configs/item.json`) — blacklist/bossItems/пресеты/handbookPriceOverride. Координат нет. Реальные позиции — в `SPT_Data/database/locations/<map>/{staticContainers,looseLoot}.json`, размеры сеток — в `templates/items.json`.
**Решён блокер Фазы C** (4 id «Оружейный ящик» / 3 id «Куртка»). Сверка с SPT `templates/items.json` дала id→вид:
- terraWBox: `5909d5ef…`=5×2, `5909d76c…e53d2adf`=6×3, `5909d7cf…ee57d75a`=4×4, `5909d89086…591234a0`=5×5.
- jacket: `578f8778…`=обычная, `5937ef2b…`=жёлтая квестовая (→generic jacket), `5914944186…`=рабочая (`jacket-worker-blue`).
**Код:** `map-marker-icons.ts` — `MarkerIconInput.linkedItemId` + таблица `CONTAINER_ITEM_FILE` (приоритет над label в `containerFile`). `map-layers.ts` — 4 под-слоя размеров weaponbox + «Куртка рабочего» (sample по `linkedItemId`). Иконки под все варианты уже были у V4DYA. `tsc` чист.
**Открыто:** нужен ли импорт SPT-координат как доп.источника (сейчас позиции 1:1 из tarkov.dev) — ждёт решения V4DYA.

**Сравнение покрытия SPT vs tarkov.dev (bigmap):** SPT сервер-БД **НЕ хранит XYZ контейнеров** — в `staticContainers.json` все `Position=0,0,0`, `statics.json` — только `groupId` (координаты в клиентских бандлах). Значит SPT НЕ источник позиций контейнеров → tarkov.dev остаётся единственным. НО: `looseLoot.json` (1768 точек на bigmap с реальными XYZ) и `base.json.SpawnPointParams` (318 спавнов с зонами) — заметно полнее tarkov.dev; потенциальный доп.источник для loose loot / спавнов, если решим (отдельный бэкенд-подсприн).

## ✅ Фаза G (2026-07-08) — под-виды выходов (SPT PassageRequirement → иконки + слои)
Классификация выходов сверена с SPT `base.json` (все карты). Единый `extractSubtype(m)` в `map-marker-icons.ts` (точка правды для иконки, слоя, легенды):
- **paidcar** (`exfil-point-paidcar`) — платный В-Выход: RU-label `^В-Выход` ∥ transferItem=валюта (SPT `TransferItem`+Рубли). 7 карт.
- **codeword** (`exfil-point-codeword`) — transferItem «Записка с кодовым словом …» ∥ **«Карта минных полей …»** (Маяк/Резерв/Лес — добавлено).
- **redrebel** (`exfil-point-pmc-redrebel`) — SPT `Reference/Alpinist`: «Тропа альпиниста» (Берег), «Спуск со скалы» (Резерв), «Тропа через перевал» (Маяк).
- **nobackpack** (`exfil-point-nobackpack`) — SPT `Empty/EXFIL_tip_backpack`: «Вентиляционная шахта» (Лаба/Стриты), «Трубопровод отопления» (Резерв). ⚠️ SPT-список может быть неполным — ждёт сверки V4DYA.
- **greenflare** — «(Сигнал)», без изменений.
`map-layers.ts` — группа «Выходы» = 8 под-слоёв (ЧВК/Дикий/Общий/Платный/Кодовое слово/Альпинист/Без рюкзака/Зелёный сигнал); `layerKeyForMarker` через `extractSubtype`; пустые скрыты drawer'ом. `tsc` чист. Проброс `transferItemName` уже был (Фаза C).
**Решение V4DYA:** список nobackpack оставляем 2 вида (SPT-полный).

## ✅ Фаза H, Шаг 1 (2026-07-08) — спавн-иконки фракций rogue/black-division (по boss-зонам)
tarkov.dev спавны различают только `player/bot/boss/botpmc`+sides — отдельного rogue/black-division НЕТ. Но `boss.meta.spawnLocations[].spawnKey` == `spawn.zoneName` (label). Сверка: **rogue** = босс Маяка (7 зон: Zone_Blockpost/RoofContainers/…), **black-div** = Терминал (много Zone1BD…). Эти зоны реально присутствуют как spawn-маркеры (Zone_Blockpost x6, Zone_Hellicopter x7).
**Код:** `page.tsx` — карта `zoneName→фракция` (rogue/black-division) по boss-маркерам, проброс `spawnFaction` в спавны. `map-types.ts`+`map-marker-icons.ts` — поле `spawnFaction`, `spawnSubkind` возвращает rogue/black-division (иконки `spawn-rogue`/`spawn-black-division`). `map-layers.ts` — под-слои «Отступники (Rogue)» / «Black Division». `MapViewerClient` — тултипы. `tsc` чист.
**Решения V4DYA (Шаг 2):** спавн-кластеры дикий/ЧВК → резать до 1-2 на зону; босс = 1 портрет + свита boss-add; порядок — dev-tool первым.

## ✅ Фаза H, Шаг 2а (2026-07-08) — dev-tool «Правка»: иконки категорий + боссы webp + Goons
- **`map-marker-icons.ts`** — `SPAWN_CATEGORY_KIND` (категории редактора pmc/scav/sniper/rogue/blackdiv/escort/raider/cleanup/boss/goons/cultist/smuggler → под-вид). `spawnSubkind` учитывает `m.category`. Спавн с `bossKey` → webp-портрет `/images/bosses/eft/{key}.webp`. Экспорт `BOSS_ROSTER` (17 боссов, key=basename) + `GOONS_FILES` (bigpipe/birdeye/knight).
- **`manual-marker-icon.ts`** — спец-рендер Goons (3 портрета внахлёст); поле `bossKey`.
- **`MapMarkerEditor.tsx`** — при category='boss' пикер 17 боссов (webp-превью) → `bossKey`; проброс в маркер, экспорт TS, id, `fromView`. Ростер/резолвер решают «боссы=webp», «Goons=3 картинки».
- **types** — `ManualMapMarker.bossKey`, `MapViewMarker.bossKey`; static-path в `page.tsx` пробрасывает. `tsc` чист.
- Теперь Ледокол размечается вручную: rogue/black-division/boss(портрет)/goons ставятся с корректными иконками.
## ✅ Фаза H, Шаг 2б (2026-07-08) — синканные карты: босс-портрет на зону + свита + рез скоплений
- **`page.tsx`** — карта `zoneName→bossKey` (портрет «настоящего» босса, не rogue/black-div) из `boss.meta.spawnLocations`. **Один портрет-маркер на зону** (первый boss-спавн зоны → `bossKey`=webp), прочие boss-точки зоны = свита (spawn-boss-add). **Рез скоплений:** Дикий/ЧВК > 2 на зону → `dropSpawn` (не рисуем); боссов/свиту/снайпера/rogue/black-div не режем. `bossPortraitKey` в резолвере (normalizedName→basename).
- Портрет и свита остаются в под-слое «Босс» (spawnSubkind игнорит bossKey → layerKey `spawn-boss`). Партизан-роумер (spawnLocations пуст) — портрета на карте нет, остаётся в нижней панели (кнопка подлёта disabled, Фаза E). `tsc` чист.
- **Осталось/подумать:** Goons на синканных картах = один портрет (knight), не трио (трио — только ручной редактор); порог реза (2) — при необходимости настроить; клик-кросслинки маркеров на страницы (предмет/квест).

## ✅ Фаза I (2026-07-08) — loose loot: кросс-линки + иконки категорий + предмет-иконка в редакторе
1. **Кросс-линк случайной добычи → страница предмета.** `MapViewMarker.itemSlug` (=normalizedName из `getEftPriceIndex()`); клик по одиночному loose-маркеру → `/eft/items/item/{slug}` (синк + статик-ветки `MapViewerClient`). page.tsx проставляет itemSlug.
2. **Иконки категорий loose loot в drawer** из нашей таксономии. `LayerItem.iconClass`; `LOOSE_SUBLAYERS` → `icon-eft-*` (Бартер/Провизия/Инъекторы/Ключи/Постеры→infoitems/Кейсы/Другое→items-equipment); `LayerGlyph` рендерит CSS-маску (приоритет над резолвером). ГОЧА: класс `icon-eft-items-loot` НЕ существует (есть `-loot-tier`) → давал сплошной квадрат; поправлено при live-проверке.
3. **Газовый резак «Огонёк BBQ-S43»** (id `67ab3d4b83869afd170fdd3f`). Лабиринт — уже loose loot (10 точек, синк → плитка предмета + линк из п.1). Ледокол (статик) — редактор получил поле **«ID предмета»** для type='loot' (превью `itemIconUrl`, экспорт `linkedItemId`); `ManualMapMarker.linkedItemId`, static-path грузит price-индекс для bg+slug. `tsc` чист.
**Список правок карты — пройден полностью** (осталось из заметки: иконки замков кодовые-панели/интерком — отдельная мелкая пачка).

## ✅ Фаза J (2026-07-08) — иконки замков (кодовая панель + интерком/ключ-карта)
V4DYA дал 2 PNG → сконвертил в webp (`sharp`, q92), PNG удалил: `markers/lock/lock-keycard-pannel.webp`, `lock-standard-security-keypad.webp`. **Гоча:** tarkov.dev `lockType` = door/container/trunk/switch (ЧТО заперто, не механизм) → механизм читаем по имени ключа. Резолвер `lockKind(m)`: keycard/интерком (имя ключа ~ карт/пропуск/keycard/интерком) → `lock-keycard-pannel.webp`; меченый → `lock-mechanical-marked.svg`; прочее → стандартный `lock-standard-security-keypad.webp`. `tsc` чист. (Старые svg lock-mechanical/lock-keycard-pannel остались как ассеты, не удалял.)

## ✅ Live-проверка (2026-07-08, Маяк + Ледокол, Chrome)
JS-аудит DOM + скриншоты. **Работает:** выходы Платный/Кодовое слово/Альпинист (иконки+счётчики верны); Отступники (Rogue) 7 своей иконкой; drawer-иконки категорий loose loot из нашей базы; замки = новый keypad-webp (27 шт); **босс-портреты НА карте** (knight/zryachiy webp) + нижняя панель (Партизан-роумер только там); **0 битых** изображений. Редактор Ледокола: все категории спавнов, пикер 17 боссов (webp-превью), поле «ID предмета» с живым превью (газовый резак). Фикс по ходу: Постеры/Другое иконки (см. Фаза I гоча).

## Правки по карте:
- добавил иконку спавна Отступников Rogue фракции на маяке и ледоколе они есть .icon-eft-spawn-rogue
- public\images\maps\eft\markers\lock добавил иконки стандартной панелей кодовых, и интеркома которая является одновременно ключ-картой замком.
- выставить иконку Решалы босса из папки bosses public\images\bosses\eft\reshala.webp
- все предметы Случайной добычи должны быть связаны и их страницей ID предмета.
- выходы типа нужна Карта минных полей назначить иконку .icon-eft-exfil-point-codeword
- найти выходы на картах без использования рюкзака и назначить им иконку .icon-eft-exfil-point-nobackpack
- найти выходы с использованием Red Rebel и Паракорда (обычно это горы на берегу, маяке и на резерве) и назначить этим выходам .icon-eft-exfil-point-redrebel
- А-Выходы ЧВК это отдельная категория платных выходов и использует иконку .icon-eft-exfil-point-paidcar
- в drawer должны отображаться все доступные выходы иконки
- проконтролировать все спавны боссов и закрепить их за каждым боссом к примеру босс Партизан - где его найти? и выставить картинку босса webp вместо маркера boss-add, причем не надо прям все маркеры заменять только один в одной зоне а остальные это свита босса пусть так будет.
- boss-add маркер это отображение свиты боссов
- иконки случайной добычи должны подхватывать иконки категорий из нашей базы предметов
- сократить кол-во маркеров спавна дикого и спавна ЧВК до 1-2х маркеров иконок там где их большое скопление. для этого можно выключить отображение всех остальных маркеров на карте.
- Терминал, Ледокол - выяснить точные маркеры где находятся бойцы Black Division и подставить под них специальную иконку .icon-eft-spawn-black-division
- Маяк, Ледокол - отступники у них есть отдельная иконка 
- Газовый резак "Огонёк BBQ-S43" в лабиринте и ледоколе использовать иконку из базы данных наших предметов
  
## правки dev-tool "Маркеры" - кнопка "Правка":
- дополнить и расширить каждую категорию маркеров
- подвязать и использовать корректные маркеры и иконки
- маркеры боссов это картинки webp из папки public\images\bosses\eft 
- маркер Goons - картинки из трёх боссов из папки public\images\bosses\eft - bigpipe.webp, birdeye.webp, knight.webp

# На подумать и анализировать
https://github.com/ShaneeexD/MapLootEditorLite - провести deep research и узнать как это может помочь нам в дальнейшем, что оттуда можно вытащить и как этим пользоваться.
https://github.com/M4elstr0m/TarkovMapTracker - провести deep research и выяснить как вытащить реальные позиции тех или иных маркеров а также фишку с отслеживанием игрока на миникарте и в игре через распознавание скриншотов. Если что я уже скачал и положил в папку !for-deep-research\TarkovMapTracker-v3.0.0

## ✅ Deep research проведён (2026-07-08) → [[deep-research-maptracker-looteditor]]
**TL;DR:**
- **TarkovMapTracker** = трекинг игрока НЕ через CV, а **парсингом имени файла скриншота EFT** (игра запекает x,y,z + кватернион в имя PNG). BattlEye-safe. **Мы уже владеем идентичным трансформом** (`EFT_MAP_CONFIG`) → «Отслеживать позицию» встраивается браузерно (File System Access API, без десктоп-аппа, без §4.11-нарушений); `y`→авто-этаж. Труд S-M. Их код нельзя копировать (CC BY-NC-ND) — технику имени файла реализуем с нуля.
- **MapLootEditorLite** = SPTarkov-мод, **F8 в рейде ставит маркер в реальной позиции** → JSON-пак `{x,y,z}` в нашей же координатной системе. Закрывает пробел «SPT сервер-БД без XYZ контейнеров» (in-raid позиция читается точно). Инструмент авторинга недостающих координат, офлайн-SPT, ручной. На будущее.
- Оба — «на будущее», не блокеры. Рекомендация №1 — браузерный трекинг игрока (отдельный спринт).
## ✅ Фаза Track-1 (2026-07-08) — браузерный трекинг игрока + добивка мелочи (с телефона)
Сессия целиком с телефона (отпуск, без ПК): правки → коммит в `main` через GitHub API → CI. Добавлен CI (`.github/workflows/ci.yml`): `tsc --noEmit` на каждый пуш. **Гоча:** проект на **Next 16**, где команду `next lint` выпилили → линт из CI исключён (миграция на eslint напрямую — отдельная мелкая задача).

**Ушло в `main`:**
- **Браузерный трекинг игрока (Рекомендация №1 из deep research).** Новое: `src/lib/eft-screenshot.ts` (парс имени скриншота EFT → `{x,y,z,yaw}`, кватернион→хединг, `floorIndexForHeight`, персист хендла папки в IndexedDB), `src/store/useTrackingStore.ts` (Zustand), `src/components/features/maps/PlayerTracker.tsx` (кнопка «Позиция» в тулбаре рядом со «Слои» + поллинг 1с + маркер-стрелка). Follow-режим: авто-центр + авто-этаж по `y`. Проброс `onRequestFloor` через MapViewerLoader → MapFrame → `setActiveFloor`. Охват: синк + статик, где есть `transform`; иначе кнопка disabled. File System Access API → на мобильных браузерах/без transform недоступно (гейт по `showDirectoryPicker`).
- **Кросс-линки на синканных картах** — квест-зона → `/eft/quests/task/{id}`, лут с привязкой → `/eft/items/item/{slug}`. Раньше кликались только на статик-картах и в loose-loot кластере; у обычных синканных маркеров клика не было.
- **Goons трио на синканных** — билдер `page.tsx` проставляет `category:'goons'`, когда ключ портрета зоны из `GOONS_FILES` → срабатывает уже готовый `isGoons`-оверлей (3 портрета внахлёст). Причина бага: синканные ставят `categories` (массив), а триггер иконки смотрит `category` (единичное) → рисовался 1 портрет.
- **Порог реза спавнов** — магическое `n > 2` вынесено в именованную `SPAWN_CAP_PER_ZONE = 2` (page.tsx). Юзер-контрол (слайдер в drawer слоёв) осознанно отложен: рез серверный, живая крутилка требует клиентского ре-рендера + ПК для проверки плотности.

Коммиты: Track-1 `06bfbeaf` · tsc-фикс async-итератора папки `2323e052` · кросс-линки `4cb79f2e` · Goons `abb59e6a` · spawn-cap `6bb8e618`. Все `tsc`-зелёные, CI прошёл.

**Открыто (ждёт ПК/тестера):**
- Track-1: live-калибровка оффсета стрелки (`yaw + coordinateRotation`, возможно ±90/180°) на Маяке — правится в одном месте, `place()` в `PlayerTracker.tsx`. С телефона/без EFT не проверить.
- SPT-координаты как доп. источник (Фаза F) — не начато.
- MapLootEditorLite — на будущее.
