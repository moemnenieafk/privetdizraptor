# 📜 История изменений проекта (Changelog)

Все заметные изменения в проект `cta` документируются здесь.
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

---

## [4.4.0] - 2026-07-15 — Дизайн-модернизация 2026 + свод корневых доков

### ♻️ Изменено (Changed)
- **Вью-таблица/грид-переключатель снесены целиком** (каталог предметов + глобальный поиск) → только карточки через `EftItemTile`. Таблица не давала ценности вне колоночного сравнения; карточки выигрывают на распознавании предметов.
- **Живые компоненты переведены на container queries** — канон в `DESIGN_SYSTEM.md` §9 (именованные `@container/<name>`, self-reflow root оборачивается внутренним контейнером).
- **Типографика:** `text-wrap` дефолты (`balance` для заголовков, `pretty` для тела).

### 🚀 Добавлено (Added)
- **Нативные View Transitions** через App Router (bundled React canary — без бампа зависимостей, подтверждено рантайм/тайп-проверкой).
- **Глобальный guard `prefers-reduced-motion`** — доступность.

### 🧹 Гигиена (Housekeeping)
- **Свод корневых доков к реальности:** `MVPMANIFEST.md` → тонкий индекс-указатель на живые источники (`docs/`); `AGENTS.md` / `README.md` / `PROJECT_STRUCTURE.md` / `DESIGN_SYSTEM.md` выровнены на Next.js 16 + Supabase-зеркало (правило 11); вычищены ссылки на удалённые компоненты (`ItemsViewSwitcher`/`ItemRow`/`ItemCard`/`ItemTableRow`/`useContainerColumns`) и 6 несуществующих путей из дерева.
- **Версии выровнены на `4.4.0`** во всех источниках (`package.json`, `AGENTS.md`, `README.md`).
- **Снос мёртвых кластеров кода.**

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

---

<!-- AUTO-COMMIT-LOG:START -->

## 🧾 Лог коммитов (авто, с 2026-06-23)

> Автогенерируется `.github/workflows/changelog.yml` на каждый push в `main`. Руками не редактировать — правки затрутся. Курируемая история (Keep a Changelog) — выше.

### 2026-07-16
- `231ee8c` feat(game-changes): живой источник tarkov.dev — фича реально работает
- `7a6b843` feat(game-changes): панель на game-updates, детали за подпиской
- `d7b957c` feat(game-changes): дифф-движок + крон детекта
- `cf436da` feat(game-changes): схема CDC + гейт-фича + миграция
- `c27d478` feat(header): пульс-появление бейджа режима при входе в PvE
- `4d27c8a` feat(items): плавный переход цен при смене режима PvP↔PvE
- `afa85a5` docs(ulta): статус 🔵 обдумываю → 🟢 в проде
- `62120b0` test(roles): повторяемый аудит «Ульты» — ссылки хабов + достижимость ролей
- `49bde62` docs(state): свежий релиз-снапшот 16.07 (релиз-гейт почти закрыт)
- `85d2040` chore(comlink): канонический RLS-скрипт + верификация RLS в миграции
- `debb032` fix(prices): устойчивое чтение цен — каталог не падает без PvE-миграции
- `d07fa68` chore(migrate): роут+workflow migrate-prices-pve (добавляет PvE-колонки в prices)
- `3aea48b` feat(prices): PvE-цены — схема + синк (gameMode: pve) + чтение
- `845d2b6` feat(gamemode): фронт-переключение цен барахолки по режиму
- `44b3b40` feat(gamemode): гейтинг PvP-only контента в режиме PvE
- `148ad3f` feat(gamemode): PvP/PvE переключает весь сайт через профиль ЧВК
- `5b33048` feat(adaptive): роль per-profile ЧВК + гейт инсайтов на подписку
- `ff07d4f` feat(profile): поля «Рейдов» и «Выживаемость» в профиле ЧВК + инференс
- `4827669` feat(rookie): этап «Патрон решает» на реальном манекене боссов
- `ee29ce7` feat(adaptive): ПвЕ-ось + роль Сокланы
- `477e6c9` feat(adaptive): +3 роли под RU — Крыса, Шерп, Лорник
- `a5bd7f6` feat(account): поле «Часов в игре» в редакторе профиля Аккаунт-центра
- `fa156c7` feat(profile): инпут «Часов в игре» в профиле ЧВК + приём из OCR
- `043e0fd` feat(adaptive): role-hubs + адаптивный хаб /eft/hub
- `b51d0e6` fix(rookie): убрал opacity-модификатор на CSS-переменной (Tailwind v4)
- `0a52ed9` feat(rookie): этапы 06-10 — Путь Новобранца завершён (10/10)
- `97e8e0f` feat(rookie): этапы 04-05 Пути — Найдено в рейде + Торговцы
- `9ba37a8` feat(rookie): этапы 02-03 Пути — ЧВК/Дикий + Не потеряй всё
- `824e02b` fix(seasons): краш конструктора перков (Zustand v5 селектор)
- `2e46455` feat(rookie): первый этап Пути — интерактивный симулятор рейда
- `17e1011` feat(adaptive): авто-провод роли — профиль+телеметрия -> computeRole -> derived
- `d2f285b` feat(rookie): подраздел «Я новичок» в Прогрессе + вход из меню ЧВК

