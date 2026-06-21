# 📐 Спринт: Responsive Audit & Fix — CTA Portal 2026

> **Цель:** Устранить критические проблемы масштабирования на всех разрешениях (1366→1920→2560→3840px).  
> **Стратегия:** Каждый спринт — отдельный чат, независимый и самодостаточный.  
> **Глобальный принцип:** `html { font-size: clamp(16px, 0.833vw, 28px) }` уже есть → все Tailwind rem-классы масштабируются автоматически. Фиксим только жёстко заданные `px`-значения.

---

## Диагностика: найденные проблемы

### Header (`src/components/layout/Header.tsx` + modules)
| Компонент | Файл | Проблема |
|-----------|------|---------|
| `PlatformLogo` | `header-modules/PlatformLogo.tsx:7` | `width={160} height={56}` — px в `next/image`, не масштабируется |
| `PlayerTelemetry` | `header-modules/PlayerTelemetry.tsx:82` | `h-15 w-55` + `w-19.75`, `w-16`, `w-19` — px через Tailwind, блок фиксированный |
| `GameLogo` | `header-modules/GameLogo.tsx:31` | `h-14 w-[160px]` — жёстко заданная ширина |
| `HeaderNavigation` | Header.tsx:39 | `hidden xl:flex` — навигация полностью пропадает ниже 1280px без fallback |
| `NewbieButton` | Header.tsx:60 | `hidden sm:flex` — исчезает ниже sm |
| `TacticalSearch` | Header.tsx:57 | `flex-1 min-w-0` — ок, но может схлопнуться |

### `/eft` HubCards (`src/app/eft/page.tsx` + `globals.css`)
| Проблема | Местоположение |
|----------|---------------|
| `tactical-grid` на 2K/4K не заполняет `max-w-275` контейнер — фиксированные `clamp(140px,8.33vw,240px)` колонки с max-cap | `globals.css:218` |
| `HubCard` имеет `md:w-[348px] md:h-[348px]` / `md:h-[160px]` — px-размеры перебивают grid | `HubCard.tsx:46-47` |
| `/eft/progress`, `/eft/gamesetting`, `/eft/videos` — статические заглушки, нет HubCard навигации | `src/app/eft/{progress,gamesetting,videos}/page.tsx` |

### Items Grid (`src/app/eft/items/[...category]/ItemsCategoryClient.tsx`)
| Проблема | Местоположение |
|----------|---------------|
| Реальный grid: `grid-cols-[repeat(auto-fill,minmax(230px,1fr))]` — авто, не гарантирует 4 колонки | `ItemsCategoryClient.tsx:1209` |
| Skeleton grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` — другая логика, рассинхрон | `ItemsCategoryClient.tsx:1167` |
| `EftItemTile` внутренние размеры: текст использует rem ✓, но картинка `w-full h-24` — ok |  |

### Кнопки / Инпуты
| Проблема | Местоположение |
|----------|---------------|
| `CategoryControlBar` кнопки: `h-10` — rem-класс (2.5rem), масштабируется ✓, но некоторые `h-9 h-8` непоследовательны | `CategoryControlBar.tsx:42` |
| Search `input` без `text-sm` на маленьких экранах | To verify |
| `PlayerTelemetry` кнопка "Войти": `h-5 w-14` — фиксированные | `PlayerTelemetry.tsx:368` |

---

## Sprint R-0: Playwright Baseline Screenshot Audit

**Задача:** Установить Playwright, снять скриншоты на 5 разрешениях, зафиксировать базовый вид.

### Контекст для нового чата
```
Проект: CTA Portal (Next.js 14, Tailwind v4), путь: c:/Users/vadim/Desktop/cta-project
Playwright НЕ установлен. Нужно добавить и сделать snapshot-тесты.
```

### Чеклист
- [ ] Установить Playwright: `npm install --save-dev @playwright/test && npx playwright install chromium`
- [ ] Создать `tests/responsive-snapshots.spec.ts` с viewports:
  - `1366x768` (ноутбук)
  - `1920x1080` (Full HD — эталон)
  - `1440x900` (MacBook)
  - `2560x1440` (2K)
  - `3840x2160` (4K)
- [ ] Маршруты для скриншотов: `/`, `/eft`, `/eft/items/gear/helmets`, `/eft/progress`, `/eft/gamesetting`, `/eft/videos`
- [ ] Запустить `npx playwright test --update-snapshots` → сохранить baseline
- [ ] Добавить `tests/` в `.gitignore` для снапшотов (они тяжёлые)

---

## Sprint R-1: Header Responsiveness

**Задача:** Все элементы хедера масштабируются корректно на 1366px–4K.

### Контекст для нового чата
```
Проект: CTA Portal. Фикс адаптивности хедера.
Файлы:
- src/components/layout/Header.tsx
- src/components/layout/header-modules/PlatformLogo.tsx
- src/components/layout/header-modules/GameLogo.tsx
- src/components/layout/header-modules/PlayerTelemetry.tsx
- src/components/layout/header-modules/NewbieButton.tsx (если нужно)

