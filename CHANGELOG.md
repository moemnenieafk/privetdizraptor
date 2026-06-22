# 📜 История изменений проекта (Changelog)

Все заметные изменения в проект `cta` документируются здесь.
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

---

## [4.3.0] - 2026-06-23 — EFT-раздел полностью автономен (бартер-фича off tarkov.dev)

### ♻️ Изменено (Changed)
- **Симулятор бартера `/eft/progress/barter` переведён на наш self-mirror.** Раньше серверный `page.tsx` ходил прямыми GraphQL-запросами в `api.tarkov.dev` (`items(types:[barter])` + `barters()`). Теперь `initialItems`/`initialBarters` собираются из нашей Supabase: каталог `items` + `getEftPriceMapFromDb()` + таблица `barters`, иконки `itemIconUrl()`. Это был **последний живой рантайм-вызов tarkov.dev** в EFT-разделе. Коммит `b125c33`.
- **Хирургически:** изменён только серверный `page.tsx`. Контракт данных (`BarterSearchResult[]` / `BarterTrade[]` из `src/types/barter.ts`) сохранён 1:1 — клиент `BarterPageClient`, типы и фичекомпоненты не тронуты. Семантика цен (RUB-нормализация `priceRUB`, flea/trader-детект по `vendor.normalizedName`), уровни торговцев и `taskUnlock` перенесены без изменений.

### 🚀 Добавлено (Added)
- **Правило 11 «BACKEND AUTONOMY» в `CLAUDE.md`** (коммит `2fe7aa2`) — кросс-сессионная директива: UI читает ТОЛЬКО наш бэкенд (`getEftCatalog`/`getEftPriceMapFromDb`/`cta-api`/`itemIconUrl`), рантайм-вызовы `api.tarkov.dev` в страницах/компонентах/actions запрещены, новый датасет → mirror-таблица + синк в крон. CLAUDE.md закоммичен → правило видит и фронт-сессия.

### 🔬 Технические детали (API)
- `base(id)` (сборка `BarterItemBase`) мемоизирована per-render: один ингредиент, встречающийся в десятках бартеров, строится один раз.
- **Зона риска (по итогам ultracode-ревью, низкая):** `types[]` и `backgroundColor` живут только в зеркале `prices` — предмет без price-строки (рассинхрон `barters`↔`prices`) не попадёт в ручной поиск и отрисуется нейтрально-серым. Косметика: расчёты прибыли/XP идут от `priceRUB` в `sellFor`/`buyFor`, не от цвета.
- **Проверено вживую (data-path на боевой Supabase):** `items=5044, prices=5044, barters=778`; `initialItems` (types ⊇ barter) = 323; sample-сделка маппится корректно (Видеокарта, `sellFor`=6 офферов, `bg=blue`). `tsc` 0 ошибок, ноль обращений к `api.tarkov.dev` в рантайме.

---

## [4.2.1] - 2026-06-23 — Self-mirror: очистка стейл-строк при вайпе

### 🐛 Исправлено (Fixed)
- **Зеркало бартеров/крафтов копило «мёртвые» строки при вайпе.** `syncEftBartersCrafts` (`src/db/barters-crafts.ts`) делал только upsert — рецепты, исчезнувшие из tarkov.dev при смене вайпа, оставались в таблицах `barters`/`crafts` навсегда. Теперь после upsert лишние строки удаляются (`delete … where game_id=$ and id NOT IN (свежие)`). Коммит `f3f79c1`.
- **Зеркало лендинг-справочников — та же проблема.** `syncEftLandingData` (`src/db/landing.ts`) аналогично не чистил `achievements` / `maps` / `traders`. Логика вынесена в типобезопасный хелпер `pruneStale(table, idCol, gameCol, gameId, keep[], label)` (дженерик `PgTable`/`PgColumn`; у `traders` PK — `normalizedName`, а не `id`). Коммит `ffd0a2b`.

### 🛡️ Защита от разрушительного прюна
- **Пустой свежий набор не трогает таблицу** — `notInArray(col, [])` компилируется в SQL `true` и снёс бы её целиком; отсекается проверкой длины перед `delete`.
- **`PRUNE_MIN_RATIO = 0.5`** — если источник отдал HTTP 200, но усечённый список (напр. 12 из 778 при обрезке CDN/edge), прюн пропускается, старые данные сохраняются, пишется `console.warn`. Риск найден многоагентным ревью (ultracode).
- **Скоуп по `game_id`** — мультиигровая БД, чужие игры не задеваются.
- **Счётчик удалений из command tag (`res.count`)** — без `.returning()`, не тащим тела удалённых строк по пулеру.

