# CTA Landing — User Friendly 2.0
> Дата: 2026-06-17 · Ветка: main · Статус: Планирование

Документ расширяет `landing-page-sprints.md` и `landing-page-current-state.md`.
Цель — переход от Strict Terminal Brutalism к **Tactical Clarity**: сохранить ДНК военного интерфейса, но добавить скругления, модульную сетку и глубину карточек, заимствованных из `EftItemTile`, `HubCard`, `HubNav`.

---

## Стратегия: эволюция, а не революция

### Что было не так (Brutalism v1)
| Проблема | Где | Эффект |
|---|---|---|
| `border-radius: 0` везде | SupplyGrid, TacticalCartography, CommsHub | Интерфейс выглядит враждебно, не user-friendly |
| `gap-px` как единственный разделитель | SupplyGrid, CommsHub social links | Карточки сливаются, нет ощущения «предмета» |
| `max-w-480` (1920px) — игнорирует систему | SupplyGrid, TacticalCartography, CommsHub | Разрывает единую 1100px-сетку страницы |
| Нет hover-тени на карточках | SupplyGrid | Карточки не «оживают», нет feedback'а |
| Нет cascade-анимации | SupplyGrid items | Статичный рендер — скучно при первой загрузке |
| Hero-раздел без визуального якоря | HomeClient hero | Ничего не тянет взгляд вниз |
| `transition-none` везде глобально | Все блоки | Hover не ощущается, ощущение нереспонсивного UI |

### Что сохраняем
- **TerminalBoot** — анимация инициализации (не трогаем)
- **ActiveContextBar** — sticky-телеметрия (минимальные правки)
- **NIGHTFALL токены** — только design tokens, никаких raw HEX
- **Server Component паттерн** — page.tsx → props → Client
- **Шрифтовая система** — `font-blender-medium uppercase tracking-widest`
- **Цветовая семантика** — nvg-green / danger / tactical-amber / primary
- **Принцип информационной плотности** — никакого air UI

### Новые правила геометрии
```
v1 (Brutalism):   rounded-none  |  gap-px    |  max-w-480  |  transition-none
v2 (Clarity):     rounded-lg    |  gap-7     |  max-w-275  |  duration-300 ease-out
                  (8px radius)  |  (28px)    |  (1100px)   |  (только для shadow/border)
```

**Исключение:** `transition-none` сохраняется для color-инверсий на кнопках Hero — мгновенный feedback.
**Hover-тень:** добавляем `hover:shadow-[0_6px_28px_rgba(0,0,0,0.45)]` — тот же паттерн что в `EftItemTile.Root`.

---

## Модульная сетка (обязательно к применению)

Из `DESIGN_SYSTEM.md` §2: **6 колонок × 160px + gap 28px = 1100px**

```
┌─────────────────────────────────────────────────────────┐  max-w-275 (1100px)
│ col  col  col  col  col  col │
│ 160  28  160  28  160  28  160  28  160  28  160 │
└─────────────────────────────────────────────────────────┘
```

### CSS Grid классы для секций
```tsx
// Обёртка всех блоков лендинга
<div className="max-w-275 mx-auto px-4 lg:px-0">

// SupplyGrid — 3 колонки с gap-7 (28px)
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
// Каждая карточка ≈ 2 col-единицы = (1100 - 2×28) / 3 = 348px ← точь-в-точь HubCard!

// TacticalCartography — 2 зоны, split 5:7
<div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
  <div className="lg:col-span-5">  {/* task list */}
  <div className="lg:col-span-7">  {/* map context */}

// CommsHub videos — scroll внутри контейнера
// CommsHub social — 4 колонки с gap-7
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5"> {/* gap-3.5 = 14px */}
```

---

## Компонентная библиотека — переиспользование

### Паттерн "EftItemTile Card" → применяем в SupplyGrid
`EftItemTile.Root` использует:
```tsx
className="rounded-lg border border-lines-hover bg-card-menu p-4
           transition-all duration-300 ease-out
           hover:border-(--primary) hover:shadow-[0_6px_28px_rgba(0,0,0,0.45)]"
```
**SupplyGrid v2** должен использовать этот же класс-набор для каждой карточки.

