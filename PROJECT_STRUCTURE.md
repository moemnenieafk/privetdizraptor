# 🗺️ Архитектура Проекта (ctagg)

Данный файл является картой путей проекта (Next.js 14 App Router) и используется для контроля роутинга, связей и релинков.

## 📂 Корень проекта
```text
cta-project\
├── .env.local                 # Секретные ключи API (Twitch, YouTube и др.)
├── scripts/                   # Скрипты для автоматизации (например, sync-docs.mjs)
├── next.config.mjs            # Конфигурация Next.js
├── tailwind.config.ts         # Конфиг Tailwind CSS (если используется поверх v4)
├── tsconfig.json              # Конфиг TypeScript
├── package.json               # Зависимости и скрипты
├── README.md                  # Технический паспорт дизайн-системы
├── CHANGELOG.md               # История версий и изменений
└── PROJECT_STRUCTURE.md       # (Текущий файл) Карта файлов и директорий
```

## 📂 Статические файлы (public)
```text
public/
├── icons/                 # Огромная структурированная база системных и внутриигровых иконок
├── fonts/                 # Локальные шрифты (BlenderPro)
└── games/                 # Ассеты для хаба (обложки, видео, логотипы игр)
```

## 📂 Исходный код (src)
```text
src/
├── actions/
│   └── youtube.ts             # Server Actions для работы с API YouTube
│   └── search-actions.ts      # Server Actions для поиска предметов EFT
│
├── data/
│   ├── games.ts               # Данные для карточек игр на главной
│   ├── headerConfig.ts        # Конфигурация хедера (сборка меню, поиск, валюта)
│   ├── slang.ts               # Словарь игрового сленга для поиска
│   ├── pageContent.ts         # Словарь контента (заголовки, описания) для страниц
│   └── navigation/            # Модули навигации для разных игр
│       ├── eft.ts             # Дерево меню для EFT (300+ строк)
│       └── other-games.ts     # Дерево меню для остальных игр
│
├── hooks/
│   └── useIntersectionObserver.ts # Хук для ленивой загрузки (видео в карточках)
│
├── lib/
│   ├── eft-api.ts             # Интеграция с tarkov.dev GraphQL
│   └── search-engine.ts       # Движок поиска с поддержкой игрового сленга
│
├── store/
│   └── usePlayerStore.ts      # Zustand-хранилище профилей (Глобальный стейт)
│
├── components/
│   ├── layout/                # Глобальный каркас приложения
│   │   ├── Header.tsx         # Умная шапка сайта (2 строки)
│   │   ├── header-modules/    # Микро-модули для сборки Хедера
│   │   │   ├── PlatformLogo.tsx
│   │   │   ├── HeaderNavigation.tsx
│   │   │   ├── GameLogo.tsx   # Интерактивный GameSwitcher
│   │   │   ├── TacticalSearch.tsx     # Глобальный поиск
│   │   │   ├── SearchItemCard.tsx     # Карточка предмета в поиске
│   │   │   ├── SearchEmptyState.tsx   # Состояние "Ничего не найдено"
│   │   │   ├── PlayerTelemetry.tsx    # Панель телеметрии и профиля
│   │   │   ├── ProfileSettingsModal.tsx # Настройки профиля ЧВК
│   │   │   ├── ProfileResetModal.tsx    # Модалка сброса прогресса
│   │   │   ├── ProfileDeleteModal.tsx   # Модалка удаления ЧВК
│   │   │   ├── StreamStatus.tsx
│   │   │   ├── NewbieButton.tsx
│   │   │   └── NewbieModal.tsx
│   │   └── Footer.tsx         # Подвал сайта
│   ├── ui/                    # Переиспользуемые "глупые" компоненты (Dumb components)
│   │   ├── NavLink.tsx        # Ссылка с подсветкой активного состояния
│   │   ├── HubCard.tsx        # Карточка для внутренних хабов
│   │   ├── GameCard.tsx       # Карточка игры для главной страницы
│   │   ├── Breadcrumbs.tsx    # Хлебные крошки (EFT Хаб / Прогресс)
│   │   ├── PageHeader.tsx     # Стандартизированный заголовок страницы
│   │   └── Carousel.tsx       # Свайп-карусель
│   ├── providers/             # Провайдеры контекста
│   │   └── ThemeProvider.tsx  # Управление глобальной темой (классы theme-*)
│   ├── ColorPaletteDevTool.tsx# Инструмент разработчика для настройки палитры "на лету"
│   └── PlaceholderPage.tsx    # Универсальная страница-заглушка "В разработке"
│
├── styles/
│   └── icons.css              # Вынесенные CSS-классы для иконок
│
└── app/                       # РОУТИНГ (App Router)
    ├── globals.css            # Глобальные стили, шрифты, токены темы и анимации
    ├── layout.tsx             # Корневой Layout (влияет на весь сайт, включает ThemeProvider и Header)
    ├── template.tsx           # Глобальная анимация fade-in при переходах
    ├── page.tsx               # ГЛАВНАЯ СТРАНИЦА (Карусель игр)
    │
    ├── api/                   # API ROUTES
    │   └── twitch-status/
    │       └── route.ts       # Эндпоинт для проверки статуса Twitch
    │
    ├── [gameId]/              # ДИНАМИЧЕСКИЙ РОУТИНГ (FSD)
    │   └── page.tsx           # Универсальный обработчик хабов (заменяет статические папки)
    │
    ├── eft/                   # РАЗДЕЛ: ESCAPE FROM TARKOV (Специфичный роутинг)
    │   ├── layout.tsx         # Локальная обертка EFT (Хлебные крошки)
    │   ├── page.tsx           # Хаб EFT (импортируется в [gameId])
    │   │
    │   ├── items/             # Хаб "Предметы"
    │   │   ├── page.tsx
    │   │   └── ... (глубокая структура по категориям)
    │   │
    │   ├── quests/            # Хаб "Задания"
    │   │   └── page.tsx
    │   │
    │   ├── progress/          # Хаб "Прогресс"
    │   │   ├── page.tsx
    │   │   ├── achievements/
    │   │   │   └── page.tsx
    │   │   ├── barter/
    │   │   │   └── page.tsx
    │   │   ├── hideout/
    │   │   │   ├── page.tsx
    │   │   │   └── modules/
    │   │   │       └── page.tsx
    │   │   ├── loadouts/
    │   │   │   └── page.tsx
    │   │   ├── tracker/
    │   │   │   └── page.tsx
    │   │   └── keepitems/
    │   │       └── page.tsx
    │   │
    │   ├── gamesetting/       # Хаб "Кодекс"
    │   │   └── page.tsx
    │   │
    │   └── videos/            # Хаб "Видео"
    │       └── page.tsx
```
*(Папка `public` опущена в этой карте для экономии места, так как ее структура описана в `README.md`)*