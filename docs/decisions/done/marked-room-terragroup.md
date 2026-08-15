---
status: ✅ сделано
affects: src/db/marked-rooms.ts, scripts/seed-marked-rooms.ts, src/components/features/maps/MapViewerClient.tsx, public/images/maps/eft/marked-rooms/factory.svg
date: 2026-08-15
---
# Меченая комната «Склад Terragroup» на Заводе

Полная меченая комната для Завода по паттерну `docs/decisions/done/marked-rooms.md` (не форк). Прогон через `/autopilot` (semi), запись `.autopilot/marked-room-terragroup/`.

## Что и почему
- **Данные ванильные.** Ключ-карта «от склада TerraGroup» (`66acd6702b17692df20144c0`), синканный lock-якорь на game-позиции x=-20.431, z=44.06 (карта `55f2…`), loot_spawns + бартер ключа → экономика собирается штатным `getMarkedRoomBySlug`. Проверено: лут 24 поз., EV 29 789 ₽, ключ 5 000 000 ₽ (барахолка), вердикт breakeven 168 / keyUses 10 / lifetime −4.7М / profitable:false.

## Три готчи (кровью, для следующей тайловой карты)
1. **Дубль map-id.** У Завода в БД ДВЕ карты normalizedName "factory": тайловая `id="factory"` (оверлей/маршрут/worldTransform) и синканная `id="55f2d3fd4bdc2d5f408b4567"` (замки+лут). `getMarkedRoomBySlug` брал ПЕРВУЮ по normalizedName → комнату (сид на `55f2…`) терял. Фикс: комната резолвится по `(gameId, slug)` среди ВСЕХ одноимённых карт, `mapRow` берётся из mapId реальной комнаты. Однокарточные slug (customs и пр.) не затронуты.
2. **Ключ-КАРТА ≠ meched.** Label «Ключ-**карт**а…» классифицируется `lockKind()` как `keycard`, НЕ `marked` → автосид её не берёт. Плюс у ключа 2 лока (Завод `55f2…` + Лаба `59fc…`). Фикс: `ROOM_OVERRIDES` по keyItemId в `seed-marked-rooms.ts` — force-включает нужный лок (пиннит карту Завода, отсекает лабовский) + задаёт slug/title.
3. **Оверлей меченок не грузился на Заводе.** Загрузчик в `MapViewerClient` был под `if (!isStatic …)`, а Завод `staticMap:true`. Расширено на тайловые/editorial. Оверлей НЕ по-этажный → привязка **data-driven**: группа комнаты несёт `data-floor` (basement=3), видна только на своём этаже; группа без `data-floor` = всеэтажная (customs и пр. не меняются). SVG: снять непрозрачный фон-rect, обернуть в `<g data-room="…" data-floor="…" class="cta-room">`, класть в `public/images/maps/eft/marked-rooms/{mapSlug}.svg`.

## Осталось
- **Глазная проверка** визуала: оверлей на этаже «Тоннели» виден и кликается → страница (код/SVG чисты, механизм как у рабочих карт, но браузером не прогонялось).
- Маркеры входов в комнату (у паттерна были «3 входа») — в брифе не было, отдельная задача.