### Паттерн "HubCard elevation" → применяем в TacticalCartography
`HubCard` использует:
```tsx
className="rounded-lg overflow-hidden border border-lines-hover bg-card-menu
           hover:border-primary/50 hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--primary)_15%,transparent)]
           hover:-translate-y-1 animate-[fade-in-up_0.6s_ease-out_both]"
style={{ animationDelay: `${index * 100}ms` }}
```
**TacticalCartography v2** — весь контейнер и квест-строки получают `rounded-lg` + hover-тень.

### Паттерн "HubNav icon block" → применяем в section-heading
`HubNav` left block:
```tsx
<div className="w-21 h-21 bg-(--color-darkbase) rounded-md flex items-center justify-center">
  <div className="w-10.5 h-10.5 bg-(--primary)" style={{ maskImage: `url(...)` }} />
</div>
```
**Section headings v2** — заменяем `h-px` gradient-dividers на иконку + блок как в HubNav.

### Паттерн "HubCard cascade animation"
```tsx
// На все grid-items добавляем
className="animate-[fade-in-up_0.6s_ease-out_both]"
style={{ animationDelay: `${index * 75}ms` }}
```

---

## Спринты

### Sprint 1 — Grid Foundation + Global Layout Fix
**Файлы:** `HomeClient.tsx`, все секции

**Задача:** выровнять все `max-w-480` → `max-w-275`, добавить правильные `px-4 lg:px-0` padding-отступы.

**Изменения:**
```tsx
// БЫЛО (все 3 секции)
<div className="max-w-480 mx-auto border border-lines-hover">

// СТАЛО
<div className="max-w-275 mx-auto">
```

Дополнительно — в `HomeClient.tsx` убираем `overflow-hidden` с корневого div (он режет cascade-анимации).

---

### Sprint 2 — SupplyGrid v2 — "Market Intelligence Cards"
**Файл:** `src/components/features/home/SupplyGrid.tsx`

**Концепция:** Каждая карточка = аналог `EftItemTile`, только для рыночных данных.
- `rounded-lg` вместо `border-radius: 0`
- `gap-7` (28px) вместо `gap-px`
- Hover: `hover:border-(--primary) hover:shadow-[0_6px_28px_rgba(0,0,0,0.45)]`
- Cascade fade-in: `animate-[fade-in-up_0.6s_ease-out_both]` с задержкой
- Кнопка-ссылка: карточка кликабельна → `/eft/items/item/{normalizedName}`

**Новая структура карточки:**
```tsx
<Link
  href={`/eft/items/item/${item.normalizedName}`}
  className="group flex flex-col rounded-lg border border-lines-hover bg-card-menu p-4
             transition-all duration-300 ease-out
             hover:border-(--primary) hover:shadow-[0_6px_28px_rgba(0,0,0,0.45)]
             animate-[fade-in-up_0.6s_ease-out_both]"
  style={{ animationDelay: `${index * 60}ms` }}
>
  {/* Верхняя строка: имя + trend badge */}
  <div className="flex items-start justify-between gap-2 mb-3">
    <p className="font-blender-medium text-xs uppercase tracking-wide text-text-primary leading-tight line-clamp-2 flex-1">
      {item.name}
    </p>
    <span className={`shrink-0 font-blender-medium text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5 rounded border ${
      changePos ? "text-nvg-green border-nvg-green/30 bg-nvg-green/5"
               : "text-danger border-danger/30 bg-danger/5"
    }`}>
      {changePos ? "▲" : "▼"} {formatPercent(item.changeLast48hPercent)}
    </span>
  </div>

  {/* Цена */}
  <p className="font-blender-medium text-sm text-text-secondary tabular-nums mb-1">
    {formatPrice(item.avg24hPrice)}
  </p>
  <p className="font-blender-medium text-[9px] text-text-muted tabular-nums mb-3">
    L {formatPrice(item.low24hPrice)} · H {formatPrice(item.high24hPrice)}
  </p>

  {/* Нижняя строка: buyback + trader */}
  <div className="flex items-center justify-between mt-auto gap-2">
    {item.bestTraderBuy && (
      <div className="flex items-center gap-1.5">
        <img
          src={`/images/traders/eft/${item.bestTraderBuy.vendorNormalizedName}.webp`}
          alt={item.bestTraderBuy.vendorName}
          width={16} height={16}
          className="w-4 h-4 rounded object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
        />
        <span className="font-blender-medium text-[9px] uppercase tracking-wide text-text-muted">
          {item.bestTraderBuy.vendorName}
        </span>
      </div>
    )}
    {item.bestTraderBuy && (
      <span className={`font-blender-medium text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded border ${
        buybackPos ? "text-nvg-green border-nvg-green/30 bg-nvg-green/5"
                   : "text-danger border-danger/30 bg-danger/5"
      }`}>
        BUY {formatPercent(item.buybackRatio * 100)}
      </span>
    )}
  </div>
</Link>
```

