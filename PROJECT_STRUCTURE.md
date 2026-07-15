# 🗺️ Архитектура Проекта CTA — Карта файлов

> Актуально на: **2026-06-15** · Версия: **4.2.0**  
> Next.js 14 App Router · FSD-lite · Tailwind CSS v4 · Zustand

---

## 📂 Корень

```
cta-project/
├── .env.local              # Ключи API (Twitch, YouTube) — в .gitignore
├── next.config.mjs         # Конфигурация Next.js
├── tsconfig.json           # TypeScript strict
├── package.json
├── postcss.config.mjs
├── CLAUDE.md               # Директивы для AI-ассистента
├── AGENTS.md               # Контекст проекта для агентов
├── CHANGELOG.md            # История версий
├── DESIGN_SYSTEM.md        # NIGHTFALL дизайн-система
├── MVPMANIFEST.md          # Индекс-указатель на источники истины (docs/, DESIGN_SYSTEM.md)
├── PROJECT_STRUCTURE.md    # (этот файл)
└── README.md               # Технический паспорт проекта
```

---

## 📂 public/

```
public/
├── fonts/
│   ├── BlenderPro-Book.woff / .woff2
│   └── BlenderPro-Medium.woff / .woff2
├── icons/
│   └── eft/
│       ├── 01-maps/        # Иконки локаций
│       ├── 02-quests/      # Иконки заданий
│       ├── 03-items/       # Иконки предметов
│       ├── 04-progression/ # Иконки прогресса
│       ├── 05-gamesetting/ # Иконки кодекса
│       ├── 06-videos/      # Иконки видео
│       ├── edition/        # Иконки изданий игры
│       ├── traders/        # Аватарки торговцев (.webp)
│       └── profile-pannel/ # Иконки панели профиля
├── images/
│   ├── items/eft/          # Изображения предметов ({id}.webp)
│   └── traders/eft/        # Аватарки торговцев ({normalizedName}.webp)
└── games/
    ├── eft/
    │   ├── bg.webp / bg-hover.webp / bg-inactive.webp
    │   ├── eft-logo.svg
    │   └── video-loop.mp4 / .webm
    ├── abi/ frago/ gzw/ actmat/ arcraiders/ marathon/ wardogs/
    │   └── (аналогичная структура)
    └── placeholder.webp
```

---

## 📂 src/

### Типы (`src/types/`)
```
types/
└── tarkov-items.ts     # Discriminated Unions для всех типов предметов EFT
```

### Server Actions (`src/actions/`)
```
actions/
├── search-actions.ts   # GraphQL поиск предметов EFT (для TacticalSearch)
└── youtube.ts          # Подгрузка видео с YouTube канала (ISR 1ч)
```

### Данные (`src/data/`)
```
data/
├── games.ts            # GAMES_DATA — карточки игр на главной
├── globals.css         # Глобальные стили, @theme токены, анимации, иконки
├── headerConfig.ts     # HEADER_DICTIONARY — вся навигация (меню, поиск, валюта)
├── pageContent.ts      # PAGE_CONTENT — заголовки и описания страниц
└── slang.ts            # SLANG_MAP — словарь игрового сленга для поиска
```

### Хуки (`src/hooks/`)
```
hooks/
├── useScrollHeader.ts          # Определение скролла с гистерезисом (50px/20px)
├── useIntersectionObserver.ts  # Ленивая загрузка видео в GameCard
└── useMediaQuery.ts            # Адаптивные брейкпоинты на клиенте
```

### Либы (`src/lib/`)
```
lib/
├── eft-api.ts               # GraphQL-хелперы tarkov.dev
├── eyewear-filter-config.ts # Логика субтипов Eyewear (визоры / ПНВ / очки)
├── formatters.ts            # formatCompactNumber, getCurrencySymbol
├── item-indicators.util.ts  # getDynamicTopIndicator + calculateContainerCapacity
├── search-engine.ts         # Движок поиска со сленгом (скоринг, fuzzy)
└── tarkov-colors.ts         # getTarkovBackgroundColor — маппинг backgroundColor → CSS
```

### Хранилища (`src/store/`)
```
store/
└── usePlayerStore.ts   # Zustand: профили ЧВК, уровни, репутация, фракция
```

---

## 📂 src/components/

### `ui/` — Переиспользуемые атомы (Server Components, props only)

