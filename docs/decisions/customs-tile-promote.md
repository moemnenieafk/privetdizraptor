---
status: ✅ ЗАКРЫТО — в проде (V4DYATV смёржил в main 370008df + задеплоил 838a91dd, 2026-08-30; https://cta.quest/eft/maps/customs 200, тайлы+worldTransform живьём)
affects: scripts/build-map-tiles.mjs, src/data/eft-map-config.ts, src/components/features/maps/MapViewerClient.tsx, src/app/eft/maps/[slug]/page.tsx, src/data/maps/customs-markers.json (new), public/images/maps/eft/marked-rooms/customs.svg (new), public/images/maps/eft/marked-rooms/factory.svg
date: 2026-08-30
---
# Промоут Таможни (customs) SVG → HD-тайлы (гибрид B)

## 🔧 ПРАВКА 2026-08-30 (третья итерация): архитектура исправлена — customs НЕ staticMap
**Ошибка предыдущей итерации:** увёл customs в `staticMap`-путь (создан для бедных карт Завод/Лаба) →
`MapFrame` гейтит ВЕСЬ инструментарий на `!staticMap` → пропали левая (поиск на локации) и правая (легенда
слоёв) панели, боссы/зоны/heat/визард; плюс чёрные квадраты (rect без fill). V4DYA справедливо: «неприемлемо».

**Исправление (живьём проверено в браузере):** customs — обычная СИНКАННАЯ карта (`!staticMap`), тайлы это
лишь ПОДЛОЖКА (`tileBase`). Весь инструментарий вернулся автоматически (висит на `!staticMap`). page.tsx
синканная ветка проецирует game→canvas-latlng тайлов через `worldTransform` (маркеры/зоны/heat/спавны боссов);
`top/bottom` не трогаются — гейт этажа по game-Y как на прежней SVG-Таможне. Этажи: `tile`(арт)+`height`(гейт).
Чёрные квадраты → тонкий золотой контур комнат (fill:none), 314 с полупрозрачной заливкой. Курированный
пофлоорный подход (src/data/maps/customs-markers.json) ОТЛОЖЕН — он давал точные этажи, но лишал tooling'а
(нет боссов/зон/heat/faction спавнов); артефакт остался в `.tmp-customs/`. Проверено: обе панели, легенда со
счётчиками (выходы 31/спавны 125/интеракт 40), маркеры выровнены по тайлам, переключение этажей грузит тайлы.

**Долг тюнинга (V4DYA, визуально):** диапазоны `height` этажей приблизительны (общага 1/2/3 стопкой по game-Y →
2-й/3-й этаж фильтруются неточно). Подобрать [4,7]/[7,9]/[9,1000] по факту. Это единственная неточность.

## 🟢 СТАТУС 2026-08-30 (вторая сессия): build выполнен на ветке `feat/customs-tile-promote`
tsc + eslint зелёные (0 новых warning), локальный смоук: `/eft/maps/customs` = 200 (тайл-конфиг+worldTransform+маркеры),
оверлей комнат 200, страница меченой 314 = 200, декоративная комната = 404 (навигация правильно гейтится). Не запушено.

**Решения V4DYA (эта сессия):** (1) кликабельна только меченая 314, прочие комнаты — декоративные контуры;
(2) вести на feat-ветке, промоут в прод (push) — после его живой сверки.

## 🟢 СТАТУС 2026-08-30 (3-я сессия): пивот на СИНканную карту + фикс editorial-координат
**Пивот (прошлые сессии, уже в коде):** первый заход увёл customs в `staticMap`-путь (bедные карты) → обрезал
ВЕСЬ инструментарий (`MapFrame` гейтит панели/боссов/квест-зоны/heatmap/визард на `!staticMap`). Исправлено:
customs = обычная СИНканная карта (`!staticMap`, весь тулинг), тайлы — только подложка (`tileBase`).
Синканные маркеры/зоны/heat/боссы проецируются game→canvas-latlng через `worldTransform` СЕРВЕРНО в `page.tsx`
(синканная ветка, `pXZ`). Гейт этажа — курированная floor-карта (`.tmp-customs/build-floormap.mjs`, у синканных
лут/контейнеров НЕТ высоты). Глобальный CSS-фикс: `.cta-mk-offfloor{display:none !important}` (Leaflet
`.leaflet-marker-icon{display:block}` перебивал → поэтажное скрытие не работало НИ НА ОДНОЙ карте). Оверзум
тайлов ограничен нативным (было `maxZoom+2` → мыло 4×). up/down-бейджи и image-off восстановлены (моя же
`!important`-правка их скрыла — editorial-offfloor теперь видны приглушённо + бейдж). up/down добавлены и на
СИНканные POI (замки/выходы/квесты) чужого этажа.

**Фикс editorial-координат (эта, 3-я сессия):** BP-доки «Документация Terragroup — BP S1» (37 editorial на
`56f4…`, вставлены скриптом battlepass-спринта) лежат в **game-координатах**, а промоут проецировал только
синканные → editorial уезжали за границы. Сверка: editorial-extract «Выход А - Общежитие» game(181,213) =
синканный «Dorms V-Ex» (дистанция 0.0) → проекция точна. **Решение V4DYA: проекция на рендере, БД остаётся
в game-координатах (канон, как синканные; переживёт рекалибровку тайлов).** Реализация:
- `page.tsx` синканная ветка: `viewEditorial` = editorial x/z/polygon через `applyAffine(worldTransform)` (как `pXZ`).
- Запись визарда разворачивает latlng→game через новый хелпер `toGameEditorialBody(body, wt)` (`map-calibration.ts`,
  использует `invertAffine`). В `MapViewerClient` — единый POST-канал `postEditorial` (все 7 write-путей:
  delete-hide, batch-edit, batch-create, move, batch-move, hide-synced), в `EditorialMarkerCard.save` — проп `storeWt`.
- Условие разворота: `!config.editorial && config.worldTransform` (синканная тайл-карта = customs). На editorial-static
  картах (Завод: `config.editorial`) editorial живут в canvas → `storeWt=null`, no-op (не сломано).
- Проверено вживую: 191 маркер, **0 за границей** (было — 37 editorial OOB). tsc+eslint зелёные. Не запушено.

**⚠️ КЛЮЧЕВОЕ ОТКРЫТИЕ (правит допущение чекпоинта «маркеры по transform поэтажно само»):**
этаж синканных маркеров **невыводим автоматически** — ни по game-Y (floor1/floor2 общаги налезают в 0–4),
ни по x,z (96/160 маркеров 2-го этажа стоят стопкой <3 м над наземными). Единственная правда об этаже —
**курированные пофлоорные файлы V4DYA** (`.tmp-customs/customs-{ground,second,third,basement}.json`). Поэтому
рендерим НЕ сырой синканный набор (1431), а **курированный (1155, этаж=файл)**, обогащённый тонким типом +
item-линком из ближайшего синканного маркера (100% в пределах 8 м). Датасет — `src/data/maps/customs-markers.json`.

**Как это сделано в коде (гибрид «интерактивная ветка на тайлах»):**
- Датасет `src/data/maps/customs-markers.json` (курированные {floor,x,z game,type,label,linkedItemId}).
- `page.tsx` статик-ветка при `config.tileMarkers`: game→latlng через `applyAffine(worldTransform)` (готово для `ll()`),
  обогащение itemSlug/keyPrice/lootCat/roomHref из зеркала цен → `data.markers` (MapViewMarker[] + floor-индекс).
- `MapViewerClient`: тайл-карта с `tileMarkers` идёт в ИНТЕРАКТИВНУЮ ветку (не в static-simple) → богатый рендер
  переиспользован целиком (легенда/карточки/кросс-линки/loose-кластеры). Гейт по этажу — явный `floor`-индекс
  маркера в `applyFloor` (+ loose-кластеры гейтятся в `rebuildLoose` по floor, пересбор на смене этажа).
  Мёртвый dot-путь `renderHdMarkers` удалён, флаг `tileMarkers` перепрофилирован под богатый рендер.
- Оверлей комнат: `customs.svg` (22 декоративных контура из bbox + бокс меченой 314 по позиции её замка).
  Навигация клика гейтится классом `cta-room-link` (только 314); `factory.svg` тоже получил класс (клик сохранён).
- Конфиг `EFT_MAP_CONFIG.customs` промоутнут: staticMap+tileBase+worldTransform+tileMarkers+tileVersion:1+5 этажей.
  editorial НЕ включён (маркеры из датасета; можно добавить позже — потребует строку maps(id='customs')+защиту).

**Осталось V4DYA:**
1. Живая сверка: тайлы грузятся, маркеры на местах (калибровка 0.5–2 м), поэтажный гейт (общага 1/2/3), легенда,
   карточки замков/лута, оверлей комнат + клик 314. Особо глянуть тип-микс (w=130 «прочее» матчился к spawn/lock —
   возможны единичные мис-типы) и лут стопки этажей.
2. Промоут в прод: push ветки (авто-деплой Coolify). Плюс — защита строки maps от крон-прунинга: **тайл-карта
   customs НЕ имеет своей строки maps** (маркеры из файла, не из БД) → защита НЕ нужна, в отличие от Завода.
   Синканная строка `56f4…` живёт как раньше (её читает getMarkedRoomBySlug для 314).
3. Долг: geometry меченой 314 (сейчас бокс по замку — нет её Figma-полигона «Rectangle 54xx»); editorial-визард;
   12 комнат без bbox (двери есть — см. rooms-matched.json); tileVector-оверлей при желании.

---
## (история — первая сессия, ниже)

Перевод Таможни с Shebuka-SVG на HD-тайлы (5 этажей), маркеры (синканные + editorial) поверх через калибровку game→canvas. Аналог `factory-hd-promote`, но customs = богатая синканная карта (1431 маркер) → маркеры кладём по transform, не руками.

## ✅ Что уже сделано
- **Тайлы нарезаны + на R2:** customs 5 этажей (basement/ground/second/third/fourth, 27310 тайлов). Завод обновлён до v10 (запушен). **Ground Таможни перерезан из обновлённого мастера 2026-08-30** и залит на R2 (свежий).
- **SPECS** в `scripts/build-map-tiles.mjs` — блок `customs` добавлен (src `public/maps/customs/16384px`, 5 этажей).
- **Калибровка выведена и ПРОВЕРЕНА** (5 замков, ошибка 0.5–2 м).
- **Figma:** залиты подложка Shebuka (underlay, 4 этажа), оверлеи маркеров по этажам, 36 замков (именованные). V4DYA выровнял underlay в наш 16384-холст и вручную курировал маркеры + разложил двери/комнаты по этажам.

## 🔑 Калибровка (единый transform для ВСЕХ этажей)
game → canvas(16384):
- `canvasX = 10803.5 − 15.313·gameX`
- `canvasY = 8723.5 + 15.171·gameZ`

canvas → game (для чтения Figma-фреймов):
- `gameX = (10803.5 − canvasX) / 15.313`
- `gameZ = (canvasY − 8723.5) / 15.171`

worldTransform для конфига (marker-latlng space, /64 при maxZoom=6):
- `[-0.23927, 0, 168.80, 0, -0.23705, -136.30]`

**⚠️ ГОЧА:** координаты дверей/комнат в Figma уже в 16384-canvas системе (относительно `customs-locks` фрейма [0,0] внутри каждого этажа). **НЕ вычитать origin этажа** (фреймы этажей стоят бок-о-бок на странице, но coords узлов локальные — на этом спотыкались).

**⚠️ ГОЧА tileVersion:** у customs НЕТ поля `tileVersion` в конфиге (пока SVG-карта) → `node build-map-tiles.mjs customs` мис-бампает `tileVersion` СЛЕДУЮЩЕЙ карты (Завода). До промоута резать customs ТОЧЕЧНО (sharp напрямую, как ground 2026-08-30), либо сначала добавить tileVersion в конфиг customs.

## 📦 Данные (persisted, на диске)
- `.tmp-customs/CALIBRATION.md` — дубль этой математики.
- `.tmp-customs/customs-rooms-raw.json` — **34 комнаты** (по этажам): `{floor,name,doorCx,doorCy,roomX,roomY,roomW,roomH}` в canvas16384. Включает `reshalas-bunkhouse-key` (нового ключа НЕТ в синканных локах — keyItemId разрешать по слагу `reshalas-bunkhouse-key`). Гоча: marked-комната 314 и часть границ названы `Rectangle 54xx`, субагентом не пойманы как room/door.
- `.tmp-customs/customs-{ground,second,third,fourth,basement}.json` — **курированные V4DYA маркеры** (ground 959 / second 160 / third 33 / basement 3 / fourth 0), `{x,z,w}` в ИГРОВЫХ координатах; ширина w кодирует тип: **90=лут, 130=прочее, 180=выход/босс**.

## Ключевые Figma-ноды (файл Z1c9wK3AtqBrBhSwNt8qZz)
- Кадр ground (калибровка): `3294:69550` (внутри `HD-map` 402,4026 + `underlay` 115,4066 w16384 h8253).
- Секция дверей/комнат: `3330-12765` (парсено в customs-rooms-raw.json).
- Кадры курированных маркеров: ground `3318-26392`, second `3318-27730`, third `3318-27960`, fourth `3318-28084`, basement `3318-27700`.

## Дубль map-id (как у factory)
Две карты normalizedName "customs": **синканная `56f40101d2720b2a4d8b45d6`** (маркеры/лут/замки — 1431 шт) и, после промоута, тайловая (slug `customs`). `getMarkedRoomBySlug`/`getMarkedRoomsForMapSlug` уже разводят дубль (см. marked-room-terragroup.md). Синканные данные читать с `56f4…`.

## 🚧 Осталось (build — со свежего контекста)
1. **Двери→замки:** для каждой комнаты из raw.json door center → game (инверсия) → матч к DB-локу (source=sync,type=lock на `56f4…`) по близости → keyItemId/тип/экономика. `reshalas-bunkhouse-key` — по слагу.
2. **Границы комнат → оверлей** `public/images/maps/eft/marked-rooms/customs.svg` (пофлоорно, `<g data-room data-floor class="cta-room">` из roomX/Y/W/H). Механизм оверлея на тайл-картах + этаж-гейт УЖЕ есть (см. marked-room-terragroup.md, MapViewerClient ~1807).
3. **Курированные маркеры** (customs-*.json) → набор на тайлы: тип по w + матч к DB для rich-данных.
4. **Промоут конфига** `EFT_MAP_CONFIG.customs`: staticMap+tileBase+groundTile+tilePixelSize[16384,16384]+tileExt jpg+**tileVersion**+worldTransform+editorial+5 layers (basement/ground/second/third/fourth). Защита строки maps от крон-прунинга (CUSTOM_MAP_IDS + триггер, как factory).
4b. Добавить `tileVersion` customs → чинит мис-бамп; бампать при перерезке.
5. **Вьюер:** тайл-ветка рендерит синканные+editorial маркеры customs через worldTransform, поэтажно (по высоте y / config floor heights). Сейчас тайл-ветка синканные НЕ рисует (factory показывал только editorial) — это основная кодовая работа.
6. R2: тайлы уже залиты; при перерезке — точечно + бамп.

## Как продолжить
Новый чат: «подними customs-промоут из docs/decisions/customs-tile-promote.md» — прочитать этот файл + `.tmp-customs/*.json`, выполнить build-пункты. Туннель БД: `bash ~/cta-provision/dev.sh` (CLAUDE.md §13) — нужен для матчинга к синканным маркерам.

---

## ✅ ЗАКРЫТИЕ ПЕТЛИ (§8) — 2026-09-01

**В проде.** V4DYATV смёржил ветку в `main` (`370008df feat(maps): промоут Таможни на HD-тайлы (синканная карта) + фикс editorial-координат`) и задеплоил (`838a91dd chore(deploy): npm run deploy`), 2026-08-30. `origin/main` = local (синк). Живая сверка `https://cta.quest/eft/maps/customs` (2026-09-01): 200, HD-тайлы z0–z6 рендерятся, легенда со счётчиками (выходы 31 / спавны 90 / интерактив 39, меченые 1), оверлей комнат (23 группы), переключатель этажей, editorial-тулбар. Маркеры по умолчанию OFF (слои сняты — штатный declutter); по включению слоя рисуются и выравнены по тайлам (калибровка держит). Регрессий нет.

**Что вошло сверх исходного build (последующие сессии):**
- **Резкость на макс-зуме:** тайл-карты ограничены нативным макс-зумом (без оверзума +2, который растягивал тайлы 4× → мыло). SVG-карты оставлены с +2. `MapViewerClient` (init `L.map`).
- **Поэтажный гейт — 3 бага починены:** (1) смена тайла этажа больше не под `if(!isStatic)` → работает для любой `isTiled`; (2) синканным маркерам этаж проставляется по ближайшей курированной точке (`.tmp-customs/build-floormap.mjs`, распределение 1124/172/34 совпало с курацией V4DYA) → `applyFloor` гейтит по явному floor-индексу; (3) **глобальный CSS-фикс:** `.leaflet-marker-icon{display:block}` перебивал `.cta-mk-offfloor{display:none}` (равная спец., Leaflet позже в каскаде) → off-floor маркеры не скрывались НИ НА ОДНОЙ мультиэтажной карте; поправлено `!important`.
- **up/down на СИНканных маркерах Таможни (POI):** off-floor замки/выходы/квесты не скрываются, а показываются приглушённо + кликабельная стрелка вверх/вниз (прыжок на этаж) — как у editorial. Лут/контейнеры/спавны чужого этажа скрываются (иначе шум ~150 стрелок). Классы `.cta-mk-otherfloor` + хелпер `syncFloorHint` + `POI_FLOOR_TYPES`.
- **editorial up/down + image-off восстановлены:** промежуточный `!important` на `.cta-editorial-offfloor` их скрыл (глобально, и Завод); разведено — синканные off-floor скрываются, editorial показываются приглушённо + бейдж.

**Остаточные долги (не блокеры):**
- **Тюнинг высот этажей** — гейт синканных теперь по явному floor-индексу (не по game-Y), так что для Таможни это неактуально; height-диапазоны в конфиге оставлены как фолбэк.
- **Меченая 314** — кликабельный бокс по позиции замка (точный полигон восстановим из git-истории старого `customs.svg`, viewBox 1063×536).
- **Тип-микс** синканных «прочее» (w=130) мог дать единичные мис-типы — визуальная сверка при случае.
- **`stash@{0}` "wip-maps-and-scratch"** (On main) — отдельный незакоммиченный WIP (ExtractCard, map-marker-icons +27, figma-agent-prompts.md), НЕ связан с этим промоутом. Разобрать/применить или дропнуть отдельно.