### 🔬 Технические детали (API)
- Результат синков расширен: `bartersDeleted` / `craftsDeleted` / `bartersPruneSkipped` / `craftsPruneSkipped`, а для лендинга — per-table `*Deleted` / `*PruneSkipped` (achievements/maps/traders). Поля видны в JSON крон-роута `/api/cron/sync-prices` и в CLI-логах (`db:sync-barters-crafts`, `db:sync-landing`).
- **`prices` намеренно НЕ прюнится:** PK по стабильному BSG-`inGameId` (а не по wipe-волатильному tarkov.dev-`id`), плюс стейл-цена инертна — джойнится к каталогу, без соответствия не отображается.
- **Проверено вживую в проде:** `/api/cron/sync-prices` → HTTP 200 со всеми новыми полями (`items:5044, barters:778, crafts:211, achievements:109, maps:16, traders:16`; все `*Deleted: 0`, `*PruneSkipped: false` — вайпа нет).

---

## [4.2.0] - 2026-06-15 — Контейнеры: правильная типизация и индикаторы вместимости

### 🚀 Добавлено (Added)
- **`calculateContainerCapacity(item)`** в `item-indicators.util.ts` — вычисляет суммарную вместимость контейнера через `item.grids.reduce(w*h)`. Возвращает `null` если `grids` пуст или отсутствует.
- **`IndicatorItem`** — расширен полями `grids?: Array<{ width, height }>` и `name?: string | null`.
- **Индикаторы верхней плитки** для `cases`, `secure-containers`, `storage-containers`: приоритет `grids`-расчёт → fallback `properties.capacity`.
- **`__typename`** добавлен в блок `properties {}` GraphQL-запроса в `page.tsx` — позволяет серверу отличать `ItemPropertiesContainer` от других типов.

### 🐛 Исправлено (Fixed)
- **Защищённые контейнеры (Alpha, Beta, Gamma, Delta, Epsilon, Theta, Zeta, Kappa)** не отображались в разделе `/eft/items/gear/containers/secure`. Причина: в tarkov.dev API защищённые контейнеры имеют `types: ['noFlea']` — без `'container'`. Запрос `types: [container]` их не возвращал.
- **Решение:** slug `secure` / `secure-containers` → запрос `types: [noFlea]`, серверный фильтр: `properties.__typename === 'ItemPropertiesContainer' && !types.includes('container')`. Исключает THICC-кейсы и термосумки у которых `types: ['container', 'noFlea']`.
- **CONTAINER_SLUGS** обновлён в `item-indicators.util.ts` и `ItemsCategoryClient.tsx` — добавлены `'secure-containers'` и `'storage-containers'`.
- **typeMapping** в `page.tsx` — `'secure'` и `'secure-containers'` → `'noFlea'`; `'storage-containers'` → `'container'`.
- **Серверная фильтрация кейсов** — slug `cases` исключает `markedOnly`-предметы (THICC-кейсы из мечёных комнат).

### 🔬 Технические детали (API)
- `securedContainer` — не является валидным значением `ItemType` enum в tarkov.dev GraphQL.
- `markedOnly` — валидный тип, но идентифицирует предметы из мечёных комнат (SICC, оружейные кейсы), а НЕ защищённые контейнеры тела.
- Единственный надёжный способ выделить Alpha/Kappa: `types = ['noFlea']` + `properties.__typename = 'ItemPropertiesContainer'` + `!types.includes('container')`.

---

## [4.1.0] - 2026-06-15 — Фикс sticky-фильтров и очистка

### 🐛 Исправлено (Fixed)
- **Sticky-контейнер фильтров:** `CategoryControlBar` больше не управляет своим собственным `sticky`-позиционированием — ответственность поднята на уровень `ItemsCategoryClient`. Оба элемента (основная полоска + расширенная панель) теперь завёрнуты в единый `sticky top-18 z-40` контейнер, что устраняет эффект "обрезания" расширенного фильтра при скролле.
- **Фон панели фильтров:** Заменён с тяжёлого `bg-(--color-base)` на `bg-[color-mix(in_srgb,var(--color-base)_88%,transparent)] backdrop-blur-md` — стеклянный эффект в стиле хедера, нижняя граница `border-b border-lines-hover/20`.
- **`ItemsFilterPanel.tsx`:** Удалён `sticky top-[72px] z-40` из wrapper-div — компонент больше не захватывает позиционирование самостоятельно (orphaned, не используется в страницах).

---

## [4.0.0] - 2026-06-15 — Полная переработка каталога предметов

