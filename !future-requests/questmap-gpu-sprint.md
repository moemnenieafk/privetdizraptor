# Sprint: QuestMap ReactFlow → GPU Viewport
> Для продолжения в новом чате: открой этот файл и скажи "продолжаем спринт"

---

## Контекст

Убираем `reactflow` из Карты заданий — тяжёлая библиотека вызывает React ре-рендеры при каждом pan/zoom. Заменяем кастомным GPU-вьюпортом (QuestMapViewport, уже готов). Переходим с LR-графа (слева направо) на TB (сверху вниз) с разбивкой по торговцам: портрет сверху, квесты вниз по ветке.

---

## Статус шагов

| # | Шаг | Файл | Статус |
|---|-----|------|--------|
| 0 | QuestMapViewport GPU-слои | `QuestMapViewport/index.tsx` | ✅ Готово |
| 1 | QuestNode: `w-[348px]`, убрать Handle/NodeProps | `QuestNode/index.tsx` | ✅ Сделано |
| 2 | TraderNode: убрать Handle/NodeProps | `TraderNode/index.tsx` | ✅ Сделано |
| 3 | Полный переписс QuestMapClient — убрать dagre | `QuestMapClient.tsx` | ✅ Сделано |
| 4 | Замена dagre → кастомный depth-based layout | `QuestMapClient.tsx` | ✅ Сделано |
| 4b | Redirect `/eft/progress/quests` → `/eft/questmap` | `progress/quests/page.tsx` | ✅ Сделано |
| **ТЕСТ** | Проверить видимость нод | `/eft/questmap` | 🟡 Нужна проверка |

---

## 🟡 ТЕКУЩИЙ СТАТУС (после ночного спринта)

### Что было сделано

**Полный переписс `QuestMapClient.tsx`** — убрали dagre, заменили на кастомный алгоритм:

#### Причина проблемы (было)
- Dagre TB + 11 торговцев → граф 50 648px шириной
- `fitToBounds(весь граф)` → scale = 0.02 → clamped ZOOM_MIN=0.05 → карточки 4.5px → **невидимы**
- Пересечений пререквизитов между торговцами dagre не учитывал → все "изолированные" квесты шли в rank-0 → горизонтальный разброс

#### Новый алгоритм (есть)

**`computeGlobalDepths(tasks)`** — DFS с мемоизацией:
- depth 0 = нет пререквизитов
- depth N = max(depth всех пререквизитов) + 1
- Учитывает cross-trader пререквизиты глобально

**`computeLayout(tasks)`** — сетка по глубинам:
- Квесты каждого торговца сортируются по global depth
- Группируются по depth-уровням
- MAX_PER_ROW = 4 → max ширина колонки = 4 × 372 - 24 = **1464px** (было 50 000+)
- Вертикально: каждый depth-level = отдельная строка (ROW_H = 150px)

#### Начальный вид (новый)
- Вместо `fitToBounds(весь граф)` → `setCenter` к первому root-квесту первого торговца при `zoom: 1.0`
- Квест гарантированно в центре экрана, читаемый размер

#### Клик на торговца
- Теперь `setCenter` к первому квесту торговца `zoom: 1.0, duration: 500` (не fitToBounds)
- Fit-кнопка (⛶) → `fitToBounds` колонки активного торговца

### Потенциальная проблема во время правок

Во время двух последовательных Edit операций hot-reload поймал промежуточное состояние с `traderSet is not defined`. После обоих эдитов файл чистый, ошибки нет.

---

## Верификация (когда проснёшься)

1. Если dev server запущен — **жёсткий рефреш** `Ctrl+Shift+R` на `/eft/questmap`
2. Если dev server упал — `npm run dev`, потом открыть `/eft/questmap`
3. Должно:
   - Первый квест Прапора виден по центру при zoom 1.0
   - Pan (drag) работает
   - Колёсико = zoom
   - Кнопки + / − / fit в правом нижнем
   - Клик портрета торговца → центрирует на его первый квест
   - Fit (⛶) → вписывает колонку торговца в экран
   - Bezier-стрелки между квестами видны

---

## Файлы и их состояние

| Файл | Статус |
|------|--------|
| `src/app/eft/questmap/page.tsx` | ✅ Server component |
| `src/app/eft/questmap/QuestMapLoader.tsx` | ✅ `dynamic(() => import(...), { ssr: false })` |
| `src/app/eft/progress/quests/QuestMapClient.tsx` | ✅ Переписан, depth-based layout |
| `src/app/eft/progress/quests/page.tsx` | ✅ `redirect('/eft/questmap')` |
| `src/components/features/quests/QuestMapViewport/index.tsx` | ✅ PAN_CLAMP=100_000, без изменений |
| `src/components/features/quests/QuestNode/index.tsx` | ✅ w-[348px], без Handle |
| `src/components/features/quests/TraderNode/index.tsx` | ✅ без Handle |

---

## Константы

```ts
const NODE_W         = 348;
const NODE_H         = 90;
const TRADER_W       = 168;
const TRADER_H       = 196;
const QUEST_START_Y  = 244; // TRADER_H + 48
const CELL_GAP       = 24;
const ROW_GAP        = 60;
const COLUMN_GAP     = 100;
const MAX_PER_ROW    = 4;
```

---

## Алгоритм computeLayout (depth-based grid)

Для каждого торговца:
1. Взять его квесты, отсортировать по `globalDepth` → по `name`
2. Сгруппировать по depth-уровням
3. Для каждого уровня: разложить по строкам MAX_PER_ROW штук
4. `x = currentX + col * CELL_W`, `y = QUEST_START_Y + rowIndex * ROW_H`
5. Портрет: центрирован над колонкой, y=0
6. `traderColumnBounds` = полный bbox колонки
7. `currentX += effectiveWidth + COLUMN_GAP`

---

## Промпт для нового чата (если надо продолжать)

```
Продолжаем спринт по Карте Заданий. 
Открой `!future-requests/questmap-gpu-sprint.md` — там текущий статус.
QuestMapClient.tsx полностью переписан (depth-based layout без dagre).
Надо проверить работу в браузере и, если нужно, доделать.
```
