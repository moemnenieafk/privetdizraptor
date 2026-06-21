# Sprint: Items Ecosystem Redesign

> Статус: **Спринты 1–5 выполнены** (сессия 2026-06-21). Спринт завершён.
>
> **Готово (1–4):** useFavoritesStore · useInventoryStore · useItemsStore+compareIds · EftItemTile Header(★+quest) · Media(h-30) · types(questCount/inventoryCount) · useCategoryFilters(favoritesOnly) · CategoryControlBar(★ кнопка) · FavoritesStrip · CompareDrawer · ItemsCategoryClient(questCountMap+favoritesOnly) · page.tsx(GQL+weight+tasks+containers) · SlotGrid · ItemActions · ItemPriceBlock
>
> **Готово (5):** ItemDetailLayout (2-колонки + full-width секции, подключены SlotGrid/ItemActions/ItemPriceBlock) · ItemQuestBlock (usedInTasks + completedQuests strike) · SimilarItems (фетч по bsgCategoryId) · LootSources → «Откуда получить» (receivedFromTasks) · page.tsx(GQL +backgroundColor +bsgCategoryId, getSimilarItems, рендер через ItemDetailLayout) · переиспользованы Module-панели характеристик из ItemModules.tsx
>
> **Багфикс роута:** `containedInContainers` НЕ существует на типе `Item` в схеме tarkov.dev (унаследовано из Спринта 4) — это ломало ВЕСЬ GQL-запрос, `getItemData()` возвращал null → `notFound()` → 404 на каждом предмете. Заменено на валидное `receivedFromTasks`. API не отдаёт item→loot-контейнеры через Item; «места падения» на карте требуют отдельного источника данных (maps/lootContainers) — вынести в отдельный спринт.

---

## ЧАСТЬ А: Страница предмета `/eft/items/item/[slug]`

### Макет

```
┌─────────────────────────────────────────────────────────────────┐
│                    Breadcrumbs + PageHeader                      │
├────────────────────┬── gap-7 ──┬─────────────────────────────── │
│  ЛЕВАЯ (w-87=348px)│           │  ПРАВАЯ (flex-1)               │
│                    │           │                                 │
│  ┌───────────────┐ │           │  Item Name (text-3xl uppercase) │
│  │               │ │           │  shortName · 1.2 кг · 2×3      │
│  │  Item Image   │ │           │                                 │
│  │   348×348px   │ │           │  ─── Цены ──────────────────── │
│  │               │ │           │  ┌──────────┬──────────┐       │
│  └───────────────┘ │           │  │Купить Торг│Купить Бар│       │
│                    │           │  ├──────────┼──────────┤       │
│  Slot grid W×H     │           │  │Продать Т. │Продать Б.│       │
│  ██ ██             │           │  └──────────┴──────────┘       │
│  ██ ██             │           │                                 │
│                    │           │  ─── Характеристики ──────────  │
│  Badges:           │           │  Класс броне / Прочность /      │
│  [Бартер][Квест]   │           │  Вместимость / Калибр / etc.   │
│  [Без бар.][Кл.X]  │           │                                 │
│                    │           │  ─── Нужен в квестах (N) ─────  │
│  [★ Избр][⚖ Сравн] │           │  [QuestMap mini-card]           │
│  [─] [0] [+]       │           │  [QuestMap mini-card]           │
└────────────────────┴───────────┴─────────────────────────────── │

── Секции ниже (полная ширина) ─────────────────────────────────────
  Бартеры | Крафт | Похожие предметы | Лут-карта / Места падения
```

### Левая колонка (w-87 = 348px, shrink-0)

**1. Image frame (348×348)**
- Фон: `getTarkovBackgroundColor(item.backgroundColor)` — тинт по цвету предмета
- Внутренняя тень: `shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]`
- Изображение: `object-contain p-4`, hover scale-105 transition
- Corner badges: Barter/Craft/Quest индикаторы — как в EftItemTile.Indicator

**2. Slot Grid** (новый компонент `SlotGrid.tsx`)
- `W × H` ячеек в CSS grid
- Каждая ячейка: ~14px, серая рамка, gap-px
- Ячейки закрашены accent-цветом — форм-фактор предмета в инвентаре
- Подпись: `{W}×{H} = {W*H} слотов`