### 🚀 Добавлено (Added)
- **Composable `EftItemTile`:** Новый модульный компонент-тайл по паттерну Compound Component (`Root / Header / Media / Name / Pricing`). Поддерживает всплывающие тултипы для бартеров, крафтов и квестов (`tooltips/BarterTooltip`, `CraftTooltip`, `QuestTooltip`).
- **`CategoryControlBar`:** Новая единая полоска управления для категорийных страниц — поиск с clear-кнопкой, дропдаун сортировки (VPS / Trader / Flea / Min Price / Alpha), переключатели класса брони (1–6), фильтры "Бартер" / "Доступно мне", расширенные фильтры (цена мин/макс, калибр, тип брони, флаги доступности), группа вида (Сетка / Таблица), кнопка сохранения фильтров.
- **`CategoryTabs`:** Компонент навигационных табов для переключения по подкатегориям (`gear → armor / helmets / rigs / ...`).
- **`useCategoryFilters`:** Хук, инкапсулирующий весь стейт фильтров категорийной страницы (sort, search, armor classes, barter, available, advanced, save/load из localStorage).
- **`AdvancedFiltersPanel`:** Инлайн-панель расширенной фильтрации в `ItemsCategoryClient` (цена от/до, калибр, тип брони, флаги "нельзя купить / продать").
- **Виртуализация таблицы:** `@tanstack/react-virtual` в режиме "Таблица" — рендерит только видимые строки независимо от размера датасета.
- **GP Рефа:** Универсальная финальная колонка во всех таблицах — показывает стоимость предмета в ГП-монетах у торговца Забор.
- **Новые маршруты:**
  - `/eft/barters` — страница бартерных рецептов (`BartersClient`).
  - `/eft/items/loot-rate` — статистика лут-рейта предметов.
  - `/eft/items/item/[slug]` — новая детальная страница предмета (переписана с нуля: `ItemImage`, `ItemModules`).
- **`ConditionalLayout`:** Обёртка-условие для управления видимостью хедера/футера на специфичных маршрутах.
- **`/account` раздел:** `AccountCenter` + `AccountHeader` — персональный кабинет ЧВК.
- **Kit UI:** Базовые переиспользуемые компоненты `src/components/ui/kit/` — `Badge`, `MetricCard`, `ProgressBar`.
- **`RarityBadge`, `ItemGridSize`:** Новые UI-атомы для бейджей редкости и переключателя размера сетки.
- **`useScrollHeader`:** Рефакторинг хука с гистерезисом (enter: 50px / exit: 20px), устраняет мерцание при скролле у края порога.

### ♻️ Изменено (Changed)
- **`ItemsCategoryClient`:** Полная переработка. Объединяет Grid / Table в одном компоненте. Все 20+ типов категорий (оружие, броня, патроны, каски, рюкзаки, модули, прицелы и т.д.) с уникальными наборами колонок и специализированными хелперами (`renderPrice`, `renderBuyPrice`, `PenaltyCell`, `VendorIcon`).
- **`ItemsTable`, `ItemTableRow`:** Упрощены до legacy-режима; основная таблица переехала в `ItemsCategoryClient`.
- **`Header.tsx`:** Полный рефакторинг — поддержка скролла (`useScrollHeader`), Breadcrumbs появляются при скролле, анимация `grid-rows-[0fr→1fr]`.
- **`StreamStatus.tsx`:** Переработан визуал и логика обновления Twitch-статуса.
- **`questmap/page.tsx`:** Исправления и оптимизации карты квестов.
- **`globals.css`:** Добавлены токены и анимации, чистка устаревших правил.
- **`headerConfig.ts`:** Крупный рефакторинг дерева навигации EFT — добавлены новые разделы, исправлены пути.

### 🗑️ Удалено (Removed)
- **`src/app/eft/items/item/[id]/`** (старый `[id]` slug): Страница и `ItemModules.tsx` из корня `[id]` удалены — заменены переработанным `item/[slug]/`.

---

## [3.4.0] — Детальные страницы предметов и Торговля

### 🚀 Добавлено
- `ItemDetailsPage` с модульной структурой: `WeaponModule`, `ArmorModule`, `MedicalModule`, `ContainerModule`.
- `TraderModule` — агрегация `buyFor` / `sellFor`, автоопределение валюты ($ / € / ₽).
- `formatters.ts` — `formatCompactNumber`, `getCurrencySymbol`.
- Фильтр "Доступно мне" с проверкой профиля Zustand (уровень торговцев, уровень ЧВК < 15 для барахолки).

