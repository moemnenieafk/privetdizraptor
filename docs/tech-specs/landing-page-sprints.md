# CTA Landing Page — Итерационный план реализации

> Живой документ. Статус обновляется после каждой итерации.
> Тег для быстрого обращения: `@gemini-deep-research/tech-specs/landing-page-sprints.md`

---

## Концепция: Tactical Brutalism + Cassette Futurism

Лендинг CTA — это не маркетинговый сайт, а **тактический терминал**. Каждый блок вместо красивых картинок даёт реальную игровую пользу: статус серверов, цены барахолки, таймеры торговцев.

**Ключевые визуальные правила:**
- 0px border-radius везде — только острые углы
- Разделители: 1px solid `border-lines-hover` (#313135), а не тени
- Hover: мгновенная инверсия цвета (`transition-none`), без плавности
- Типографика: `font-blender-medium uppercase tracking-widest` для заголовков
- Числа/цены/таймеры: `font-blender-medium text-xs tabular-nums`
- Скелетоны: диагональная штриховка вместо серого пульса

---

## Семантика цветов (обязательно для лендинга)

| Роль | Токен Tailwind | HEX | Применение |
|------|---------------|-----|------------|
| Акцент / онлайн | `text-(--primary)` / `bg-(--primary)` | #E68E25 | Кнопки, активные элементы |
| Прибыль / успех | `text-nvg-green` | #689963 | Buyback ratio ≥ 0, сервер онлайн |
| Таймер / предупреждение | `text-tactical-amber` | #E68E25 | Таймеры торговцев, активные квесты |
| Убыток / опасность | `text-danger` | #C24339 | Buyback ratio < 0, сервер офлайн |
| Второстепенный текст | `text-text-secondary` | #9696A1 | Подписи, метрики |
| Граница | `border-lines-hover` | #313135 | Разделители секторов, карточки |

**Формулы:**
```
Buyback Ratio = bestTraderSellPrice / avg24hPrice - 1
  > 0  → зелёный (выгодно)
  < 0  → красный (убыток)

Δ% flea = changeLast48hPercent (поле из tarkov.dev API)
```

---

## Статус блоков

| # | Блок | Итерация | Статус |
|---|------|----------|--------|
| 1 | Terminal Boot Hero | Итерация 1 | ✅ Готово |
| 2 | Active Context Bar | Итерация 2 | ✅ Готово |
| 3 | Supply Database Grid | Итерация 3 | ✅ Готово |
| 4 | Tactical Cartography (карта + квесты) | Будущее | ⏳ Планируется |
| 5 | Comms Network Hub (fullkamen) | Будущее | ⏳ Планируется |
| 6 | Diagnostics Footer | Итерация 4 | ✅ Готово |

---

## Итерация 1 — Terminal Boot Hero Section

**Статус: ✅ Готово**

**Цель:** Заменить простой прелоадер (3 пульсирующие точки) на терминальную boot-последовательность. Добавить Hero-блок с CTA-кнопками над каруселью игр.

### Файлы

| Файл | Действие | Описание |
|------|----------|----------|
| `src/components/features/home/TerminalBoot.tsx` | Создать | Новый клиентский компонент |
| `src/app/page.tsx` | Изменить | Hero-блок + замена прелоадера |

### TerminalBoot.tsx — логика

```
Строки boot-лога (выводятся одна за другой с интервалом ~160ms):
> ИНИЦИАЛИЗАЦИЯ ЦТА...
> ЗАГРУЗКА МОДУЛЕЙ РАЗВЕДКИ...
> ПОДКЛЮЧЕНИЕ К API TARKOV.DEV...
> ЦЕНТР ТАКТИЧЕСКОЙ АДАПТАЦИИ // СИСТЕМА ОНЛАЙН  ← цвет: text-(--primary)

Всего: ~640ms + 200ms задержка → onComplete()
```

**Стиль строк:** `font-blender-medium text-xs tracking-[0.3em] uppercase text-text-secondary`
**Последняя строка:** `text-(--primary)`
**Курсор:** `inline-block w-2 h-3.5 bg-(--primary) animate-pulse`

### Hero-блок — структура

```
[вертикальная линия акцента сверху]
ЦЕНТР ТАКТИЧЕСКОЙ АДАПТАЦИИ         ← text-xs text-text-muted tracking-[0.4em]
ЦТА ХАБ                             ← text-5xl lg:text-6xl font-blender-medium uppercase
// АГРЕГАЦИЯ РАЗВЕДДАННЫХ...        ← text-xs text-text-secondary tracking-[0.3em]
[кнопка 1] [ БАЗА ДАННЫХ / EFT ]   ← border-(--primary), hover: bg-(--primary) text-base
[кнопка 2] [ АВТОРИЗАЦИЯ УЗЛА ]    ← border-lines-hover, hover: border-(--primary)
[вертикальная линия акцента снизу]
```

**Правило кнопок:** `transition-none` — мгновенная инверсия, без CSS transition.

### Изменения в page.tsx (Итерация 1)

- Прелоадер JSX → `<TerminalBoot onComplete={() => setIsLoading(false)} />`
- Добавить Hero-секцию выше карусели
- Heading карусели: `ВЫБЕРИ ИГРУ` → `ВЫБЕРИ ВСЕЛЕННУЮ`
- Остальное (`"use client"`, carousel, videos) не трогаем до Итерации 2

---

## Итерация 2 — Active Context Bar

**Статус: ⏳ Планируется**

**Цель:** Sticky телеметрическая панель под хедером с живыми данными из tarkov.dev.

### Файлы

| Файл | Действие | Описание |
|------|----------|----------|
| `src/actions/tarkov-context.ts` | Создать | Server action: статус + flea + таймеры |
| `src/components/features/home/ActiveContextBar.tsx` | Создать | Server Component, 3 сектора |
| `src/components/features/home/TraderCountdown.tsx` | Создать | `"use client"` — живой обратный отсчёт |
| `src/components/features/home/HomeClient.tsx` | Создать | Клиентский остаток page.tsx |
| `src/app/page.tsx` | Изменить | Конвертация в async Server Component |

### GraphQL-запросы (tarkov.dev)

```graphql
# 1. Статус серверов
query { status { currentStatuses { name status } } }

# 2. Топ волатильных предметов барахолки
query { items(limit: 5) { name avg24hPrice changeLast48hPercent } }

# 3. Таймеры торговцев
query { traders { name resetTime } }
```

**Cache:** `{ next: { revalidate: 60 } }` — обновление каждую минуту.

### Структура ActiveContextBar

```
sticky top-[var(--header-height)] z-40 border-b border-lines-hover bg-base/95

[LEFT w-48] [1px divider] [CENTER flex-1] [1px divider] [RIGHT w-48]
  Сервер EFT         Тикер барахолки (scroll)      Таймер торговца
  🟢 ONLINE          AKS-74U · Δ+12.3%             ПРАПОР
  (или 🔴 OFFLINE)   Bitcoin · Δ-5.1%              HH:MM:SS ← amber
```

**Тикер:** CSS `@keyframes` бегущая строка. Δ+ → `text-nvg-green`, Δ- → `text-danger`.
**Таймер:** pulsate (`animate-pulse`) при < 60 секунд.

---

## Итерация 3 — Supply Database Grid

**Статус: ⏳ Планируется**

**Цель:** Сетка топ-12 волатильных предметов с Buyback Ratio между ActiveContextBar и каруселью.

### Файлы

| Файл | Действие | Описание |
|------|----------|----------|
| `src/types/supply.ts` | Создать | TypeScript тип SupplyItem |
| `src/actions/tarkov-supply.ts` | Создать | GraphQL + buyback расчёт |
| `src/components/features/home/SupplyGrid.tsx` | Создать | Server Component, grid layout |
| `src/app/page.tsx` | Изменить | Добавить fetch + `<SupplyGrid>` |

### GraphQL-запрос

```graphql
query {
  items(limit: 12) {
    name
    normalizedName
    avg24hPrice
    basePrice
    changeLast48hPercent
    sellFor {
      price
      vendor { name }
    }
  }
}
```

**Сортировка:** по `|changeLast48hPercent|` по убыванию.
**Cache:** `{ next: { revalidate: 120 } }`.

### Структура карточки

```
[bg-base border-lines-hover] — no individual border, gap-px trick
  ITEM NAME                 ← font-blender-medium text-xs uppercase
  ₽ 45,000                  ← avg24hPrice
  [Δ+12.3%]                 ← badge: nvg-green (positive) / danger (negative)
  [BUYBACK: +8%]            ← badge: nvg-green (≥0) / danger (<0)
  [1px bottom accent bar в bg-(--primary)]
```

**Grid:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-lines-hover`
(gap-px + фон контейнера = 1px разделители без border на каждом элементе)

**Heading:** `МОНИТОРИНГ РЫНКА // ВОЛАТИЛЬНЫЕ АКТИВЫ`

---

## После всех итераций: SKILL cta-landing

Создать `.claude/skills/cta-landing.md` с:
- Иерархией компонентов лендинга
- Паттернами data-fetch для ActiveContextBar и SupplyGrid
- Правилами токенов специфичными для лендинга
- Паттернами анимаций (typewriter, ticker, countdown)

**Trigger:** читать перед редактированием любого файла в `src/components/features/home/`.