**3. Type badges** (flex-wrap gap-2)
- Генерируются из `item.types[]`:
  - `noFlea` → бейдж "Без бар." (красный)
  - `barter` → бейдж "Бартер" (amber)
  - `quest` → бейдж "Квест" (accent)
  - `wearable` → бейдж "Носимый" (серый)
- Класс брони: если `properties.class` → бейдж "Класс X" с `icon-eft-armor-class-X`

**4. Action buttons** (grid grid-cols-2 gap-2)
- `★ Избранное` / `☆ Добавить` → `useFavoritesStore.toggleFavorite(id)`
- `⚖ Сравнить` → `useItemsStore.toggleCompare(id)`

**5. Inventory tracker** (full-width row)
- `[─]  [число]  [+]` → `useInventoryStore`
- Если 0: dim-состояние, текст "Нет в наличии"

---

### Правая колонка (flex-1)

**1. Header блок**
- Название: `font-blender-medium text-3xl uppercase tracking-widest`
- Строка 2: `shortName · {weight} кг · {W}×{H}`

**2. Price block (2×2 grid)**
```
┌─────────────────────┬─────────────────────┐
│  Купить у торговца  │  Купить на бар.     │
│  [иконка] Цена      │  [монета] Цена      │
├─────────────────────┼─────────────────────┤
│  Продать торговцу   │  Продать на бар.    │
│  [иконка] Цена ↑   │  [монета] Цена      │
└─────────────────────┴─────────────────────┘
```
- Лучшая цена выделена `text-(--primary)`

**3. Key characteristics** (зависит от `properties.__typename`)
- Каждая строка: label (muted) | value (primary/white)
- Armor/Helmet: Class / Durability / ArmorType / Penalties
- Guns: Caliber / Ergo / Recoil V/H / FireRate
- Ammo: Caliber / Damage / Penetration / ArmorDamage / Frag
- Mods: Ergonomics / RecoilModifier
- Containers/Backpacks: Capacity / Ratio
- Meds: HP / Uses / Cures
- Headphones: DistanceModifier / AmbientVolume

**4. Quest mini-cards** (QuestMap-стиль)
- Source: `useQuestStore.tasks` → фильтр по `item.id` в objectives
- Каждая карточка: аватар торговца + название квеста + нужное количество
- Клик → `/eft/questmap`
- Если квестов нет → секция скрыта

---

### Секции ниже (full-width, вкладки или последовательно)

1. **Бартеры** — таблица: отдаю → получаю (переделать `ItemModules.tsx`)
2. **Крафт** — таблица: ингредиенты + станция (переделать `ItemModules.tsx`)
3. **Похожие предметы** — горизонтальный скролл мини-тайлов из той же BSG-категории
4. **Лут-карта** — источники: `containedInContainers` из API

---

### Файлы — Страница предмета

| Действие | Файл |
|---|---|
| **Переписать** | `src/app/eft/items/item/[slug]/page.tsx` — расширить GQL query (containers, quests) |
| **Переписать** | `src/app/eft/items/item/[slug]/ItemModules.tsx` → новые секции ниже |
| **Переписать** | `src/app/eft/items/item/[slug]/ItemImage.tsx` → новый 348×348 ImageFrame |
| **Создать** | `src/app/eft/items/item/[slug]/ItemDetailLayout.tsx` — двухколоночный layout |
| **Создать** | `src/app/eft/items/item/[slug]/SlotGrid.tsx` — визуальная сетка слотов |
| **Создать** | `src/app/eft/items/item/[slug]/ItemActions.tsx` — кнопки Fav + Compare + трекер |
| **Создать** | `src/app/eft/items/item/[slug]/ItemPriceBlock.tsx` — 2×2 price grid |
| **Создать** | `src/app/eft/items/item/[slug]/ItemStatsBlock.tsx` — характеристики по типу |
| **Создать** | `src/app/eft/items/item/[slug]/ItemQuestBlock.tsx` — quest mini-cards |
| **Создать** | `src/app/eft/items/item/[slug]/SimilarItems.tsx` — горизонтальный скролл |
| **Создать** | `src/app/eft/items/item/[slug]/LootSources.tsx` — места падения |

---

## ЧАСТЬ Б: Страница категории `/eft/items/[...category]`

