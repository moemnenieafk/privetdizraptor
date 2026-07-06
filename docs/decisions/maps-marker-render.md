---
status: 🔵 обдумываю
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