```
ui/
├── kit/
│   ├── Badge.tsx         # Семантический бейдж (цвет, текст, иконка)
│   ├── MetricCard.tsx    # Карточка одной метрики (число + лейбл)
│   └── ProgressBar.tsx   # Прогресс-бар с цветовым кодированием
├── Breadcrumbs.tsx       # Хлебные крошки (авто по pathname)
├── Carousel.tsx          # Embla Carousel (свайп, адаптив)
├── GameCard.tsx          # Большая карточка игры (видео-ховер, маски)
├── HubCard.tsx           # Карточка внутреннего хаба (square / rect)
├── ItemGridSize.tsx      # Переключатель размера сетки предметов
├── NavLink.tsx           # Ссылка с подсветкой активного состояния
├── PageHeader.tsx        # Стандартизированный заголовок страницы (из pageContent)
└── RarityBadge.tsx       # Бейдж редкости (Обычное / Редкое / Эпическое / Легенда)
```

### `features/` — Умные компоненты с бизнес-логикой

```
features/
├── items/
│   │
│   ├── EftItemTile/              ← Composable tile (Compound Component паттерн)
│   │   ├── index.ts              # Re-export: { EftItemTile }
│   │   ├── types.ts              # EftItemData интерфейс
│   │   ├── context.ts            # React Context для данных тайла
│   │   ├── EftItemTile.tsx       # Root — обёртка карточки, Link, фон
│   │   ├── Header.tsx            # Верхняя строка (shortName + stat)
│   │   ├── Indicator.tsx         # Индикатор (размер ячейки, редкость)
│   │   ├── Media.tsx             # Область изображения предмета
│   │   ├── Name.tsx              # Блок названия
│   │   ├── Pricing.tsx           # Блок цен (trader / flea buy / sell)
│   │   └── tooltips/
│   │       ├── BarterTooltip.tsx # Тултип бартерного рецепта
│   │       ├── CraftTooltip.tsx  # Тултип крафта в убежище
│   │       └── QuestTooltip.tsx  # Тултип квестового использования
│   │
│   ├── ArmorFilterPanel.tsx      # Слайдеры диапазона класса брони (1–6)
│   ├── Badge.tsx                 # Семантический бейдж предметов (урон, пробитие...)
│   ├── CategoryControlBar.tsx    # Единая полоска фильтров категорийной страницы
│   ├── CategoryTabs.tsx          # Табы навигации по подкатегориям
│   ├── EyewearSubtypeBar.tsx     # Субтип-бар для Eyewear (очки / ПНВ / визоры)
│   ├── ItemTableRow.tsx          # Строка таблицы (legacy, для Items hub)
│   ├── ItemTile.tsx              # Тайл предмета (legacy, используется в barter)
│   ├── ItemsFilterPanel.tsx      # ⚠️ Orphaned — не используется в страницах
│   ├── ItemsTable.tsx            # Таблица предметов (legacy)
│   ├── ItemsViewSwitcher.tsx     # Переключатель Grid / Table (legacy)
│   ├── useCategoryFilters.ts     # Хук всего стейта фильтров категории
│   └── useItemsFilter.ts         # Хук фильтров (legacy, для Items hub)
│
├── telemetry/
│   ├── TacticalTelemetryCard.tsx # Карточка телеметрии (метрики матча)
│   └── TelemetryDetailsClient.tsx # Детали телеметрии (клиентский)
│
└── page.tsx                       # Hub-страница features (placeholder)
```

### `layout/` — Каркас приложения

```
layout/
├── ConditionalLayout.tsx          # Показывает/скрывает Header+Footer по маршруту
├── Footer.tsx
├── Header.tsx                     # Умная 2-строчная шапка (scroll-aware, theme-aware)
└── header-modules/
    ├── BurgerMenu.tsx             # Мобильное меню
    ├── GameLogo.tsx               # GameSwitcher (выпадающий список игр)
    ├── HeaderNavigation.tsx       # Рекурсивное меню (5+ уровней)
    ├── NewbieButton.tsx           # Кнопка "Я НОВИЧОК" с hazard-анимацией
    ├── NewbieModal.tsx            # Модалка для новичков
    ├── PlatformLogo.tsx           # Логотип CTA платформы
    ├── PlayerTelemetry.tsx        # Панель телеметрии и профиля ЧВК
    ├── ProfileDeleteModal.tsx     # Подтверждение удаления профиля
    ├── ProfileResetModal.tsx      # Подтверждение сброса прогресса
    ├── ProfileSettingsModal.tsx   # Настройки профиля ЧВК
    ├── SearchEmptyState.tsx       # Состояние "ничего не найдено"
    ├── SearchItemCard.tsx         # Карточка предмета в глобальном поиске
    ├── StreamStatus.tsx           # Статус Twitch-стрима
    └── TacticalSearch.tsx         # Command Palette (CTRL+Q)
```

