---
status: 🎨 design-spec — принято V4DYA (Figma 2026-07-31), к реализации
affects: maps, editorial-markers, marker-creation, cms, ux
date: 2026-07-31
figma: node 2374-2468 · секция «UI - Step Marker Creation control»
---

# UI — Step Marker Creation control

Переработка постановки editorial-маркера из «одной плоской карточки» в **пошаговый визард
из 4 шагов**. Дизайн/UX — V4DYA (Figma). Ориентир — имена фреймов секции. Бэкенд уже готов
(`editorial_markers`: type/category/faction/title/description/screenshots/linkKind/linkId/
linkStep), меняется только слой ввода в карточке.

## 4 шага (общий поток)
1. **Выбор категории маркера** — какого рода объект ставим (10 категорий, см. ниже).
2. **Выбор объекта/предмета/квеста** внутри категории — конкретика (поиск предмета, выбор
   врага, стационарки, вертолётного выхода и т.п.).
3. **Название и описание** — заголовок + текст маркера (+ галерея скринов).
4. **Связь** — привязка к **побочному квесту / этапу сюжетной истории / игровому событию**
   (или НЕТ СВЯЗИ). На этом шаге **маркер принимает финальный облик** (см. «морфинг»).

Внизу карточки — амбер прогресс-бар шага (04-9 → индикатор 4/4).

## Категории (Step 01) — 10 строк матрицы Figma
| # | Figma | Наш `type` | Step 02 (выбор объекта) |
|---|---|---|---|
| 01 | Default | `poi` (без категории) | — сразу к шагу 3 |
| 02 | Simple / POI | `poi` | точка интереса (point-of-interest / advice) |
| 03 | Enemy | `spawn` (враги) | Selecting → Selected (фракция врага) |
| 04 | Quest | `quest_zone` | выбор квеста/цели |
| 05 | Loot | `loot` | **Search Item** (поиск предмета) |
| 06 | Container | `container` | выбор контейнера (Safe…) |
| 07 | Interactive | `lock`/`switch` | Select → напр. Intercom Key-Card |
| 08 | Danger | `hazard` | Selecting → напр. Toxic (biohazard) |
| 09 | Exfil | `extract` | Selecting → напр. Helicopter (paidhely) |
| 10 | Spawn | `spawn` (игрок/БТР) | Selecting → напр. BTR80 |

Frame-адреса Step 01: `01 Default`, `02 Simple`, `03 Enemy`, `04 Quest`, `05 Loot`,
`06 Container`, `07 Interactive`, `08 Danger`, `09 Exfil`, `10 Spawn`.

## Шаг 2 — выбор объекта (примеры фреймов)
`05-2 Loot - Search Item` · `10-1 Spawn - Selecting` → `10-2 Spawn - BTR80` ·
`09-1 Exfil - Selecting` → `09-2 Exfil - Helicopter` · `08-1 Danger - Selecting` →
`08-2 Danger - Toxic` · `07-1 Interactive - Select` → `07-2 Intercom Key-Card` ·
`06-1 Container - Safe` · `03-1 Enemy` → `03-2 Enemy - Selected`. Записывается в
`category` (+`faction` для выходов/спавнов), как в текущем пикере.

## Шаг 3 — название и описание
`*-3 / *-4 - Input Name and Description` на каждую категорию. Поля `title` + `description`
(+ галерея скринов из шага, `screenshots`). Пустой заголовок блокирует «Далее/Сохранить».

## Шаг 4 — связь + МОРФИНГ маркера
Типы связи (Figma `Step 04 - … - Link/Linking`):
- **НЕТ СВЯЗИ** (`НЕТ СВЯЗИ`) → `linkKind='none'`.
- **Побочный квест** (`Quest - Link - Side`) → `linkKind='quest'` (side).
- **Сюжет / этап истории** (`Quest - Link - Story` / `Story Link`) → `linkKind='story'` (+`linkStep`).
- **Событие** (`Quest - Link - Event`) → **новый** `linkKind='event'`.

**⚠️ Облик маркера меняется по типу связи** (фреймы `… - Completed Marker`) — это и есть
«когда маркер принимает облик»:
| Связь | Иконка (уже заведена в icons.css / резолвер) |
|---|---|
| обычный квест | `quest-item.svg` (`.icon-eft-quest-item`) |
| побочный | `quest-item-side.svg` (`.icon-eft-quest-item-side`) |
| сюжет | `quest-item-story.svg` (`.icon-eft-quest-item-story`) |
| событие | `quest-item-event.svg` (`.icon-eft-quest-item-event`) |

Completed-фреймы: `02-7 Simple-POI`, `07-5 Interactive`, `06-5 Container`, `09-5 Exfil`,
`06-5 Danger` — показывают финальный вид пина после сохранения.

## Импликации для данных (что дозавести при реализации)
1. **`linkKind` += `'event'`** (сейчас `story|quest|none`) — плюс различие «квест vs побочный
   квест». Решить: отдельный вид или `linkKind='quest'` + флаг. Колонка `link_kind` — text,
   миграции не нужно, но обновить типы/API/резолвер `questZoneKind`/облик.
2. **Резолвер иконки** (`markerIconUrl` / `manualMarkerIcon`): для quest-маркеров выбирать
   `quest-item-{side|story|event}` по `linkKind`/`linkStep` — сейчас только `quest-item`/`quest-maker`.
3. Категории Figma ↔ наш `type` — по таблице выше (Default/Simple → `poi`; Enemy/Spawn → `spawn`).

## Иконки (проведены через icons.css, 2026-07-31)
Новые SVG из `public/icons/eft/01-maps/markers` заведены масками `.icon-eft-*`:
`default-marker`, `point-of-interest`, `advice`, `interact`, `lock-standard-security-keypad`,
`spawn`, `quest-item-side`, `quest-item-story`, `quest-item-event`, `danger-biohazard`,
`danger-electro`, `danger-flamable`, `danger-mon50`, `danger-radioactive`.
Починен путь `transition-point` (переехал в `exfil/`). На карте иконки идут полноцветным
`<img>` через `markerIconUrl` (маски — для UI визарда).

## Реализация — фазы (следующий заход)
- **Ф1.** Каркас визарда: состояние шага (1-4), навигация Далее/Назад, прогресс-бар; текущий
  контент (пикер/название/привязка) раскидать по шагам без потери логики.
- **Ф2.** Шаг 2 «выбор объекта» по категориям (Loot→поиск предмета уже есть в drawer; переиспользовать).
- **Ф3.** Шаг 4: `linkKind` event + морфинг иконки quest-маркера по типу связи.
- **Ф4.** Completed-состояние (превью финального пина) + полировка 1:1 по фреймам.

Реализовать по скиллу `/figma`, брать отдельный скрин каждого фрейма (не по памяти).