### 2026-07-15
- `cd07a3b` feat(adaptive): hoursPlayed в профиле ЧВК + движок роли + useRoleStore
- `aad985d` fix(account): make getMe tolerant of missing notify_* columns + mobile migration
- `403bd82` feat(account): persist notification (rassylka) preferences
- `25b38be` feat(account): honest PRO-status from real subscription tier
- `8914872` feat(mobile): вход в Аккаунт Центр из бургер-меню
- `8756584` fix(account): харденинг интеграций (соц-привязка)
- `29a247e` chore(deps): удаление 5 неиспользуемых зависимостей
- `a79a3a4` chore: снос 17 орфан-модулей (0 импортов)
- `9209ee9` feat(security): анти-хотлинк своих ассетов через CORP same-origin
- `671d765` chore(icons): гигиена SVG + копирайт-подпись 278 своих иконок
- `ee710cf` ci(changelog): бот не логирует sync-коммиты в авто-лог
- `f37053c` chore: снос мёртвого острова items-фильтра
- `3eabd71` docs: свод корневых доков + выравнивание версий на 4.4.0
- `9c2704a` chore: align project version to 4.3.0 across docs + package.json
- `d763e60` docs: fix stale Next.js 14 in PROJECT_STRUCTURE header
- `d579015` docs: reconcile root docs with current reality
- `2249390` docs: replace stale MVPMANIFEST with thin pointer index
- `a1c59a8` chore(items): tidy dead table machinery in ItemsCategoryClient
- `c0374e9` chore(items): excise dead table render path
- `98fa698` chore(items): delete dead ItemsViewSwitcher cluster
- `3a12dc3` feat(search): drop grid/list view toggle in TacticalSearch - cards only
- `d3873b2` feat(items): drop grid/table view toggle - cards only
- `036dcb6` revert(atmosphere): remove film-grain overlay
- `e6cc30a` feat(atmosphere): subtle film-grain overlay
- `1681c18` feat(nav): native React View Transitions on route changes
- `922b383` refactor(quests): container-query QuestStatusBar
- `3b11828` chore(home): remove dead SupplyGrid
- `25d8348` refactor(videos): container-query VideoArchive
- `3fa9298` refactor(videos): container-query VideoFilterBar
- `d2eb271` chore(items): remove dead ItemsFilterPanel + ArmorFilterPanel
- `3956c9c` feat(a11y): global prefers-reduced-motion guard
- `312d184` refactor(items): container-query HubNav
- `859edfe` refactor(items): container-query CategoryControlBar
- `c142e58` feat(typography): text-wrap balance/pretty defaults (Baseline 2026)
- `a2c8b55` refactor(items): unify ItemTableRow+ItemCard into container-query ItemRow
- `bd954a5` refactor(items): container-aware grid columns via ResizeObserver
- `de787cd` docs(release-audit): OG-картинка закрыта (dec2241a)
- `dec2241` feat(seo): OG-картинка для превью ссылок
- `78500c7` docs(seasons): переношу решение в done/
- `4989d7e` docs(seasons): иконки перков закрыты
- `1788a45` feat(seasons): иконки-заглушки перков Kord Breach
- `a7990f7` docs(seasons): решение по разделу «Сезоны» + разведка Kord Breach
- `f619fc3` feat(seasons): раздел «Сезоны» в Прогрессе + шаринг по коду
- `679ec75` feat(seasons): интерактивный конструктор перков
- `773d535` feat(seasons): данные Kord Breach + математика бюджета перков
- `a3ac9aa` feat(cms): конструктор гайда на странице истории
- `7a24b81` feat(cms): API гайдов + санитайзер дерева
- `a1f79a9` feat(cms): сюжетные гайды в БД — схема, DDL, миграция (E10, фаза 5)
- `588eff0` docs(cms): фаза 4 закрыта — медиа-библиотека, миграция прогнана
- `7eb51ba` feat(cms): медиа-библиотека и пикер в редакторе
- `079220a` feat(cms): API медиа — загрузка со сверкой сигнатур
- `80d655c` feat(cms): каталог медиа — схема, DDL, миграция (E10, фаза 4)
- `6f70783` docs(cms): фаза 3 закрыта — Кодекс в БД, миграция прогнана