**Grid контейнер:**
```tsx
// БЫЛО
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-lines-hover max-w-480 mx-auto border border-lines-hover">

// СТАЛО
<div className="max-w-275 mx-auto">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
```

**Section heading v2 — без gradient lines, с иконкой:**
```tsx
<div className="max-w-275 mx-auto mb-8 px-4 lg:px-0">
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 rounded-md bg-(--color-darkbase) flex items-center justify-center shrink-0">
      <div className="w-5 h-5 bg-(--primary)" style={{ maskImage: "url(/icons/eft/04-progression/barter-profit.svg)", maskSize: "contain", maskPosition: "center", maskRepeat: "no-repeat" }} />
    </div>
    <div>
      <h3 className="font-blender-medium text-2xl lg:text-[28px] uppercase tracking-widest text-text-primary leading-none">
        МОНИТОРИНГ РЫНКА
      </h3>
      <p className="font-blender-medium text-[10px] tracking-[0.3em] uppercase text-text-muted mt-1">
        ВОЛАТИЛЬНЫЕ АКТИВЫ · АРБИТРАЖ · 24H
      </p>
    </div>
  </div>
</div>
```

---

### Sprint 3 — TacticalCartography v2 — "Ops Map"
**Файл:** `src/components/features/home/TacticalCartographyClient.tsx`

**Изменения:**
- Контейнер: `rounded-xl border border-lines-hover overflow-hidden` вместо `border border-lines-hover` без скруглений
- Квест-строки: `rounded-md` при active-state
- Right panel: добавить `rounded-r-xl` скругление

**Active task highlight:**
```tsx
// БЫЛО
className={`w-full text-left px-3 py-3 group transition-none ${
  hoveredTask?.id === task.id
    ? "bg-(--primary)/5 border-l-2 border-l-(--primary)"
    : "border-l-2 border-l-transparent hover:bg-lines-hover/40"
}`}

// СТАЛО
className={`w-full text-left px-3 py-2.5 mx-2 rounded-md group transition-all duration-200 ${
  hoveredTask?.id === task.id
    ? "bg-(--primary)/8 ring-1 ring-(--primary)/30"
    : "hover:bg-lines-hover/40"
}`}
```

Контейнер задачи получает `rounded-xl overflow-hidden` и `shadow-[0_4px_24px_rgba(0,0,0,0.4)]`.

**Bottom CTA:**
```tsx
// Заменяем `border-x border-b` → отдельная кнопка под контейнером
<div className="flex justify-between items-center mt-4">
  <p className="font-blender-medium text-[9px] tracking-[0.25em] uppercase text-text-muted">
    {tasks.length} КАППА КВЕСТОВ
  </p>
  <Link
    href="/eft/questmap"
    className="font-blender-medium text-[10px] tracking-[0.25em] uppercase
               border border-lines-hover px-4 py-2 rounded
               hover:border-(--primary)/60 hover:text-(--primary) hover:bg-(--primary)/5
               transition-all duration-200"
  >
    ПОЛНАЯ КАРТА КВЕСТОВ →
  </Link>
</div>
```