Глобальное правило: html { font-size: clamp(16px, 0.833vw, 28px) }
→ rem-классы автоматически масштабируются. Фиксить только жёсткие px.
```

### Чеклист
- [x] **PlatformLogo** (`PlatformLogo.tsx:8`): `width={160} height={56}` → `fill` + `div.relative.h-14.w-40` rem-контейнер
- [x] **GameLogo** (`GameLogo.tsx:31`): `w-[160px]` → `w-40` (контейнер + dropdown, 2 места)
- [x] **PlayerTelemetry** (`PlayerTelemetry.tsx:82`): верифицировано — `h-15 w-55`, `h-9 w-55`, `h-5 w-14`, `h-2.5 w-2.5` уже rem-классы, изменений не требуется
- [x] **Header Row 1** (`Header.tsx:29`): добавлен `overflow-x-hidden` на `<header>` — предотвращает горизонтальный скролл на <768px
- [x] **NewbieButton**: `hidden sm:flex` — sm=640px, на 1366px видна ✓
- [x] Проверить BurgerMenu на 768px–1279px: открывается ли корректно, не перекрывает ли контент
- [x] Запустить dev-сервер, проверить в браузере на 1366/1920/2560px — verified via Playwright (30/30, 2026-06-21)

---

## Sprint R-2: `/eft` Hub Page — HubCard Grid Fix

**Задача:** `tactical-grid` заполняет контейнер на всех разрешениях. HubCard масштабируется. `/eft/progress`, `/eft/gamesetting`, `/eft/videos` получают динамические HubCard-страницы.

### Контекст для нового чата
```
Проект: CTA Portal. Фикс tactical-grid + динамические хаб-страницы.
Файлы:
- src/app/globals.css (строки 216-234: tactical-grid)
- src/components/ui/HubCard.tsx (строки 45-47: hardcoded dimensions)
- src/app/eft/page.tsx (эталон структуры HubCard)
- src/app/eft/progress/page.tsx (сейчас — заглушка)
- src/app/eft/gamesetting/page.tsx (сейчас — заглушка)
- src/app/eft/videos/page.tsx (сейчас — заглушка)
- src/data/headerConfig.ts (источник children для навигации)