### 2026-07-14
- `b5bafd1` feat(cms): инлайн-редактор Кодекса на самой статье
- `d5d14ee` feat(cms): миграция Кодекса + сид 8 статей
- `73b5d9d` feat(cms): Кодекс в БД — схема, DDL, слой доступа (E10, фаза 3)
- `2c155d3` docs(cms): фазы 1-2 закрыты (роль editor + Draft Mode)
- `c8045f0` feat(cms): статьи правит editor; публикация без ребилда; фикс потери текста
- `32e39e7` feat(cms): статьи читаются с учётом черновиков
- `66e094a` feat(cms): режим черновика (Next Draft Mode) — E10, фаза 2
- `56c949b` feat(cms): /admin пускает редактора, каталог остаётся за админом
- `c3e6216` feat(cms): роль editor + канон прав (E10, фаза 1)
- `fc79160` docs: CMS — выбрана модель редактирования (E10 разбит на 6 фаз)
- `d621d08` docs: comlink-миграция прогнана, fullkamen — модератор
- `e3135df` ci: workflow «set-role» — назначение модератора из Actions
- `5331f09` feat: роут назначения роли модератора (GET /api/cron/set-role)
- `3fb83aa` docs: Проход 2 — security-review пройден, 3 дыры закрыты
- `e4fc9ec` security: rate-limit на загрузку аватара (10/час на пользователя)
- `0e428e7` security: rate-limit на публичные ручки каталога
- `ad81e8a` security: rate-limit на публичную форму обратной связи
- `c7dad5d` docs: ревизия валта — 12 решений закрыто, срез готовности к релизу
- `e9623d7` fix: мертвые ссылки в футере (href=#)
- `9b060d4` fix: страницы ошибок 500 (их не было)
- `87950a5` seo: корневые метаданные вместо стайлгайдовской заглушки
- `b9374fe` seo: sitemap.xml + robots.txt
- `b85201d` legal: реальный текст «Условий использования» и «Политики конфиденциальности»
- `9440d03` seo: единая точка правды по адресу сайта (lib/site.ts)
- `02714de` feat(events): связь ивентов с квестами, достижениями и бартерами
- `65e1316` fix(comlink): чтение статей не роняет билд, если таблицы ещё нет (дедлок деплой↔миграция)
- `0c4d8ea` fix(events): май–июль 2026 по официальным анонсам BSG — Полный ход, Ледокол, Тарковское гостеприимство, бонус XP, Дикий Лес
- `9af078a` fix(events): сверка 2026 по официальному TG BSG — Блэкаут (1.0.6.5), Дикий Лес (итог), Тарковское гостеприимство (выбор стороны), бонус XP +25%
- `6d84d0f` feat(events): метка ивента на странице квеста со ссылкой на событие
- `ec6f536` feat(events): описание и иконка раздела «События»
- `124e5d7` feat(events): страница /eft/quests/events вместо смарт-заглушки
- `42f8d9f` feat(events): таймлайн с поиском, фильтрами категорий/годов и порядком
- `943f50b` feat(events): карточка события с раскрытием изменений и ссылками на квесты
- `fa4ec1d` feat(events): глифы категорий (статичная карта, без динамических классов)
- `4c0f010` feat(events): мост «ивент ↔ база квестов» (серверный резолв ссылок)
- `e02c91a` feat(events): хелперы фильтрации, сортировки и группировки по годам
- `e00aa44` feat(events): реестр событий EFT 2021–2026 (97 ивентов) + категории
- `a61573d` feat(events): типы реестра внутриигровых событий
- `71ba364` feat(comlink): Обновления игры — импорт патчей из Steam News + разбор ЦТА
- `cb932cb` feat(comlink): Обсуждения — форум с модерацией, жалобами и кармой авторов
- `52cc269` feat(comlink): Биржа шерпов — наставники со статистикой сессий, +15 кармы за сессию
- `59123de` feat(comlink): рейды и карма — заявки, подтверждение 48ч, взаимная оценка со скрытием
- `b906a9d` feat(comlink): Кандидаты — анкеты с живым трекером, кармой и Discord-контактом
- `1db5653` feat(comlink): схема социального слоя — анкеты, рейды, отзывы, карма, жалобы, форум
- `35e2557` fix(loadouts): пустой BuildDefsBundle без prices — не сходился с типом
- `a77996d` fix(loadouts): пустой BuildDefsBundle без prices ломал typecheck
- `21ce1e9` feat(loadouts): актуальная цена сборки, уклон и шаринг снэпшота ссылкой
- `5b3c296` feat(loadouts): страница /my — раньше падала в заглушку [action]
- `ae5c4fc` feat(loadouts): MyLoadoutsClient — список сохранённых сборок
- `a656f49` feat(loadouts): POST /api/eft/builds/defs
- `a9623e4` feat(loadouts): getBuildDefs — точечные определения предметов для сохранённых сборок
- `5ea97a7` feat(loadouts): BuildDefsBundle — контракт ответа /api/eft/builds/defs

### 2026-07-13
- `79ca9aa` Update page.tsx
- `2822ba1` Create src/components/features/loadouts/GunsmithVideoCard.tsx
- `320c8fb` Create src/lib/gunsmith-videos.ts
- `3a13488` Create src/components/features/loadouts/GunsmithSolution.tsx
- `c35ec0b` Create src/app/eft/progress/loadouts/find/gunsmith/[objectiveId]/page.tsx
- `d3c1283` Create src/components/features/loadouts/FindLoadoutsClient.tsx
- `3a05d13` Create src/app/eft/progress/loadouts/find/page.tsx
- `6f8de41` Create src/db/preset-list.ts
- `c3f0aaf` Create src/db/gunsmith-list.ts
- `8382102` Create src/components/features/loadouts/ShoppingList.tsx
- `f086b71` Create src/db/build-prices.ts
- `8cf044d` Create src/lib/gunsmith-solver.ts
- `b07df02` Update gunsmith.ts
- `260c4e7` Create src/lib/gunsmith.ts
- `e36de87` Update route.ts
- `9ab19bf` Update route.ts
- `3be4406` Update weapons.ts
- `9ee5dfd` Create src/lib/eft-gunsmith.ts
- `9112430` Update weapons-ddl.ts
- `ea4cd6f` Create src/db/schema-gunsmith.ts
- `39907b4` Update ModPicker.tsx
- `7148d5b` Create src/components/features/loadouts/BuildStatsPanel.tsx
- `442ebe0` Create src/components/features/loadouts/ModPicker.tsx
- `3e0df23` Create src/components/features/loadouts/BuildCanvas.tsx
- `0d4a59c` Create src/components/features/loadouts/WeaponBuilder.tsx
- `c6a6a7b` Create src/components/features/loadouts/BaseSelector.tsx
- `a647306` Create src/app/eft/progress/loadouts/add/page.tsx
- `8e42122` Update eft-weapons.ts
- `607d7c3` Create src/lib/slot-icons.ts
- `19612b7` Update eft-weapons.ts
- `cad604e` Create src/lib/preset-slots.ts
- `aeafe3d` Create .github/workflows/migrate-weapons.yml
- `b499e59` Create src/app/api/cron/migrate-weapons/route.ts
- `dbc154f` Create src/db/weapons-ddl.ts
- `9a255bd` Update sync-weapons.yml
- `1890bc2` Delete sync-weapons.yml
- `4255286` Create route.ts
- `726b7af` Create sync-weapons.yml
- `b7e1b80` Create sync-weapons.yml
- `9b67a91` Create supabase/weapons.sql
- `3d1db69` Create scripts/sync-weapons.ts
- `803b185` Create src/db/weapons.ts
- `e9b09ed` Create src/lib/eft-weapons.ts
- `cbee57d` Update schema.ts
- `f0dc53b` Update progress-storage.ts
- `bb36656` Create src/components/features/loadouts/BuildMedia.tsx
- `39d02ac` Create src/lib/build-media.ts
- `29340c6` Create src/hooks/useBuildQuota.ts
- `3324c10` Update subscription-tiers.ts
- `2b90a4a` Create src/store/useBuildStore.ts
- `22c4a04` Create src/lib/weapon-build.ts
- `1ef222b` Update VideoArchive.tsx
- `65d088d` Update useVideoStore.ts
- `dc637b0` Update youtube.ts
- `3de5bd5` Update video-catalog.ts
- `7c19308` Update youtube.ts
- `95fca05` Update twitch-vods.ts
- `191bbde` Update twitch-embed.ts
- `8fe8d1c` Update VideoCard.tsx
- `c1e3d33` Create src/app/eft/videos/[category]/[id]/page.tsx
- `6d74882` Update page.tsx
- `06add8b` Update page.tsx
- `63fd7de` Create src/components/features/videos/VideoPlayer.tsx
- `47cee16` Create src/components/features/videos/VideoArchive.tsx

### 2026-07-12
- `6295067` Create src/components/features/videos/VideoFilterBar.tsx
- `c2268a1` Create src/components/features/videos/VideoCard.tsx
- `2464bbf` Create src/store/useVideoStore.ts
- `5a78b8a` Create src/lib/twitch-vods.ts
- `679c1a0` Create src/lib/video-utils.ts
- `cec1a52` Create src/lib/youtube.ts
- `c8f0a6a` Create src/data/video-catalog.ts
- `16918b6` Create src/types/video.ts
- `55c153d` fix(tracker): чёрный квадрат вместо иконки в шапке раздела
- `8c69e18` refactor(fill-media): убрать драг-залив, оставить тап и индикацию
- `f790fb3` fix(fill-media): тап по заливке больше не уменьшает её сам собой
- `30de13d` fix(tracker): кнопки +/− больше не уезжают из-под пальца
- `97880a8` fix(tracker): карточка больше не «скачет» при нажатии +/−
- `c1a84af` Update index.tsx
- `fe117d8` Update index.tsx
- `bdc0b77` Update QuestMapClient.tsx
- `85321b5` Update index.tsx
- `06ee352` Update index.tsx
- `23a70bb` Update index.tsx
- `77ebaea` Update index.tsx
- `0cc878b` Update QuestMapClient.tsx
- `4dce25d` Update index.tsx
- `541ecf1` Update QuestMapClient.tsx
- `1cc313e` Update QuestMapClient.tsx
- `a151d76` Update index.tsx
- `d76ccfb` Create src/components/features/quests/MobileQuestBar.tsx
- `1a2ac72` Create src/components/features/quests/QuestSearchSheet.tsx
- `f2a93e4` Create src/components/features/quests/QuestMapsSheet.tsx
- `c0a7236` Create src/components/features/quests/QuestTraderSheet.tsx
- `b1c8545` Create src/store/useQuestMapUiStore.ts
- `6df8fa6` Update QuestMapClient.tsx
- `ee31b94` Update index.tsx
- `167e7fc` Update MobileMapBar.tsx
- `99cc553` Update MapFrame.tsx
- `5fd460f` Create src/components/features/maps/MapRaidSheet.tsx
- `e234abe` Update MapBottomBar.tsx
- `c580381` Update useMapUiStore.ts
- `6d9b5f0` Update MapFrame.tsx

### 2026-07-11
- `238f970` Update MapQuestSheet.tsx
- `d1b8873` Update MobileMapBar.tsx
- `9a68a10` Update MobileMapBar.tsx
- `e7e81dc` Update MobileMapBar.tsx
- `ba425f5` Update MapFrame.tsx
- `30756bd` Update MapViewerClient.tsx
- `f70b276` Update MapFrame.tsx
- `69baa70` Update MapSearchSheet.tsx
- `a664ad5` Update MapViewerClient.tsx
- `97aec37` Create MobileMapBar.tsx
- `4a8bd5e` Update MapLayersDrawer.tsx
- `4aeac4f` Update PlayerTracker.tsx
- `8e7617a` Update MapFrame.tsx
- `b17586c` Update MobileMapToolbar.tsx
- `1bb4721` Update MapPickerSheet.tsx
- `3c0609d` Update MapFrame.tsx
- `f23d377` Update MapFrame.tsx
- `722c8e7` Update MapPickerSheet.tsx
- `1be040d` Update BottomSheet.tsx
- `f0236e6` Update MapPickerSheet.tsx
- `bbcb33c` Delete MobileMapToolbar.tsx
- `f67a1ee` Create MobileMapToolbar.tsx
- `d997ae0` Delete MapSearchSheet.tsx
- `611af53` Create MapSearchSheet.tsx
- `c982789` Delete MapQuestSheet.tsx
- `03e155b` Create MapQuestSheet.tsx
- `a25d922` Delete MapPickerSheet.tsx
- `66d158f` Create MapPickerSheet.tsx
- `8102857` Delete MapFloatingControls.tsx
- `f2359c8` Create MapFloatingControls.tsx
- `2d84b3b` Update MapFrame.tsx
- `f5669ac` Update MapFloatingControls.tsx
- `b454b24` Update MobileMapToolbar.tsx
- `7c7b75b` Update MapFrame.tsx
- `9f8da3c` Update MapFrame.tsx
- `4f3bf84` Create src/components/features/map/MapFloatingControls.tsx
- `f33b452` Create src/components/features/map/MapQuestSheet.tsx
- `da48baa` Create src/components/features/map/MapSearchSheet.tsx
- `ab9c190` Create src/components/features/map/MapPickerSheet.tsx
- `970d263` Create src/components/features/map/MobileMapToolbar.tsx
- `8f0364f` Create src/components/layout/BottomSheet.tsx
- `4e611ad` Create src/store/useMapUiStore.ts
- `746ea54` Merge feat/prestige-redesign-images: редизайн + геймификация престижа
- `81c2b7f` feat(bosses): оружие босса иконками + фикс данных; обобщён лоадаут
- `477792d` fix(prestige): route prestige-items -> force-dynamic
- `9a16728` fix(bosses): манекен крупнее на мобилке — плотный viewBox по фигуре + шире контейнер
- `0000a86` fix(bosses): BossArmorLoadout — резолв slug/фон из prices, имя из items (join по inGameId)
- `108d2b2` data(bosses): armorItems уникальной брони + фикс Киллы

### 2026-07-10
- `4dc18f0` feat(bosses): 7-зонный вектор-манекен V4DYA + броня-лоадаут из БД
- `a7f5a0e` feat(hideout): бак материалов на общий FillMedia (тап +1 / драг-залив)
- `7dcbb73` feat(tracker): бак-заливка предмета как drag-слайдер (тяни пальцем → заполняй)
- `61f86b1` feat(tracker): ввод количества + вертикальный «бак» на карточках трекера предметов
- `dfec6be` feat(bosses): векторный манекен HP-хитмапа в кодексе
- `87108c0` feat(prestige): кросс-линк фигурок целей на страницу предмета
- `88ea286` feat(prestige): «Путь к Престижу» — геймификация прогресса
- `807bd31` feat(prestige): image-rich mobile-first redesign
- `c0dd87a` feat(codex): full-шапка навигации на индексных страницах (аналог QuestsHubNav)
- `70e83d5` feat(codex): единый переключатель разделов «Кодекса» через layout (аналог навигации «Заданий»)

### 2026-07-09
- `4d1058b` feat(nav): move Karta zadaniy from Progress to Quests hub
- `b4b4592` refactor(loot-containers): цены/слаг из нашей БД (getEftPricesByIds) вместо рантайм-запроса к tarkov.dev; удалил осиротевший getEftItemsPricing
- `4464fc9` feat(loot-containers): иконки предметов + ссылка на страницу предмета в таблице лута (getEftItemsPricing отдаёт normalizedName)
- `97d08c0` fix(nav): иконка Лут-контейнеров в подменю — iconUrl вместо iconClass (HubNav маскирует iconUrl)
- `a8e2436` feat(nav): перенёс Лут-контейнеры в Снаряжение → Контейнеры (сохранил icon-eft-loot-containers)
- `0be9e2e` feat(compare): жёсткое категорийное сравнение (A1)
- `6f1593e` feat(needed+item): стэш-оверлей нужного (B-correct)
- `64eae96` fix(item): ценовой блок в один столбец (6 строк) — крупные суммы больше не обрезаются на мобилке
- `feddf3f` feat(search): адаптивная выдача предметов в тактическом поиске — тумблер плитка/список
- `b39adc9` fix(mobile): E8 P2 — achievements таблица overflow-x-auto (скролл вместо клипа)
- `43a1702` feat(mobile): E8 P1.2 — card-reflow дата-таблиц на <sm (ItemsTable + категории)
- `dbb7d8a` Update tracking-favorite-items.md
- `528c87e` feat(tracking): домен «Истории» в хабе Трекинг — дайджест сюжеток
- `91deecb` docs(spec): loot-container РЕАЛИЗОВАНО — Фаза 1 + Фаза 2 в main
- `ea58fee` feat(loot-containers): Фаза 2 — реальные таблицы лута из SPT staticLoot (29 контейнеров, шанс % + ценность через tarkov.dev); нормализатор в scripts/
- `9d281a3` docs(spec): loot-container — источник данных РАЗБЛОКИРОВАН (SPT на GitHub, raw, не LFS); Фаза 2 без db:sql (вариант стат-ассета)
- `e47024e` feat(loot-containers): Фаза 1 каркас — раздел /eft/loot-containers (каталог 31 контейнер, список, страница-шелл, nav-иконка); таблица лута = плейсхолдер (Фаза 2 SPT)
- `1649b94` docs(spec): loot-container — решения приняты (loot-контейнеры /eft/loot-containers + SPT staticLoot; скрейп конкурента/вики отклонён)
- `385b432` docs(spec): loot-container — развилки решены (loot-контейнеры /eft/loot-containers, источник SPT staticLoot); дата-пайплайн + 2 фазы
- `be7bcdf` docs(spec): loot-container-table — заземлил спеку (нет данных loot-table; развилки: тип контейнеров + источник)
- `c3d2f9e` docs(mobile): аудит-нота — P1.1 тач-таргеты отмечены сделанными
- `4d36596` fix(mobile): P1.1 тач-таргеты финал — кнопка «На главную» в AccountHeader до 44px; остальные кандидаты подтверждены декором
- `003f817` fix(mobile): P1.1 тач-таргеты кластер 2 — контролы items/achievements + нав квестов до 44px на мобилке
- `eb7935a` fix(mobile): P1.1 тач-таргеты кластер 1 — Story-навигация + floor-switcher + follow-тоггл до 44px на мобилке (десктоп без изменений)
- `dfc7dfd` docs(mobile): E8 mobile-first аудит проход 1 — фундамент ок, лаунч-блокеров нет; P1 тач-таргеты + таблицы
- `cacb85e` docs(payments): deep-research рельсов оплаты — ЮKassa/СБП vs Boosty (~3% vs ~13%), направление на решение Димы
- `3ef0dab` feat(monetization): E4 скаффолд гейтинга — tier-конфиг, useSubscription, Paywall (устойчив до db:sql)
- `4389d30` docs(monetization): фидбэк партнёров — модель согласована; рельс оплаты пересматривается (Boosty ~13% дорого, направление — прямой эквайринг)

### 2026-07-08
- `062e581` docs(monetization): расширил RU-конкурентов (tarkov-market.ru, вики, моб.апп) + выводы: паритет трекера, устойчивость к РКН, мобилка
- `1e3f468` docs(monetization): +RU-конкуренты (eft.su, tarkov.help) и ЮKassa-рельс в research; указатель в E5
- `91ca1db` docs(monetization): E3 рисёрч вынесен в отдельную ноту deep-research-subscription-monetization + TL;DR-ссылка
- `c9e0e66` docs(monetization): E3 research подписок — конкуренты + Boosty-нормы + рекомендуемая модель тиров
- `35f220f` docs(arch): правило колокации *Client.tsx в PROJECT_STRUCTURE.md
- `175b0ff` refactor(arch): FSD-lite — PlaceholderPage->ui/, удалён пустой хук-огрызок, заметка закрыта
- `36aafaf` docs(maps): статус-секция Track-1 + добивка мелочи в заметке решений
- `6bb8e61` refactor(maps): порог реза спавнов в именованную SPAWN_CAP_PER_ZONE
- `abb59e6` fix(maps): Goons на синканных картах рисуются трио (knight/bigpipe/birdeye)
- `4cb79f2` feat(maps): кросс-линки маркеров на синканных картах (квест→задача, лут→предмет)
- `f4abbb1` Update ci.yml
- `2323e05` fix(maps): типизация async-итератора папки скриншотов (tsc-грин)
- `6a13576` Create ci.yml
- `06bfbea` feat(maps): браузерный трекинг игрока по скриншотам EFT (Track-1)
- `3ce53d8` Merge docs/deep-research-player-tracking: deep research + заметка трекинга игрока
- `5e012ae` docs(maps): deep research MapLootEditorLite + TarkovMapTracker + заметка трекинга игрока
- `7c84b10` Merge feat/maps-markers-icons-v2: под-виды выходов, спавн-фракции, боссы-портреты, loose-линки, замки
- `b1b0c0a` feat(maps): под-виды выходов, спавн-фракции, боссы-портреты, loose-линки, иконки замков

### 2026-07-07
- `af9c889` feat(maps): доработка иконок-маркеров + drawer слоёв + экспорт SVG
- `1ec4350` feat(maps): иконки-маркеры, drawer слоёв, боссы, навигация карты

### 2026-07-06
- `9a21d54` chore(home): удалить неиспользуемый CommsHub
- `b77cf75` feat(header/home): pred-mvp — ужатие хедера + удаление комм-узла
- `da88d2e` feat(brand): главное лого сайта → CTA-logo-hover.svg
- `12f3777` feat(maps): маркер-иконки (webp) + реорг icons.css по разделам
- `2c309c0` perf(icons): раздавать 512px-иконки вместо 256px
- `35a757e` feat: Twitch-виджеты, раздел «Связь», медиа сюжетных историй + ассеты

### 2026-07-05
- `606abe5` feat(footer): полный редизайн футера + реворк StreamStatus + юр-страницы

### 2026-07-04
- `3c71318` docs: роадмап доработок ЦТА + релиз-гейт MVP
- `625edb0` feat(quests): интерактивные walkthrough-гайды сюжеток + форма «Сообщить об ошибке»

### 2026-07-02
- `654d7f8` feat(tracking): домен «Избранное» — прайс-борд плитками EftItemTile + иконка Библиотеки
- `897a07b` fix(nav): крошки читают breadcrumbNames + скрытие BSG-id; карточки Достижения/Престиж → Кодекс
- `8a2f04e` feat(hideout,tracking): бак материалов убежища + единый трекер на странице модулей; «Важные предметы»; 4 заметки закрыты
- `95e0e25` feat(tracking): домены Задания/Предметы/Убежище/Престиж + Профиль ЧВК табом (ТР2+ТР3)
- `356527b` feat(tracking): сброс достижений + табы игр в Трекинге + дорожная карта трекинга
- `718c41a` feat(account): вкладка «Трекинг» — вотчлист достижений + обзор по редкости (v1)
- `2c619b2` docs(decisions): эпик достижений закрыт (Фазы 1-2 одобрены V4DYA) → done/ + заметка player-tracking-tab
- `039f078` feat(achievements): трекинг игрока (Фаза 2) — выполнено/отслеживаю + облачный синк
- `b004a58` feat(achievements): редизайн раздела — офиц. редкость/фракция, SMART-детали, фикс иконок (Фаза 1)

### 2026-07-01
- `f88edd3` feat(mobile): единый стиль контента — HubCard/каталог/похожие/карты 1-в-ряд на телефоне
- `7f86117` feat(header): мобильная адаптация хедера 1:1 по макетам + морф-бургер (2 линии↔крест)
- `c331b11` docs(decisions): fix-quests закрыт → done/ (приёмка V4DYA; код в 469e0b8+682607f)
- `682607f` feat(quests,items): section-hub-nav — 522-колонки, выравнивание по строкам, мобилка (14px тап-таргеты)
- `469e0b8` feat(quests): навигация раздела на всех уровнях + фильтры-индикаторы (fix-quests done)
- `60fe2ad` ci(vercel): вынос ignoreCommand в scripts/vercel-ignore.sh + fetch-fallback (v3)
- `2a8e97d` ci(vercel): ignoreCommand смотрит весь диапазон PREV..HEAD (фикс skip-docs ямы)
- `bb171a0` docs(decisions): fix-quests дорешено (⏳ к исполнению) — вариант B QuestsHubNav, scope только хаб
- `4cb80ca` docs+layout: исполнено решение stream-status-btn (вынос кнопки стрима из хедера в плавающий стек) через цепь docs→code
- `84f63c1` docs(process): инженерный цикл ✅ сделано (живой рулбук, остаётся в корне)
- `60de754` docs(decisions): закрыто глобальное правило агрегации (✅ сделано → done/)
- `1416f3c` docs+maps: исполнено решение maps-frame-size (эталон 1100×768 + адаптив по высоте) через цепь docs→code
- `62dc1be` docs(decisions): удалены отклонённые заметки EFT-extract-items/maps
- `7eac324` docs(maps): эпик fix-maps закрыт (3/7 сделано, 4 → бэклог)
- `bc4d28e` docs(maps): Ледокол — контент закрытия решения (статус ✅, секция v2-маркеры)
- `bc66544` docs(maps): Ледокол — решение закрыто (v2 маркеры готовы), перенос в decisions/done/
- `f5b40ba` fix(maps): Ледокол — Мирный атом перенесён на верный этаж (Склад/Охрана, floor 4)
- `96c620d` fix(maps): на карте подписи маркеров — по наведению (декаттер плотных палуб)
- `5d0c6d2` docs(maps): Ледокол — статус квест-маркеров (вариант 1) в шапке файла
- `81a006c` feat(maps): Ледокол — уточнены реальные позиции Замены масла + помечен лут-облако
- `d56c482` feat(maps): Ледокол — quest-маркеры (Судовая электрика сняты, цепочка привязана)
- `467def9` feat(maps): Ледокол — 10 quest-маркеров (3 побочных квеста)

### 2026-06-30
- `62f242f` feat(maps): quest-маркеры на статик-картах (questId/objectiveId)
- `8e84b7c` data(quests): рефреш каталога с tarkov.dev (510 + 10 сюжетных = 520)
- `a4d9a08` feat(maps): Ледокол — 53 маркера на 12 этажах (перенос с tarkov-market)
- `4bd0cba` wip(maps): Ледокол — маркеры пилота (этажи 0/1/2/4, 15 шт)
- `bc70637` feat(maps): Ледокол — soloFloors (видна только активная палуба)
- `5bffec2` docs(audit): закрыты A1/A2 (фикс Эпицентр/Стритс) + C3 Лабиринт; Карты ~95%
- `a17bd58` feat(maps): карта Лабиринт (labyrinth) — статик, одноэтажная
- `7d9151c` fix(nav): Эпицентр и Стритс открывались заглушкой из верхнего меню

### 2026-06-29
- `b17e524` feat(maps): инфо о рейде в нижней панели (Лаборатория)
- `2e4764d` feat(maps): компактный переключатель этажей (▲ / номер / ▼)
- `bcc4edc` feat(maps): инфо о рейде в нижней панели (Ледокол)
- `9415e28` fix(maps): кнопка ✕ закрывает редактор маркеров
- `a825402` feat(maps): редактор маркеров — категории спавна/лута/контейнеров + ширина 348px
- `4f6affe` feat(maps): редактор маркеров — кнопка «Правка», перетаскивание, режим удаления
- `22a350c` feat(maps): редактор маркеров статик-карт (?edit=1) + рендер ручных маркеров
- `44694fc` feat(maps): карта Ледокол (icebreaker) — статик v1, 14 палуб
- `9c968e2` feat(maps): хоткеи переключения этажей (↑↓ / +− / Alt+колесо) + тултип
- `5edfae9` docs: консолидация CSS-решения + архив done/ в журнале решений
- `8cc5a48` docs: account-real-data ✅ — живой сброс прогресса (слайс 3); роадмап
- `e364692` feat(account): живой «Сброс прогресса ЧВК» (была мёртвая кнопка)
- `9ff12c4` docs: account-real-data slice 2 (реальные данные/стата) ✅; роадмап
- `b0582d5` feat(account): реальные данные — «участник с» + стата, честные плейсхолдеры (slice 2)
- `b07142b` docs: account-real-data slice 1 (соцсети) ✅; роадмап обновлён
- `61c51db` feat(account): соц-привязки — ручные хендлы (account-real-data slice 1)

### 2026-06-28
- `b4bd524` docs: style-debt → ✅ (механика + типы); роадмап обновлён
- `c365f63` style(debt): убрать any — типизация фильтра/youtube/achievements/itemtile
- `b6c90a8` style(debt): механика — font-mono→font-blender-medium, rounded-[1px]→rounded-xs, бренд-HEX inline
- `af54f45` docs: supabase-jwt-fix → ✅ решено архитектурно; снят 🔴 из роадмапа
- `7568ac3` docs: решение vercel-skip-docs-builds → ✅ (первый прогон через engineering-loop)
- `f1ee8ef` chore(vercel): ignoreCommand — пропускать билд для docs-only пушей
- `117fa1b` docs(workflow): инженерный цикл ЦТА — гайд + шаблон спеки; разнёс глобальное правило
- `9f8c21a` docs: решение db-egress-reduction (Фаза 1+2) → ✅
- `951c4fe` perf(egress): getBartersByQuest на лёгкий индекс (Фаза 2 — хвост)
- `697b711` perf(egress): пререндер страниц категорий + мемоизация чтений (Фаза 2)
- `582d126` perf(egress): tarkov-context на лёгкий индекс цен (Фаза 2)
- `0788931` perf(egress): частичная выборка цен по id вместо всей таблицы (Фаза 1)
- `436a91e` perf(egress): in-memory TTL-кэш чтений каталога/цен (вторичный DB-egress)
- `c2813d5` docs: решение icon-hosting-r2 → ✅ (прод на R2, egress закрыт)
- `ddd1e70` feat(icons): раздача иконок предметов через Cloudflare R2 (zero egress)
- `e3da7fc` merge: влить origin/main (PR #1 фрейм + #2 The Lab) в ветку спринта
- `4546fa8` docs+feat(maps): заметки-решения спринта карт + калибровка bounds Terminal
- `b665851` feat(maps): UI-фиксы фрейма карт — решение maps-ui-fixes (6/7)
- `1fa2e83` docs: освежить дизайн-доки под v4 + текущий статус
- `f49602d` fix(build): ограничить скан Tailwind v4 до src/ — убрать порчу CSS из доков
- `6af86bb` chore(vscode): узел C цепи — tasks.json (REVIEW в один клик)
- `ffd5090` chore(docs-sync): Вариант 2 — авто-счётчики стиль-долга, code→docs pre-commit хук
- `fce4baf` docs+chore: исполнено решение dead-routes-cleanup (Вариант A) через цепь docs→code
- `8d10c55` docs+chore: исполнено решение claude-md-version (Next 14→16) через цепь docs→code

### 2026-06-27
- `9db742e` chore: перестать трекать !future-requests/ (личный scratch)
- `2813af2` docs: restructure vault into decisions/roadmap/state + Dataview status board

### 2026-06-26
- `d662564` chore(repo): housekeeping — игнор render/report-артефактов, актуализация maps-заметок и доков
- `5d5dcb8` Revert "feat(maps): интеграция The Lab (Лаборатория) + SVG-подложки карт"
- `c32a1f8` feat(maps): интеграция The Lab (Лаборатория) + SVG-подложки карт

### 2026-06-25
- `946868e` feat(icons): фильтр Twitch-дропсов в find-missing + бэкфилл 198->16
- `7f3c3d2` feat(maps): The Lab — статичная трёхэтажная карта (наш арт, NIGHTFALL) (#2)
- `ded109b` feat(icon-render): +3 icebreaker-кейкарты (чтение подписей с рендера) = 113
- `e2b234e` feat(icon-render): +IBX Gigachad (cryptocopro1) и DesmondPilak CD (cdcase) = 110
- `e7a7470` fix(icon-render): isGlass по имени шейдера, не по _HeatColor (ложные срабатывания)
- `4d02cad` fix(icon-render): камера-автофит (FOV-зум + центрирование) — резко и крупно
- `f5dadc2` fix(icon-render): авто-кроп вместо bounds-фитинга — носимые красиво заполняют кадр
- `c60dfd4` feat(maps): интерактивный фрейм локаций EFT (этажи, поиск, связь с квестами) (#1)
- `3f4b5e0` fix(icon-render): тугие границы для SkinnedMeshRenderer (броня/риги/маски)
- `752023c` feat(icon-render): резолв 95 недостающих новых предметов id->бандл (ultracode workflow)
- `5510e8c` feat(icon-render): авто-детект стекла + авто-тинт из иконки tarkov.dev
- `dfb2fa0` feat(icon-render): glass-оверрайд (стекло) + bgColor
- `16452bc` feat(icon-render): studio reflection-environment fallback + диагностика стекла

### 2026-06-24
- `18ec5e9` feat(icon-render): мастер-рендер 2048 -> webp 512 + 1024
- `7cfb77d` feat(icon-render): параметризуемый свет (keyEuler/intensity/ambient) per-job
- `c27ba61` feat(icon-render): свет Unity-рендера ярче + fill — ближе к tarkov.dev
- `3f66964` feat(icon-render): камера Unity ПИКСЕЛЬ-ТОЧНО — camera=Inverse(Icon.rotation)
- `53abaf8` fix(icon-render): pivotRotation для камеры Unity — ракурс совпал с tarkov.dev
- `ccb343f` feat(icon-render): пиксель-точный Unity-рендерер иконок (родной движок EFT)
- `8ca3c2e` docs(icon-render): план-спринт сверки ракурсов и материалов иконок по категориям
- `13de3ed` feat(maps): фрейм локаций как QuestMap — этажи, поиск, статистика, связь с квестами
- `d0ea41b` feat(icon-render): автономный пайплайн рендера иконок EFT из бандлов клиента
- `d328f19` feat(icons): автономный синк-крон зеркалирования недостающих 512px-иконок EFT
- `9f93a3f` feat(security): адаптивная капча Cloudflare Turnstile (login после 1 ошибки, register всегда)
- `d504e8c` fix(security): хардненинг по аудиту — profile-ocr, XFF, заголовки, кап тел
- `e581a86` feat(security): S5 app rate-limit на auth-роутах (Supabase rate_limits, без Upstash)
- `afa2fb5` feat(auth): регистрация (email+логин+пароль) + переверстка /login под NIGHTFALL
- `c172ff5` feat(auth): вход по username + глазик пароля; хардненинг login-роута
- `4e3b927` feat(auth): вход по e-mail+паролю + прямая установка пароля в кабинете
- `a511f47` fix(account): аватар через service-role (обход storage-RLS)
- `bfe3aeb` chore(scripts): db:login-link — генерация ссылки входа/сброса без письма
- `d034fad` fix(auth): /auth/confirm обрабатывает и token_hash, и code (дефолтный PKCE-шаблон)
- `c36c1d4` feat(account): Фаза 2-идентичность — логин/email/пароль/аватар на реальном auth
- `87ea6c9` feat(account): реальная личность в UI — Фаза 1
- `b2dddfc` feat(account): облачные игровые профили player_profiles (Фаза 2)
- `40fda2c` docs: апгрейд Agent Architecture в живой CTA-плейбук (v2.0)
- `5afae97` fix(security): Фаза 0 — open-redirect, крон fail-closed, авторизация profile-ocr
- `c339b72` fix(home): починка двойной кодировки ActiveContextBar (аудит мохибейка)

### 2026-06-23
- `d20cace` feat(eft/quests): бартеры в квестах + краф↔бартер (Этап 3)
- `10b726d` feat(eft/barters): кросс-линки + починка кодировки (Этап 2)
- `e1a6cbc` fix(eft/item): двунаправленные бартеры/крафты на карточке + кросс-линки (Этап 1)
- `2224054` feat(eft/maps): интерактивная карта Leaflet (Phase 4 фронт, v1)
- `10af0c0` feat(backend): mirror геометрии интерактивных карт (Phase 4)
- `17903de` feat(eft/codex): статьи Аудиозаписи и Документы (кодекс закрыт)
- `4f6fec5` chore(docs): чистка устаревших архитектурных доков
- `dc946fa` feat(eft/hideout): трекинг построенных уровней (Моё убежище)
- `5e2fbe5` feat(eft/craft-profit): гейты разблокировки станций из hideout_upgrades
- `2b7ff4e` feat(eft/needed): агрегатор предметов убежища (таб Квесты | Убежище)
- `1141bfd` feat(backend): mirror hideout_upgrades (требования апгрейдов убежища)
- `7298db8` feat(eft/codex): статьи Локации + Теории и загадки
- `1c9c1de` feat(eft/codex): лор-статьи (История мира/Хронология/Фракции/Корпорации) + индексы
- `ac93c4f` feat(eft/bosses): HP по зонам для всех 15 боссов (источник tarkov.dev)
- `6edfce2` feat(eft/quests): полноэкранный квест-таск /eft/quests/task/[id]
- `8bbcfd1` feat(eft/items): loot-tier — починка кодировки + тир-режим S–D
- `315b9cd` docs: спринт 404 — кодекс-торговцы готовы; loot-tier заблокирован кодировкой LootRateClient
- `03e74cd` feat(eft): кодекс — Торговцы (индекс + детали)
- `ba5f93b` docs: спринт 404 — журнал дня 2 (Phase 1B + вся Phase 2 готовы)
- `a676de4` feat(eft): Прибыль Bitcoin (2.3) + Престиж (2.5)
- `9eeda3d` feat(eft): «Нужные предметы» (2.4, квестовая часть) — агрегатор по предметам
- `68b5d57` feat(eft): калькулятор «Цена за слот» (2.1) — реактивный ₽/слот, тиры, налог барахолки
- `4df487e` feat(eft): закрыть все 404 + квесты (сюжетка/трейдеры), боссы, прибыль крафта

<!-- AUTO-COMMIT-LOG:END -->
