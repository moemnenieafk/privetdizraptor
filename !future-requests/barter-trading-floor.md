> **Статус:** отложено (бэкенд-сессия в приоритете). План **утверждён** 2026-06-23, реализовать позже.
> Базовый редизайн бартера (вердикт-карточка, ранги, эффекты, звук, аккаунт-синк) уже в `main` (`25e1f89`).
> Это **следующий заход** — пул бартеров / торговая площадка.

# «Торговая площадка» — игровой редизайн /eft/progress/barter (пул бартеров)

## Context

Сейчас бартер выбирается через поиск-дропдаун (`BarterTradeSelector`) — это «поисковик», а не игра. Следующий шаг — превратить страницу в **живую торговую площадку**: видимое игровое поле, где игрок охотится за выгодными сделками.

**Решения пользователя (подтверждено):**
- Раскладка: **тикер сверху** (бегущая строка хот-сделок) + **слева пул бартеров** (кликабельный список) + **справа верстак сделки** (схрон+вердикт) + геймификация на всю ширину снизу.
- Подсветка выгодности: **цветной акцент + тинт фона + бейдж ₽/ROI + сортировка по профиту**.
- Поиск **растворяется в фильтр пула** (`BarterTradeSelector` удаляется).
- «Инвентарь» справа = **верстак сделки** (клик по бартеру → схрон авто-заполняется его требуемыми, показывается вердикт; ручной добавляющий поиск остаётся).
- Локнутые бартеры (квест-гейт / уровень торговца выше твоего): **показывать, пригасив + значок 🔒/LL**.
- Карточка пула: **компактная строка ~72px**.

## Раскладка
```
PageHeader · [SyncIndicator] [MuteToggle]
▸ РЫНОК: Прапор·Болты +12.4К · Скиф·Сахар +8К …   ← MarketTicker (клик выбирает, пауза на ховер)
┌── ПУЛ БАРТЕРОВ (lg:w-96) ──┬── ВЕРСТАК (flex-1) ───┐
│ [поиск][торговец][выгодные]│ [поиск предмета]      │
│ 🟢▐ 👤Прапор LL2 📦×5 +12.4К│  ▦▦▦▦▦ (StashGrid)    │
│ ⚪▐ 👤Механик   📦×1  +120 │                        │
│ 🔴▐ 👤Скиф LL3🔒 📦×3 −2.1К│  ╔ ВЕРДИКТ ═══════════╗ │
│ … (virtualized, сорт ↓₽)  │  ║ ВЫГОДНЫЙ +10 724 ₽ ║ │
│                            │  [▲ Зафиксировать]    │
└────────────────────────────┴────────────────────────┘
ТОРГОВЫЙ ПУТЬ · ранг/серия/горизонт · PRO   (на всю ширину)
```

## Новые файлы
- `src/lib/barter-pool.ts` — чистые хелперы:
  - `calcBarterProfitStandalone(barter)` → `BarterCalculation` **без схрона**, напрямую из `barter.requiredItems[].item.sellFor` (cost = min флии/трейдера) и `rewardItems[].item.sellFor`+`basePrice` (как `calcBarterProfit`, реплика логики `buildStashItem`/`getBestSellRub`). Данных в текущем GraphQL **достаточно** — менять `page.tsx` не нужно.
  - `isBarterLocked(barter, traderLevels, completedQuests)` → `{ locked, reason: 'level'|'quest'|null }`. LL-лок: `traderLevels[normalizedName] < barter.level` (только если профиль с уровнями задан, иначе не локаем). Квест-лок: `barter.taskUnlock && !completedQuests.includes(barter.taskUnlock.id)`.
  - `buildBarterPool(barters, traderLevels, completedQuests)` → `PoolEntry[] = {barter, calc, lock}` отсортированный по `calc.netProfit` ↓.
- `src/hooks/useBarterPool.ts` — `useBarterPool(initialBarters)`: читает `usePlayerStore` (активный профиль `traderLevels`) + `useQuestStore` (`completedQuests`), `useMemo` → `PoolEntry[]`. Зовётся 1 раз в `BarterPageClient`, передаётся в тикер и пул.
- `src/components/features/barter/MarketTicker.tsx` — бегущая строка топ-выгодных (зелёных) сделок. Зеркалит `ActiveContextBar` (дублирование `[...arr,...arr]` + `animate-[ticker-scroll_Ns_linear_infinite]`), добавить **паузу на ховер** (`hover:[animation-play-state:paused]`) для клика → `selectBarter`.
- `src/components/features/barter/BarterPool.tsx` — левая панель: sticky control-bar (поиск + селект торговца + тумблер «только выгодные» + статы «выгодных N/M») + виртуализированный список. Локальный стейт фильтров; применяет к `PoolEntry[]`. Виртуализация — паттерн `BartersClient`/`ItemsTable` (`useVirtualizer`, `estimateSize ~72`, `overscan 8`), контейнер с bounded-height + `overflow-y-auto`.
- `src/components/features/barter/BarterPoolRow.tsx` — компактная строка: статус-акцент (левая планка) + тинт фона по `calc.verdict`, `traderImg(normalizedName)` + `barter.trader.name` + LL, иконка награды ×count, чистый ₽ (цвет) + ROI. Локнутые: `opacity-45` + 🔒/`LL{n}`. Выбранная (`=== selectedBarter?.id`): усиленная рамка+glow. Клик → `selectBarter(barter)` (+ звук `tick`).

