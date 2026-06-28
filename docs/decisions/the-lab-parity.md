---
status: ⚪ отложено
affects: maps
parent: "[[fix-maps]]"
date: 2026-06-28
blocked-by: нет SVG-подложки + maps-marker-render
---
# Карты: Лаборатория до паритета

**Статус:** ⚪ отложено (2026-06-28) — заблокирована отсутствующим ассетом. Отдельный мини-проект.
**Затрагивает:** Supabase Storage · `eft-map-config.ts` · синк маркеров · `MapViewerClient`

## Контекст и диагноз (2026-06-28)
Лаба (`the-lab`) есть в `MAP_ORDER` и `MAP_ICON_CSS` (`src/data/map-icons.ts`), но:
- **в `EFT_MAP_CONFIG` её НЕТ** → `getMapConfig('the-lab')` = undefined → страница рендерит `SectionPlaceholder`, а не фрейм. Отсюда «нет маркеров/поиска/легенды» — это плейсхолдер, а не пустая карта.
- ⚠️ **Главный блокер: нет SVG-подложки.** Проверено: `cta-media/maps/eft/the-lab.svg` (и `labs`/`lab`) → **HTTP 400** в Supabase. Без подложки рендерить нечего.

## Пайплайн заведения (когда возьмёмся)
Тот же MIT-источник, что для остальных карт (the-hideout/tarkov-dev):
1. **Ассет:** скачать Lab SVG из `assets.tarkov.dev/maps/svg/` (или репо `tarkov-dev-svg-maps`); проверить точное имя (`TheLab.svg`/`Lab.svg`).
2. **Залить** в Supabase `cta-media/maps/eft/the-lab.svg` через `scripts/upload-map-assets.ts`. ← бэкенд-шаг.
3. **Конфиг:** добавить `the-lab` в `EFT_MAP_CONFIG` — `transform`/`bounds`/`coordinateRotation`/этажи портировать из `tarkov-dev/src/data/maps.json` (normalizedName Лабы; Лаба многоэтажная — Ground + tunnels).
4. **Маркеры:** проверить, что синк tarkov.dev положил маркеры Лабы в `mapMarkers` (Лаба = старая карта, должны быть).
5. **Поиск/легенда/рейд-инфо** подтянутся сами, как только это полноценная `MapFrame`-карта.

## Зависимости
- Полный паритет (лут/боссы/легенда) ждёт [[maps-marker-render]] — отрисовку 7 уже-синканных типов.

## Вывод
Отложено. Блокер №1 — SVG-ассет (нужен бэкенд-шаг заливки). Браться отдельным заходом после `maps-marker-render` или когда дойдут руки до ассета. → план через скилл `cta-backend` для шага заливки.
