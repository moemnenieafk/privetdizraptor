---
type: decision-spec
status: ⏳ в работе (/autopilot design-to-code, 2026-08-22)
sprint: bitcoin-config-redesign
owner: V4DYA
figma: node 3022:1901 (fileKey Z1c9wK3AtqBrBhSwNt8qZz)
related: docs/decisions/bitcoin-profit-rework.md (базовый раздел)
files:
  - src/app/eft/progress/hideout/bitcoin-profit/BitcoinProfitClient.tsx
  - src/app/eft/progress/hideout/bitcoin-profit/page.tsx
---

# Редизайн конфигуратора «Прибыль BITCOIN» (design-to-code по Figma)

Заменяем ВЕСЬ текущий конфигуратор (плитки-уровни + слайдер GPU + быстрые кнопки + слайдер навыка + тумблеры топлива + кнопка Терапевт) на EFT-native 3-колоночный дизайн из Figma-ноды 3022:1901. Ниже конфигуратора — герой-вердикт, шкала GPU, метрики, «что нужно» — **не трогаем** (§скоуп). Расчёт `src/lib/bitcoin-profit.ts` не меняется.

Дизайн запинен фигмой; числа/размеры/цвета — из get_design_context + get_variable_defs. Скрины: `.autopilot/bitcoin-config-redesign/figma-full.png` (3 состояния L1/L2/L3), `figma-row1.png`.

## 1. Раскладка (3 колонки, gap 28, ширина ~1048px, центр)
Внешний ряд: `flex gap-7 items-start`. Колонки: **724px** (Уровень фермы) · **196px** (Убежище ЧВК) · **128px** (Продажа Bitcoin). Каждая колонка сверху — микро-лейбл с линией (`text-type-micro` = 10px, `text-text-muted`, uppercase + hr `bg-lines-hover`, паттерн rule-micro-labels).

## 2. Колонка «УРОВЕНЬ ФЕРМЫ» (724px) — плитки + грид GPU
Ряд `flex gap-[18px] items-center`:
- **Плитки-уровни** (столбец, `h-[161px] justify-between`, 3 шт по `w-[160px] h-[48px] rounded-[4px] px-[14px] flex justify-between items-center`):
  - Слева: иконка фермы `bitcoin-farm` (`stationIconClass`, 28px) + номер уровня «01/02/03» (24px, Blender Medium uppercase).
  - Справа (2 строки, text-right): верх — слоты (18px), низ — «видеокарт» (10px).
  - **Выбранный**: `bg-[rgba(230,142,37,0.1)]` (`bg-(--primary)/10`) + `border-(--primary)` + текст `text-(--primary)`; справа показывает **«{gpu}/{slots}»** (напр. 5/10).
  - **Невыбранные**: `bg-card-menu` + `border-lines-hover` + `text-text-secondary`; справа показывает **только «{slots}»** (10/25/50).
  - **Построенный из профиля** уровень — пометка (напр. точка/иконка-галка), как built-marker.
- **Грид GPU** (`w-[546px] h-[161px]`): **10 колонок × 5 строк = 50 иконок** `gpu-icon.svg`. Состояния иконки:
  - **amber** (`bg-(--primary)`) = установлено (индекс < gpu) — «залито».
  - **grey** (`bg-text-muted`/lines) = свободный слот в пределах потолка уровня (gpu ≤ индекс < slotsForLevel(level)).
  - **dark** (тусклый, напр. `bg-lines-hover/40` или opacity) = заперто (индекс ≥ slotsForLevel(level)).
  - Клик по иконке индекса i → **gpu = i+1**; если i+1 > потолок текущего уровня → авто-выбрать минимальный уровень, где slots ≥ i+1. Ховер подсвечивает «будет N».
  - Иконка `gpu-icon.svg` — через `icon-mask` (перекрашиваемая маска) ИЛИ inline-SVG с `currentColor`; проверить, что gpu-icon.svg — одноцветная маска. Размер ячейки ≈ по гриду (546/10 ≈ 52px шаг, иконка 42×21 центрирована).