---

## 📂 src/app/ — Роутинг (App Router)

```
app/
├── layout.tsx              # Корневой Layout (ThemeProvider, Header, Footer)
├── template.tsx            # Анимация fade-in при переходах
├── page.tsx                # Главная (карусель игр)
├── not-found.tsx           # 404 страница
│
├── [gameId]/
│   └── page.tsx            # Динамический хаб игры (из GAMES_DATA)
│
├── account/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── AccountCenter.tsx   # Персональный кабинет ЧВК
│   └── AccountHeader.tsx   # Шапка аккаунта
│
├── api/
│   └── twitch-status/
│       └── route.ts        # Эндпоинт Twitch OAuth (кэш токена в памяти)
│
└── eft/
    ├── layout.tsx           # EFT-обёртка (Breadcrumbs)
    ├── page.tsx             # EFT хаб
    │
    ├── barters/
    │   ├── BartersClient.tsx  # Клиент бартерных рецептов
    │   └── page.tsx
    │
    ├── gamesetting/
    │   └── page.tsx         # Кодекс EFT
    │
    ├── items/
    │   ├── page.tsx         # Items hub (barter items + CategoryTabs верхнего уровня)
    │   │
    │   ├── [...category]/
    │   │   ├── page.tsx             # SSR: typeMapping → GraphQL types; серверная фильтрация (secure→noFlea+__typename, cases, eyewear, medkits…); GP-бартеры параллельно
    │   │   └── ItemsCategoryClient.tsx  # Весь интерактив: grid/table, фильтры, virtualizer; CONTAINER_SLUGS = {cases, secure, secure-containers, storage-containers}
    │   │
    │   ├── item/[slug]/
    │   │   ├── page.tsx         # SSR детальной страницы предмета
    │   │   ├── ItemImage.tsx    # Компонент изображения предмета
    │   │   └── ItemModules.tsx  # Модули характеристик (Weapon/Armor/Medical...)
    │   │
    │   └── loot-rate/
    │       ├── LootRateClient.tsx  # Клиент статистики лут-рейта
    │       └── page.tsx
    │
    ├── maps/
    │   └── page.tsx         # Карты локаций (placeholder)
    │
    ├── progress/
    │   ├── page.tsx
    │   ├── achievements/
    │   │   ├── AchievementsClient.tsx  # Фильтр, сортировка, Grid/Table
    │   │   └── page.tsx               # RSC: данные из tarkov.dev
    │   ├── barter/page.tsx
    │   ├── hideout/
    │   │   ├── modules/page.tsx
    │   │   └── page.tsx
    │   └── loadouts/page.tsx
    │
    ├── questmap/
    │   ├── page.tsx          # Интерактивная карта квестов (react-flow / vis.js)
    │   ├── prapor.ts         # Данные квестов Прапора
    │   ├── skier.ts
    │   ├── therapist.ts
    │   ├── fence.ts
    │   ├── mechanic.ts
    │   ├── peacekeeper.ts
    │   ├── ragman.ts
    │   ├── jaeger.ts
    │   ├── lightkeeper.ts
    │   ├── ref.ts
    │   └── btrdriver.ts
    │
    ├── quests/
    │   ├── page.tsx
    │   ├── lore-quests/page.tsx
    │   └── side-quests/page.tsx
    │
    └── videos/
        └── page.tsx
```

---

## Принципы архитектуры

| Слой | Правило |
|------|---------|
| `ui/` | Server Component, только props, никакого состояния |
| `features/` | `"use client"`, Zustand разрешён, GraphQL разрешён |
| `layout/` | `"use client"`, управляет shell-ом приложения |
| `store/` | Только Zustand-сторы |
| `actions/` | Next.js Server Actions |
| `app/` | Роутинг, SSR-загрузка данных, передача в Client через props. Колокация `*Client.tsx` в route-папке — **норма** (не отклонение от FSD-lite) |

> **Колокация клиентских компонентов.** `*Client.tsx` живёт рядом со своим единственным роутом-потребителем в `app/`, а не в `features/` — это осознанное правило (идиоматика App Router), а не долг. В `features/` выносим только умные компоненты, переиспользуемые вне одного роута. Презентационные компоненты без состояния (только props) → `components/ui/`. Решение: `docs/decisions/fsd-lite-normalize.md` (2026-07-08).