---

### Sprint 4 — Hero Section v2 — "Tactical Entry"
**Файл:** `src/components/features/home/HomeClient.tsx` (hero block)

**Концепция:** Добавить три feature-карточки под CTA-кнопками, чтобы пользователь сразу видел, что за разделы ждут ниже — визуальный "preview scroll" лендинга.

**Структура hero v2:**
```
[w-px h-10 gradient line]
ЦЕНТР ТАКТИЧЕСКОЙ АДАПТАЦИИ        ← text-text-muted tracking-[0.45em]
ЦТА ХАБ                            ← text-[56px] font-blender-medium
// АГРЕГАЦИЯ РАЗВЕДДАННЫХ...        ← text-text-secondary

[БАЗА ДАННЫХ / EFT]  [АВТОРИЗАЦИЯ УЗЛА]  ← кнопки (transition-none, мгновенный hover)

[w-px h-6 gradient line]

┌───────────────┬───────────────┬───────────────┐   ← 3 preview-карточки
│  МОНИТОРИНГ   │  КАРТОГРАФИЯ  │  КОМ. УЗЕЛ    │
│  РЫНКА        │  РЕЙДОВ       │  FULLKAMEN    │
│               │               │               │
│  Арбитраж     │  Kappa        │  YouTube +    │
│  барахолки    │  квесты       │  Twitch       │
└───────────────┴───────────────┴───────────────┘
```

**Feature card JSX:**
```tsx
interface HeroFeatureCard {
  icon: string;
  title: string;
  description: string;
  anchor: string;   // id секции для scroll
}

const HERO_FEATURES: HeroFeatureCard[] = [
  {
    icon: "/icons/eft/04-progression/barter-profit.svg",
    title: "МОНИТОРИНГ РЫНКА",
    description: "Волатильные активы, арбитраж торговцев, Buyback Ratio в реальном времени",
    anchor: "#supply",
  },
  {
    icon: "/icons/eft/02-quests/kappa.svg",
    title: "ТАКТИЧЕСКАЯ КАРТОГРАФИЯ",
    description: "Kappa-квесты с контекстом локации, маршруты рейда",
    anchor: "#cartography",
  },
  {
    icon: "/icons/eft/04-progression/stream.svg",
    title: "КОМ. УЗЕЛ",
    description: "Сводки fullkamen, каналы сообщества, YouTube-архив",
    anchor: "#comms",
  },
];

// Карточка — паттерн HubCard, но компактнее
<a
  href={card.anchor}
  className="flex flex-col gap-3 rounded-lg border border-lines-hover bg-card-menu/60 p-4
             hover:border-(--primary)/50 hover:bg-card-menu hover:shadow-[0_6px_28px_rgba(0,0,0,0.45)]
             transition-all duration-300 group"
>
  <div className="w-8 h-8 rounded-md bg-(--color-darkbase) flex items-center justify-center">
    <div className="w-4 h-4 bg-text-primary group-hover:bg-(--primary) transition-colors duration-300"
         style={{ maskImage: `url(${card.icon})`, maskSize: "contain", maskPosition: "center", maskRepeat: "no-repeat" }} />
  </div>
  <div>
    <p className="font-blender-medium text-[11px] uppercase tracking-widest text-text-primary group-hover:text-(--primary) transition-none">
      {card.title}
    </p>
    <p className="font-blender-medium text-[9px] tracking-wide uppercase text-text-muted mt-1 leading-relaxed">
      {card.description}
    </p>
  </div>
</a>
```

Grid для hero features:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6 w-full max-w-275">
  {HERO_FEATURES.map((card) => (...))}