## 3. Колонка «УБЕЖИЩЕ ЧВК» (196px) — навык + учёт топлива
- **Навык «Управление убежищем»**: арт-иконка 36px (`SKILL_ICONS.HideoutManagement`, rounded-[3px], рамка) + подпись «Управление убежищем» (10px, 2 строки) + справа степперы **[−] {level} [+]** (число 24px `text-text-primary`; кнопки 16px `bg-lines-hover rounded-[2px]` с ±иконкой). Диапазон 0–51.
- Подпись под навыком (12px, `text-text-muted`, центр): «Уменьшает расход топлива (до −25% на 50 ур.) На скорость добычи не влияет.»
- Микро-лейбл «УЧЕТ ТОПЛИВА» + линия.
- Ряд `flex gap-[14px]`: **3 ячейки 56×56 `rounded-[4px]`**:
  - **[Нет топлива]** — иконка «канистра-перечёркнута» (lucide `Fuel` перечёркнутая / `Ban`, или Figma-ассет No_Gasoline). Выбор = fuelEnabled=false.
  - **[Expeditionary]** — EFT item-cell (рарити-градиент фон + `itemIconUrl` бака `5d1b371186f774253763a656`) + бейдж-галка 16px внизу-справа.
  - **[Metal]** — item-cell бака `5d1b36a186f7742523398433` + бейдж.
  - **Один активен**: `border-(--primary)` + `bg-(--primary)/10` + amber бейдж-галка. Неактивные: `border-lines-hover`; недоступный — `opacity-25`.
  - Выбор бака = tank + fuelEnabled=true; «Нет топлива» = fuelEnabled=false.

## 4. Колонка «ПРОДАЖА BITCOIN» (128px)
- Микро-лейбл «ПРОДАЖА BITCOIN» + линия.
- Карточка Physical Bitcoin: `h-[128px] rounded-[4px]` EFT item-cell, фиолетовый рарити-градиент (`#4C2A55/0.3`), крупная иконка Bitcoin (`itemIconUrl('59faff1d86f7746c51718c9c')`), inset-shadow.
- Ряд снизу: аватар Терапевта 28px (`rounded-[2.333px]`, trader avatar Therapist) + цена «488 829 ₽» (18px, `text-text-primary`, `font-blender-medium`) + знак ₽. Цена = `prices.btcTherapist`.

## 5. Токены (get_variable_defs → NIGHTFALL)
`#54545C`→`text-text-muted` · `#313135`→`lines-hover` · `#E68E25`→`--primary`/`tactical-amber` · `#9696A1`→`text-secondary` · `#242426`→`card-menu` · `#F2F2F2`→`text-primary` · `#141416`→base. Шрифт Blender Pro Medium → `font-blender-medium uppercase tracking-widest`. Радиусы 2→`rounded-xs`, 4→`rounded`. НЕ хардкодить HEX; `bg-(--token)` не `bg-[var()]`.

## 6. Переиспользование
`stationIconClass`, `SKILL_ICONS`, `itemIconUrl`, `getTarkovBackgroundColor`, `computeBtcEconomy`+`slotsForLevel`/`FUEL_TANKS` (lib), профиль-сторы (useHideoutStore/usePlayerStore/usePmcStatsStore/useManualProfileStore + `resolveSkillLevel`/`editionFloor`), EFT item-cell облик (см. TrackCell/RecipeCard), trader avatar (как в RecipeCard/quest-чипах).

## 7. Разбивка
Один таск (T1): рерайт секции конфигуратора в `BitcoinProfitClient.tsx` + при необходимости прокинуть иконочные id/URL из `page.tsx` (Bitcoin/баки/аватар). Зона `src/app/eft/progress/hideout/bitcoin-profit/`.

## 8. Скоуп / не трогаем
Герой-вердикт, шкала GPU, грид метрик, блок «что нужно» — остаются, кормятся тем же `eco`. Расчёт-lib без изменений. venue упрощается до Терапевта (btcTherapist), флиа-путь из UI убираем.

## 9. Допущения
- Грид 10×5=50 (из макета). Клик-ввод GPU, авто-level.
- Учёт топлива = 3-way single-select; в макете местами no-fuel+бак оба амбер — трактую как single-select, **сверить живьём с V4DYA**.
- Иконка No_Gasoline — lucide-замена, если Figma-ассет не тянем; gpu-icon.svg — как маска.