## [3.3.0] — UI/UX Каталога Предметов

### 🚀 Добавлено
- Экономика в плитках (VPS — цена за слот).
- Динамическая редкость по `backgroundColor` из API.
- Skeleton-загрузка (`animate-pulse`) для Grid и Table.

### ♻️ Изменено
- Адаптивные ограничения ширины ячеек с `truncate`.
- Рефакторинг: карточка предмета → `ItemTile.tsx`.
- Бейджи брони: удалён несуществующий 7-й класс, иконки 22×22px, `getArmorClassColor`.

## [3.2.0] — Интерактивный каталог предметов

### 🚀 Добавлено
- Каталог с Discriminated Unions (`tarkov-items.ts`).
- `ItemsViewSwitcher` (Сетка / Таблица).
- `ItemsFilterPanel` с поиском, категориями, сортировкой.
- Семантический `Badge.tsx`.

## [3.1.0] — Карта квестов и Достижения

### 🚀 Добавлено
- `questmap/page.tsx` — полноэкранная интерактивная карта с фильтром (только Каппа, поиск).
- `achievements/` — Server Components + `AchievementsClient` (фильтр, сортировка, Grid / Table).
- Скрипты `ensure-page-headers.mjs`, `fix-warnings.mjs`.

### 🐛 Исправлено
- Отказоустойчивость `[...category]/page.tsx` — динамический `pageId`.
- Типизация Lucide иконок через `<span>`.

## [3.0.0] — Глобальное расширение хабов

### 🚀 Добавлено
- Хабы: "Прибыль бартера", "Кодекс", "Видео", "Сборки оружия", "Убежище ЧВК".
- Детализация меню "Убежище ЧВК" (25 модулей).
- `scripts/sync-docs.mjs` — автодокументация.

### ♻️ Изменено
- Zustand `usePlayerStore` → `src/store/`.
- `<PageHeader />` на всех хабах, контент в `pageContent.ts`.
- Catch-all `[...category]/page.tsx` заменил статические папки в `/eft/items/`.
- `headerConfig.ts` разбит на модули (`navigation/eft.ts`, `other-games.ts`).
- `SLANG_MAP` → `src/data/slang.ts`.
- Иконки CSS-классов → `src/styles/icons.css`.

## [2.9.0] — Многоуровневая навигация

### 🚀 Добавлено
- Рекурсивное меню до 5+ уровней в `HeaderNavigation`.
- Фракционные иконки (`iconUrlBear` / `iconUrlUsec`).
- `TacticalSearch` обходит всё дерево меню.

## [2.8.0] — Система профилей и Zustand

### 🚀 Добавлено
- `usePlayerStore` — до 5 профилей ЧВК, `localStorage`.
- `ProfileSettingsModal` — настройки никнейма, уровня, репутации торговцев.
- `ProfileResetModal`, `ProfileDeleteModal` — подтверждение опасных действий.

## [2.6.0] — Модульный Хедер

### 🚀 Добавлено
- Декомпозиция `Header.tsx` → `header-modules/`.
- `GameSwitcher` с CSS-масками.
- `clamp()` для fluid-вертикального ритма шапки.
- `NewbieButton` с hazard-анимацией.

## [2.5.0] — Умный поиск

### 🚀 Добавлено
- `search-engine.ts` со словарём сленга (ксюха, мка, ледекс...).
- `ColorPaletteDevTool` для настройки токенов в браузере.
- Фильтрация достижений по категориям и редкости.

## [2.4.0] — tarkov.dev API

### 🚀 Добавлено
- `keepitems` — реальные данные барахолки + алгоритм редкости.

## [2.3.0] — FSD Architecture

### 🚀 Добавлено
- Реструктуризация по FSD: `layout / ui / features / providers`.
- `TacticalSearch` как Command Palette.
- `[gameId]/page.tsx` — динамический хаб.

## [2.2.0] — Динамический Хедер

### 🚀 Добавлено
- `Header.tsx` с автоопределением темы по `usePathname`.
- `headerConfig.ts` — конфигурация навигации.
- `TacticalSearch` (CTRL+Q).
- `PlayerTelemetry`.

## [2.1.0] — YouTube и Хлебные Крошки

### 🚀 Добавлено
- YouTube Server Action + `LiteYouTube` фасад.
- `Breadcrumbs` компонент.
- `template.tsx` — fade-in при переходах.

## [1.0.0] — Начало

### 🚀 Добавлено
- Next.js + Tailwind CSS v4 инициализация.
- GraphQL `tarkov.dev` интеграция.
- Базовый роутинг.