## Изменяемые файлы
- `src/app/eft/progress/barter/BarterPageClient.tsx` — реструктура: `PageHeader` → toolbar → `<MarketTicker pool>` → двухколоночный блок (`flex flex-col gap-6 lg:flex-row`: левая `lg:w-96 lg:shrink-0` = `<BarterPool pool>`, правая `flex-1 min-w-0` = верстак: `BarterSearchBar` + `StashGrid` + `StashSummary`(VerdictCard) + кнопка фиксации + floatXp + баннер ранг-апа) → `StatsDashboard` + `ProMetaProgress` на всю ширину. Удалить импорт/использование `BarterTradeSelector`. Деал-флоу (`handleConfirmDeal`, эффекты, звук) — без изменений.
- `src/types/barter.ts` — добавить тип `PoolEntry { barter: BarterTrade; calc: BarterCalculation; lock: { locked: boolean; reason: 'level'|'quest'|null } }`.

## Удаление
- `src/components/features/barter/BarterTradeSelector.tsx` — растворён в фильтр пула (используется только в `BarterPageClient`). Удалить файл + импорт.

## Переиспользование (существующее — НЕ изобретать)
- Профит-логика: реплика `calcBarterProfit`/`buildStashItem`/`getBestSellRub` (`src/lib/barter-calc.ts`, `src/store/useBarterStore.ts`).
- Клик→выбор: `useBarterStore.selectBarter(trade)` (уже авто-заполняет схрон).
- Виртуализация: `src/app/eft/barters/BartersClient.tsx`, `src/components/features/items/ItemsTable.tsx`.
- Тикер: `src/components/features/home/ActiveContextBar.tsx` + keyframe `ticker-scroll` (`globals.css`).
- Control-bar (поиск/селект/тумблер/статы): паттерн `BartersClient.tsx`.
- Двухколоночная адаптивная раскладка: `src/app/eft/items/item/[slug]/ItemDetailLayout.tsx` (`lg:flex-row`, левая `lg:w-87 lg:shrink-0`).
- Хелперы: `traderImg`/`traderCssVar` (`src/lib/trader-utils.ts`), `getTarkovBackgroundColor` (`src/lib/tarkov-colors.ts`), `formatRub`/`formatCompactRub` (`barter-calc.ts`). Имя торговца — `barter.trader.name` (уже ru из query, `TRADER_NAMES` не нужен).
- Профиль/квесты: `usePlayerStore` (активный профиль, `traderLevels`), `useQuestStore` (`completedQuests`).

## Адаптив
- `lg+`: пул слева (`w-96`, bounded-height + внутренний скролл) | верстак справа (`flex-1`, схрон уже `overflow-x-auto`).
- `<lg`: стек — тикер, затем пул (capped height со своим скроллом), затем верстак, затем геймификация.

## Verification
- `npx tsc --noEmit` → 0 ошибок (`any` запрещён).
- Dev (`/eft/progress/barter`): пул рендерится отсортированным по профиту, зелёные сверху; тикер крутится и на ховере встаёт.
- Клик по строке пула / тикеру → схрон справа заполняется, вердикт совпадает с бейджем строки; выбранная строка подсвечена.
- Фиксация из пула → звук + «+XP» + обновление ранга (деал-флоу не сломан).
- Локнутый бартер (уровень торговца ниже / незакрытый квест из профиля) — пригашен с 🔒/LL; при отсутствии профиля LL-локов нет.
- Фильтры: поиск по торговцу/награде, селект торговца, «только выгодные», статы N/M.
- Виртуализация плавная на полном списке; адаптив: на узком экране колонки стекаются.

## Заметки
- Источник цен — тот же tarkov.dev-запрос страницы (консистентно с её VerdictCard); от `/eft/barters` (DB-mirror) не зависим.
- Ручной режим схрона (BarterSearchBar + арбитраж) сохраняется в верстаке, когда бартер не выбран.