</div>
```

---

### Sprint 5 — CommsHub v2 — "Signal Intercept"
**Файл:** `src/components/features/home/CommsHub.tsx`

**Изменения:**
- Главный контейнер: `rounded-xl overflow-hidden border border-lines-hover` — снять острые углы
- Видео-карточки `VideoCard`: добавить `rounded-lg overflow-hidden` + hover-тень
- Social links grid: `gap-3.5` (14px) + `rounded-lg` на каждой ячейке вместо `gap-px bg-lines-hover`
- Thumbnail: `rounded-t-lg overflow-hidden` чтобы соответствовать карточке

**VideoCard v2:**
```tsx
<div
  className="w-70 sm:w-80 lg:w-87 shrink-0 snap-center flex flex-col
             rounded-lg overflow-hidden border border-lines-hover
             hover:border-(--primary)/50 hover:shadow-[0_6px_28px_rgba(0,0,0,0.35)]
             transition-all duration-300 group cursor-pointer"
  onClick={() => setIsPlaying(true)}
>
```

**Social links v2:**
```tsx
// БЫЛО
<div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-lines-hover border border-lines-hover">
  {link → <a className="bg-base px-3 py-3 ...">}

// СТАЛО
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
  {SOCIAL_LINKS.map((link) => (
    <a
      className="flex flex-col gap-0.5 rounded-lg border border-lines-hover bg-card-menu px-3 py-3
                 hover:border-(--primary)/50 hover:bg-(--primary)/5
                 transition-all duration-200 group"
    >
```

---

### Sprint 6 — ActiveContextBar v2 — Minor Polish
**Файл:** `src/components/features/home/ActiveContextBar.tsx`

**Изменения (минимальные):**
- `max-w-480` → `max-w-275` — выровнять с остальными блоками
- Добавить `rounded` на status-dot `w-1.5 h-1.5` → `rounded-full` (визуально мягче)
- Сохранить `transition-none` на всех элементах

```tsx
// БЫЛО
<div className="flex h-9 items-stretch divide-x divide-lines-hover max-w-480 mx-auto px-4 md:px-8">

// СТАЛО
<div className="flex h-9 items-stretch divide-x divide-lines-hover max-w-275 mx-auto px-4 lg:px-0">
```

```tsx
// status dot
<span className={`shrink-0 w-1.5 h-1.5 rounded-full ${serverOnline ? "bg-nvg-green" : "bg-danger"}`} />
```

---

### Sprint 7 — Section Headings System
**Цель:** Унифицировать все 4 section headings (`МОНИТОРИНГ РЫНКА`, `ТАКТИЧЕСКАЯ КАРТОГРАФИЯ`, `КОММУНИКАЦИОННЫЙ УЗЕЛ`, `ВЫБЕРИ ВСЕЛЕННУЮ`)

**Создать:** `src/components/features/home/SectionHeading.tsx`

```tsx
interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  iconUrl?: string;
  id?: string;   // для anchor-scroll из hero cards
}

export function SectionHeading({ title, subtitle, iconUrl, id }: SectionHeadingProps) {
  return (
    <div id={id} className="flex items-center gap-4 mb-8">
      {iconUrl && (
        <div className="w-10 h-10 rounded-md bg-(--color-darkbase) shrink-0 flex items-center justify-center">
          <div
            className="w-5 h-5 bg-(--primary)"
            style={{
              maskImage: `url(${iconUrl})`,
              maskSize: "contain",
              maskPosition: "center",
              maskRepeat: "no-repeat",
              WebkitMaskImage: `url(${iconUrl})`,
              WebkitMaskSize: "contain",
              WebkitMaskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
            }}
          />
        </div>
      )}
      <div>
        <h2 className="font-blender-medium text-2xl lg:text-[28px] uppercase tracking-widest text-text-primary leading-none">
          {title}
        </h2>
        {subtitle && (
          <p className="font-blender-medium text-[10px] tracking-[0.3em] uppercase text-text-muted mt-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
```

Заменяет текущие gradient-line heading'и во всех секциях.

---

### Sprint 8 — Game Carousel Section v2
**Файл:** `src/components/features/home/HomeClient.tsx` (carousel block)

**Изменения:**
- Section heading — использовать `SectionHeading` компонент
- Добавить padding-отступ `px-4 lg:px-0` и `max-w-275 mx-auto` для heading
- Carousel сам остается edge-to-edge (без ограничения) — это визуально правильно
- GameCard — если не `rounded-lg`, добавить

---

## Итоговая таблица спринтов

| # | Sprint | Файлы | Сложность | Статус |
|---|--------|-------|-----------|--------|
| 1 | Grid Foundation — max-w fix | `SupplyGrid.tsx`, `TacticalCartographyClient.tsx`, `CommsHub.tsx`, `ActiveContextBar.tsx` | Низкая | ⏳ |
| 2 | SupplyGrid v2 — EftItemTile cards | `SupplyGrid.tsx` | Средняя | ⏳ |
| 3 | TacticalCartography v2 — rounded | `TacticalCartographyClient.tsx` | Средняя | ⏳ |
| 4 | SectionHeading system | `SectionHeading.tsx` (новый) + все секции | Низкая | ⏳ |
| 5 | Hero v2 — feature preview cards | `HomeClient.tsx` | Средняя | ⏳ |
| 6 | CommsHub v2 — rounded cards | `CommsHub.tsx` | Низкая | ⏳ |
| 7 | ActiveContextBar v2 — minor polish | `ActiveContextBar.tsx` | Минимальная | ⏳ |
| 8 | Game Carousel section heading | `HomeClient.tsx` | Минимальная | ⏳ |

---

## Визуальные принципы v2 (delta от v1)

| Свойство | v1 (Brutalism) | v2 (Clarity) | Обоснование |
|----------|---------------|-------------|-------------|
| `border-radius` | `0` (rounded-none) | `rounded-lg` (8px) | Matching EftItemTile — это уже система |
| `gap` в гридах | `gap-px` (1px) | `gap-7` / `gap-3.5` | Карточки получают breathing room |
| `max-width` | `max-w-480` (1920px) | `max-w-275` (1100px) | Единая 6-col сетка проекта |
| hover shadow | none | `shadow-[0_6px_28px_rgba(0,0,0,0.45)]` | EftItemTile паттерн |
| hover border | `transition-none` | `transition-all duration-300` | Только для shadow/border, не для цвета |
| cascade anim | none | `fade-in-up` + delay | HubCard паттерн — живость при загрузке |
| кликабельность | карточки не кликабельны | Link → item page | Интеграция с разделами |
| section heading | h-px gradient lines | icon block + title | HubNav паттерн |

---

## Что НЕ меняем

- `transition-none` на Hero-кнопках — мгновенная инверсия цвета (Brutalism ДНК)
- TerminalBoot animation — без изменений
- Цветовые токены — только NIGHTFALL, никакого raw HEX
- `font-blender-medium uppercase` для всех заголовков
- `font-mono` остается под запретом
- `tabular-nums` на всех ценах и таймерах
- NIGHTFALL семантика цветов: nvg-green / danger / tactical-amber / primary
- Server→Client prop паттерн для SupplyGrid и TacticalCartography

---

## Файлы в работе

| Файл | Спринт | Изменение |
|------|--------|-----------|
| `src/components/features/home/SupplyGrid.tsx` | 1, 2 | grid → gap-7, карточки → rounded-lg, Link |
| `src/components/features/home/TacticalCartographyClient.tsx` | 1, 3 | rounded-xl container, task-row polish |
| `src/components/features/home/CommsHub.tsx` | 1, 6 | rounded-xl container, VideoCard rounded-lg |
| `src/components/features/home/ActiveContextBar.tsx` | 7 | max-w-275, rounded-full dot |
| `src/components/features/home/HomeClient.tsx` | 4, 5, 8 | hero feature cards, heading fix |
| `src/components/features/home/SectionHeading.tsx` | 4 | новый компонент (создать) |

---

## Связи с другими документами

- `landing-page-current-state.md` — базовое состояние блоков
- `landing-page-sprints.md` — оригинальный план (v1 Brutalism)
- `DESIGN_SYSTEM.md` §2 — 6-col 160px grid, max-w-275
- `src/components/features/items/EftItemTile/EftItemTile.tsx` — card паттерн
- `src/components/features/items/HubNav.tsx` — icon block паттерн
- `src/components/ui/HubCard.tsx` — elevation + cascade паттерн