### Новые store-слои

| Store | Файл | Что хранит |
|---|---|---|
| `useFavoritesStore` | `src/store/useFavoritesStore.ts` | `favoriteIds: string[]`, persist `cta-favorites` |
| `useInventoryStore` | `src/store/useInventoryStore.ts` | `ownedItems: Record<string, number>`, persist `cta-inventory` |
| Extend `useItemsStore` | `src/store/useItemsStore.ts` | + `compareIds: string[]`, `toggleCompare(id)`, `clearCompare()` |

### Изменения в EftItemTile

**Новые поля в `EftItemData` (types.ts):**
- `questCount?: number` — кол-во активных квестов с этим предметом
- `inventoryCount?: number` — кол-во в инвентаре игрока

**Header.tsx:**
- Слева: `★ / ☆` кнопка → `useFavoritesStore.toggleFavorite(id)`
- Справа: если `questCount > 0` → amber бейдж `Квест ×N`

**Media.tsx:** высота `h-30` (120px) вместо `h-24`

### CategoryControlBar.tsx

Добавить кнопку `★ Избранное` между "Бартер" и "Доступно":
- Props: `favoritesOnly: boolean`, `onFavoritesOnlyChange`
- При активации → фильтровать до `favoriteIds` в `processedItems`

### Новые компоненты

- `src/components/features/items/FavoritesStrip.tsx` — горизонтальный стрип избранных над сеткой
- `src/components/features/items/CompareDrawer.tsx` — fixed-bottom slide-up сравнение 2–4 предметов

### useCategoryFilters.ts

Добавить: `favoritesOnly` state + URL param `fav=true`

---

## Порядок реализации (рекомендованный)

### Спринт 1 — Stores (~20 мин)
- `useFavoritesStore.ts`
- `useInventoryStore.ts`
- Extend `useItemsStore` c `compareIds`

### Спринт 2 — EftItemTile enhancements (~40 мин)
- `types.ts` — добавить поля
- `Header.tsx` — fav button + quest badge
- `Media.tsx` — height h-30
- `ItemsCategoryClient.tsx` — questCount mapping

### Спринт 3 — Category page controls (~30 мин)
- `useCategoryFilters.ts` — favoritesOnly
- `CategoryControlBar.tsx` — кнопка Избранное
- `FavoritesStrip.tsx`
- `CompareDrawer.tsx`

### Спринт 4 — Item detail page: инфраструктура (~30 мин)
- `page.tsx` — расширить GQL
- `SlotGrid.tsx`
- `ItemActions.tsx`
- `ItemPriceBlock.tsx`

### Спринт 5 — Item detail page: контент (~60 мин)
- `ItemDetailLayout.tsx` — двухколоночный layout
- `ItemStatsBlock.tsx`
- `ItemQuestBlock.tsx`
- `SimilarItems.tsx`
- `LootSources.tsx`
- `ItemModules.tsx` — рефакторинг Barters/Crafts

---

## Верификация

1. `/eft/items/armor` → тайлы с `★` кнопкой, amber бейдж `Квест ×N`
2. Клик `★` → persist, кнопка "Избранное" в контрол-баре фильтрует список
3. FavoritesStrip над сеткой если есть избранные и `favoritesOnly = false`
4. `/eft/items/item/6b47-helmet` → двухколоночный layout, slot grid 2×2, 4 цены
5. Quest mini-cards если предмет нужен в активных квестах
6. Inventory tracker `[─][2][+]` persist после перезагрузки
7. CompareDrawer: выбрать 2 предмета → slide-up панель с колонками
8. Секции Бартеры / Крафт / Похожие / Лут-карта корректно отображаются

---

## Контекст для следующей сессии

Ключевые файлы для чтения перед реализацией:
- `src/components/features/items/EftItemTile/` — весь каталог
- `src/store/useItemsStore.ts`, `useQuestStore.ts`, `usePlayerStore.ts`
- `src/app/eft/items/item/[slug]/page.tsx` + `ItemModules.tsx`
- `src/components/features/items/CategoryControlBar.tsx`
- `src/components/features/items/useCategoryFilters.ts`

Скилл для старта: `/cta-design` (NIGHTFALL токены), `/nightfall` (Tailwind v4 правила)