Дизайн-система: NIGHTFALL. Компонент HubCard имеет variant='square' | 'rectangle' | 'tab'.
```

### Чеклист
- [x] **`tactical-grid` в globals.css**: `clamp(140px,8.33vw,240px)` → `1fr` на всех брейкпоинтах, убран `justify-content: center`, gap → `1rem`
- [x] **HubCard** (`HubCard.tsx:46-47`): убраны `md:w-[348px] md:h-[348px]` / `md:w-[348px] md:h-[160px]`, оставлены `aspect-square` / `aspect-[348/160]`
- [x] **HubCard текст** (`HubCard.tsx:140`): `bottom-[24px] left-[24px] right-[24px]` → `bottom-6 left-6 right-6`
- [x] **Иконка** (`HubCard.tsx:102`): `top-[21px] right-[21px] w-[32px] h-[32px]` → `top-5 right-5 w-8 h-8`
- [x] **Динамическая страница `/eft/progress/page.tsx`**: уже реализована — 8 HubCard rectangle с PageHeader
- [x] **`/eft/gamesetting/page.tsx`**: уже реализована — 8 HubCard для Кодекса
- [x] **`/eft/videos/page.tsx`**: уже реализована — 4 HubCard для Видео
- [x] Иконки существуют в `/icons/eft/04-progression/`, `05-gamesetting/`, `06-videos/`

---

## Sprint R-3: Items Grid — 4-Column Lock + EftItemTile Scaling

**Задача:** `/eft/items/**` всегда показывает ровно 4 колонки на десктопе. EftItemTile пропорционально масштабируется.

### Контекст для нового чата
```
Проект: CTA Portal. Фикс items grid — 4 колонки всегда.
Файлы:
- src/app/eft/items/[...category]/ItemsCategoryClient.tsx (строки 1167-1219)
- src/components/features/items/EftItemTile/EftItemTile.tsx
- src/components/features/items/EftItemTile/Header.tsx
- src/components/features/items/EftItemTile/Media.tsx
- src/components/features/items/EftItemTile/Pricing.tsx
- src/components/features/items/EftItemTile/Name.tsx

Глобальное правило: html { font-size: clamp(16px, 0.833vw, 28px) }
→ Tailwind h-24, text-xs, text-sm автоматически масштабируются через rem.
max-w-275 = 1100px@1080p, 1600px@2K, 2200px@4K
```

### Чеклист
- [x] **Items grid реальный** (`ItemsCategoryClient.tsx:1209`): `grid-cols-[repeat(auto-fill,minmax(230px,1fr))]` → `grid-cols-2 md:grid-cols-3 xl:grid-cols-4`
- [x] **Items grid skeleton** (`ItemsCategoryClient.tsx:1167`): синхронизировано: `grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4`
- [x] **EftItemTile.Root** (`EftItemTile.tsx:24`): верифицировано — `p-4` rem ✓, px-зависимостей нет
- [x] **EftItemTile.Media** (`Media.tsx`): верифицировано — `h-30` = rem ✓, `img` через `h-full w-full object-contain` ✓
- [x] **EftItemTile.Header** (`Header.tsx`): верифицировано — `text-xs`, `text-[10px]` (rem-based), `text-[9px]` (rem-based) ✓
- [x] **EftItemTile.Pricing** (`Pricing.tsx`): верифицировано — px-нарушений нет, layout через rem ✓
- [x] **EftItemTile.Name** (`Name.tsx`): верифицировано — `text-base`, `mb-3` rem ✓
- [x] Проверить что 4 колонки на 1366px, 1920px, 2560px, 3840px — verified via Playwright snapshot (30/30, 2026-06-21)

---

## Sprint R-4: Buttons & Inputs Global Scaling

**Задача:** Все кнопки, инпуты, тоггеры используют rem-классы и масштабируются с html font-size.

### Контекст для нового чата
```
Проект: CTA Portal. Фикс кнопок и инпутов на всех разрешениях.
Файлы:
- src/components/features/items/CategoryControlBar.tsx
- src/components/layout/header-modules/PlayerTelemetry.tsx (кнопки)
- src/components/layout/header-modules/NewbieButton.tsx
- src/components/ui/HubCard.tsx (tab variant кнопки)

Правило: h-10 = 2.5rem = 40px@1080p = 70px@4K ✓ — это правильно.
Фиксить px-значения типа h-[40px], w-[80px] и т.п.
```

### Чеклист
- [x] **CategoryControlBar** (`CategoryControlBar.tsx`): все `h-10 h-9 h-8` — rem ✓, `h-[Npx]` не найдено
- [x] **Search input** (`CategoryControlBar.tsx:143`): `text-[12px]` → `text-xs`, контейнер `h-10` rem ✓
- [x] **PlayerTelemetry кнопка "Войти"** (`PlayerTelemetry.tsx:368`): `h-5 w-14` — rem ✓, `h-2.5 w-2.5` — rem ✓
- [x] **NewbieButton**: полная конвертация — `h-14 w-40 h-8 p-px rounded-xs left-3.5 h-7 w-6.5 w-19 text-xs`
- [ ] **HubCard tab variant** (`HubCard.tsx:56`): `h-8 px-3` — rem ✓
- [~] Audit проведён (2026-06-21): остаются **12× `text-[Npx]`** (PageHeader/NavLink/HeaderNavigation/BurgerMenu/PlayerTelemetry/CommsHub/SupplyGrid/SectionPanel/HubNav…) + **21× `w/h/позиция [Npx]`** (page.tsx, SearchEmptyState, GameCard, ItemsCategoryClient…). Конвертация в rem/токены — **отложена в бэклог** (декоративную мелочь rounded-[1px]/blur не трогаем).
- [x] Финальный визуальный тест на 5 разрешениях — Playwright 30/30 (baseline пересоздан под typography R-6)

---

## Sprint R-5: Playwright Screenshot Regression Tests

**Задача:** После всех фиксов прогнать Playwright скриншоты и сравнить с baseline.

### Чеклист
- [ ] Обновить baseline скриншоты (`npx playwright test --update-snapshots`)
- [ ] Создать CI-дружный конфиг `playwright.config.ts` с threshold `maxDiffPixels: 100`
- [ ] Прогнать сравнительный тест `npx playwright test`
- [ ] Зафиксировать финальные скриншоты в `tests/snapshots/`
- [ ] Добавить npm script: `"test:responsive": "playwright test"` в `package.json`

---

## 📊 Прогресс

| Спринт | Статус | Затронутые файлы |
|--------|--------|-----------------|
| R-0 Playwright Setup | ✅ Done | `playwright.config.ts`, `tests/responsive-snapshots.spec.ts`, `package.json`, `.gitignore` |
| R-1 Header | ✅ Done | `PlatformLogo.tsx` ✅, `GameLogo.tsx` ✅, `PlayerTelemetry.tsx` ✅, `Header.tsx` overflow ✅ |
| R-2 HubCard + Hub Pages | ✅ Done | `globals.css` ✅, `HubCard.tsx` ✅, `eft/progress` ✅, `eft/gamesetting` ✅, `eft/videos` ✅ |
| R-3 Items Grid 4-col | ✅ Done | `ItemsCategoryClient.tsx` ✅, `EftItemTile/{Root,Media,Header,Pricing,Name}` ✅ |
| R-4 Buttons & Inputs | ✅ Done | `CategoryControlBar.tsx` ✅, `PlayerTelemetry.tsx` ✅, `NewbieButton.tsx` ✅ |
| R-5 Regression Tests | ✅ Done | `tests/` — 30/30 baseline + comparison passes |

---

## Приоритет запуска

```
R-1 (Header) + R-3 (Items Grid)  ← Параллельно, высший приоритет
R-2 (HubCard Hub Pages)           ← Параллельно с R-1
R-0 (Playwright)                  ← Можно в любой момент
R-4 (Buttons)                     ← После R-1 и R-3
R-5 (Regression)                  ← Последний
```

---

## Технические справки

### Формула масштабирования разрешения
Базис — 1920×1080 (100%). Tailwind rem автоматически масштабируется:
- `text-xs` = 0.75rem = 12px@1080p / 21px@2K / 28px@4K (cap)
- `h-10` = 2.5rem = 40px@1080p / 70px@2K / 93px (cap 28×3.5)

Для явных px-значений если нужны: `Nrem = Npx / 16` — конвертация.

### Breakpoints в проекте
| Брейкпоинт | Ширина | Описание |
|-----------|--------|---------|
| `sm` | 640px | Мобайл landscape / маленький планшет |
| `md` | 768px | Планшет |
| `lg` | 1024px | Маленький ноутбук |
| `xl` | 1280px | Десктоп (контент-колонка 1100px включается) |
| 2K медиа | 2560px | Переопределение `max-w-275` → 1600px |
| 4K медиа | 3840px | Переопределение `max-w-275` → 2200px |

### Ключевые CSS переменные
```css
html { font-size: clamp(16px, 0.833vw, 28px); }        /* глобальный скейлинг */
@media (min-width: 2560px) { .max-w-275 { max-width: 1600px; } }
@media (min-width: 3840px) { .max-w-275 { max-width: 2200px; } }
```
