# Sprint R-6 — Fluid Typography Scale + Styleguide

**Цель:** Ввести 9-шаговую fluid `--type-*` шкалу, ликвидировать все нарушения минимального
размера текста (8–9px → минимум 12px), мигрировать 10–13px на токены, добавить токены
контентной сетки и создать живую страницу-эталон `/eft/styleguide`.

**Контекст:** Root `font-size: clamp(16px, 0.833vw, 28px)` уже масштабирует rem на 2K/4K.
Токены используют rem, поэтому на 4K caption (~14px на 1920) вырастает до ~24px — как и задумано.

---

## Прогресс

### Phase 0 — Sprint tracker
- [x] Создан этот файл

### Phase 1 — globals.css foundation ✅ DONE
- [x] Добавить `--type-display` → `--type-caption` в `:root`
- [x] Добавить `--grid-max`, `--grid-col`, `--grid-gap` в `:root`
- [x] Добавить `.text-type-*` utilities в `@layer utilities`
- [x] Обновить `.hub-heading` / `.hub-description` на токены

### Phase 2 — Критические нарушения ✅ DONE (21×8px + 78×9px заменены)

Минимальный результат: 12px (0.75rem × 16px base), на 1920px = 14px, на 4K ~24px

#### App pages
- [x] `src/app/account/AccountCenter.tsx` (~5 строк)
- [x] `src/app/account/AccountHeader.tsx` (1 строка)
- [x] `src/app/eft/barters/BartersClient.tsx` (4 строки)
- [x] `src/app/eft/items/item/[slug]/ItemPriceBlock.tsx` (1 строка)
- [x] `src/app/eft/items/loot-rate/LootRateClient.tsx` (3 строки — есть 8px!)
- [x] `src/app/eft/items/[...category]/ItemsCategoryClient.tsx` (4 строки — есть 8px!)
- [x] `src/app/eft/progress/tracker/ItemTrackerClient.tsx` (4 строки)

#### Feature/barter
- [x] `src/components/features/barter/ProMetaProgress.tsx`
- [x] `src/components/features/barter/StashGrid.tsx` (8px!)
- [x] `src/components/features/barter/StashItemTile.tsx` (8px!)
- [x] `src/components/features/barter/StashItemTooltip.tsx`
- [x] `src/components/features/barter/StashSummary.tsx`
- [x] `src/components/features/barter/StatsDashboard.tsx`

#### Feature/home
- [x] `src/components/features/home/ActiveContextBar.tsx`
- [x] `src/components/features/home/CommsHub.tsx` (есть 8px!)
- [x] `src/components/features/home/SupplyGrid.tsx`
- [x] `src/components/features/home/TacticalCartographyClient.tsx` (11 вхождений!)
- [x] `src/components/features/home/TraderCountdown.tsx`

#### Feature/items
- [x] `src/components/features/items/CategoryControlBar.tsx`
- [x] `src/components/features/items/CompareDrawer.tsx`
- [x] `src/components/features/items/EftItemTile/Header.tsx`
- [x] `src/components/features/items/EftItemTile/Pricing.tsx`
- [x] `src/components/features/items/EftItemTile/tooltips/BarterTooltip.tsx`
- [x] `src/components/features/items/EftItemTile/tooltips/CraftTooltip.tsx`
- [x] `src/components/features/items/EftItemTile/tooltips/QuestTooltip.tsx`
- [x] `src/components/features/items/FavoritesStrip.tsx`
- [x] `src/components/features/items/ItemTile.tsx` (есть 8px!)

#### Feature/quests + layout
- [x] `src/components/features/quests/QuestDrawer/index.tsx` (есть 8px!)
- [x] `src/components/features/quests/QuestFilterBar/index.tsx` (8px!)
- [x] `src/components/features/quests/QuestItemTracker/index.tsx`
- [x] `src/components/features/quests/QuestNode/index.tsx`
- [x] `src/components/features/quests/QuestStatusBar/index.tsx` (8px!)
- [x] `src/components/layout/Footer.tsx` (11 вхождений — есть 8px!)
- [x] `src/components/layout/header-modules/PlayerTelemetry.tsx` (6 — все 8px!)
- [x] `src/components/layout/header-modules/ProfileSettingsModal.tsx` (есть 8px!)

### Phase 3 — Миграция 10–13px ✅ DONE (136×10px + 35×11px + 9×12px + 9×13px)

| Было | Стало |
|------|-------|
| `text-[10px]` | `text-type-caption` |
| `text-[11px]` | `text-type-caption` |
| `text-[12px]` | `text-type-label` |
| `text-[13px]` | `text-type-label` |

- [x] AccountCenter, BartersClient, ItemModules, ItemActions
- [x] ItemsCategoryClient, LootRateClient, SlotGrid
- [x] Прочие файлы с `text-[10-13px]`

### Phase 5 — Styleguide page `/eft/styleguide` ✅ DONE
- [x] `src/app/eft/styleguide/page.tsx` — Server Component + Client island
  - Таблица шкалы (9 уровней с живым рендером)
  - Счётчик viewport / band (mobile/tablet/desktop/2K/4K)
  - Визуализация 6-кол. сетки 1100px + таблица span-ширин

### Phase 6 — Верификация ✅ DONE (npm run build — 25 routes, 0 errors)
- [x] `npm run build` — нет ошибок TS
- [x] Проверка 320px — нет текста <10px
- [x] Проверка 1280px — нет текста <12px
- [x] Проверка 1920px — caption ~14px, body ~17px
- [x] Styleguide page работает и live counter обновляется

---

## Токены (справка)

```
--type-display:  clamp(2rem,      1.6rem   + 2vw,    4rem)      /* 32→64px */
--type-h1:       clamp(1.75rem,   1.5rem   + 1.25vw, 3rem)      /* 28→48px */
--type-h2:       clamp(1.5rem,    1.35rem  + 0.75vw, 2.25rem)   /* 24→36px */
--type-h3:       clamp(1.25rem,   1.15rem  + 0.5vw,  1.75rem)   /* 20→28px */
--type-h4:       clamp(1.125rem,  1.075rem + 0.25vw, 1.375rem)  /* 18→22px */
--type-body-lg:  clamp(1rem,      0.95rem  + 0.25vw, 1.25rem)   /* 16→20px */
--type-body:     clamp(0.9375rem, 0.9rem   + 0.125vw,1.0625rem) /* 15→17px */
--type-label:    clamp(0.8125rem, 0.7875rem+0.125vw, 0.9375rem) /* 13→15px */
--type-caption:  clamp(0.75rem,   0.725rem +0.125vw, 0.875rem)  /* 12→14px */

--grid-max: 1100px  --grid-col: 160px  --grid-gap: 28px
```
