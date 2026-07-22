---
status: 🟢 основное в main (коммит 858ea07) — хвосты ждут tarkov.dev / ручной раскладки
affects: item-detail, SlotGrid, barter, craft, container-grids, prices, SPT-autonomy, figma-skill
date: 2026-07-22
commit: 858ea07
---

# Карточка предмета: реворк + сетки вместимости (сессия 21–22.07)

Крупная сессия по карточке предмета EFT + автономным сеткам вместимости контейнеров.
Всё основное — в `main` (`858ea07`). Связано: [[container-grids-todo]] · [[autonomy-prices-research]] · [[snapshot-2026-07-21]].

## Что сделано (в main)

### Карточка предмета
- **Шапка:** название без капса `lg:text-[42px]`, `line-clamp-2`, линию убрал; чипы БАРТЕР/КРАФТ/ЗАДАНИЕ на `@theme`-токенах (kappa/mode-pve/tactical-amber), 12×12.
- **Перекомпоновка:** квесты (`Требуется`/`Вознаграждения`), блок **ТУР** и награды переехали в левую колонку; «Используется в бартере» — в правую (724). ТУР = реверс-индекс историй (`src/lib/item-story-tours.ts`, серверный, hero-баннер).
- **Баннеры квестов** из локальных `public/images/quests/eft/<id>.webp` (не CDN торговца).
- **Фон по редкости** + внутренние тени во ВСЕХ слотах (`getTarkovBackgroundColor`, `shadow-[inset…]`).
- **Экономика бартер/крафт** (`BarterOfferCard`/`CraftOfferCard`): 3-слойный фон (14/28% + чёрный), accent крафта `#9A8866`, ряд «Отдаю» без переноса на `lg` (до 7 предметов), единый подвал **Покупка/Комиссия/Продажа** (`RewardRow`), выравнивание колонок (h-9, 128/128/170px, gap 14, метрики gap-25), целочисленный GP, метрика-иконка красится по `gainMark` + метка 50%, бейдж лояльности поверх аватара, часы lucide, обводка счётчика, «Используется в бартере» на новую карточку (+ вычищен мёртвый код `ReqItem`/`accentCardStyle`/`QuestGateBadge`).
- **Курс USD/EUR** = рыночная цена предметов Доллары/Евро (`getCurrencyRates`, не внутренний курс торговца) + показывается только валюта, в которой предмет реально торгуется.

### Сетки вместимости (автономно, без tarkov.dev)
- **SPT-пайплайн:** `scripts/dump-container-grids-spt.mjs` (локальный `D:\Games\SPT` → LFS-фолбэк) тянет `grids{cellsH,cellsV,filters}` → патчит `items_database.json` → ETL. Закрыл сетки + блок «Вмещает» (`ContainerContents.tsx`) для ~240 предметов. Фикс: `ItemPropertiesChestRig` теперь пробрасывает `grids` (56 разгрузок «не показывали»).
- **`SlotGrid`:** ячейки как в игре — фон `#000`, линии/контур `#242426`, фикс 6px; «Сетка предмета» оранжевая, «Вместимость» чёрная.
- **72 игровые раскладки** мульти-секционных (рюкзаки/разгрузки) собраны через **Figma layout-capture** (страница «Grid Layouts (WIP)» в файле `Z1c9wK3AtqBrBhSwNt8qZz`) → `src/data/container-grid-layouts.json`.
- **27 ручных оверрайдов** одиночных контейнеров (17 заполнено), список: [[container-grids-todo]].

## Ключевые решения / грабли (не наступать снова)
- **Раскладка секций = АБСОЛЮТНЫЕ ПИКСЕЛИ, не клетки.** Округление к клеткам ломает под-клеточные зазоры (4px). Масштаб Figma = сайта (клетка 6px, PITCH 7).
- **Зазоры между отсеками — прозрачные** (не заливать фон композиции в цвет линий); конвенция раскладки: зазор ≥4px в Figma.
- Читать Figma-секции через `findAll`+`absoluteBoundingBox` (переживает группировку).
- `#9A8866` в ДС = «Tactical PvP» (= `--color-mode-pvp`).
- Паттерн Figma-захвата записан в скилл `figma` (Часть B) — локально.

## Хвосты / следующий чат
1. **Ждёт tarkov.dev (лежит с ~21.07, вероятно до сезонного патча BSG):** живые цены барахолки, `min_level_for_flea` (гексагоны), re-dump квестов с реальными картинками. Механика готова, нужен только подъём API. См. [[autonomy-prices-research]].
2. **10 пустых оверрайдов** контейнеров — заполнить `grids` в `src/data/container-grid-overrides.json` → прогнать `dump-container-grids-spt.mjs` + `tsx scripts/etl-items.ts`.
3. **Свериться в dev** после рестарта: 72 раскладки, карточка предмета целиком.
4. Возможные докрутки по виду (толщина линий/разделителей, шапка-чипы цвета) — по месту.

## Ключевые файлы
- UI: `src/app/eft/items/item/[slug]/` (SlotGrid, BarterOfferCard, CraftOfferCard, QuestCard, ItemStoryTours, ContainerContents, ItemDetailLayout, page.tsx, ItemModules)
- Данные: `src/data/container-grid-layouts.json` (px-раскладки), `container-grid-overrides.json`, `public/images/items/eft/items_database.json`
- Скрипты: `scripts/dump-container-grids-spt.mjs`, `dump-container-grids.mjs`
- Прочее: `src/db/prices.ts` (курс), `src/lib/item-story-tours.ts`
- Локально (НЕ в git): скилл `.claude/skills/game-asset-extraction` + `figma` (обновлены), авто-память `[[autonomy-prices-research]]`
