# QuestMap Redesign — Исполняемые спринты

> Каждый спринт запускается отдельной сессией.
> Скажи Клоду: **"Выполни Sprint N из этого файла"** — и всё будет сделано за 1 подход.

---

## ДИЗАЙН-РЕФЕРЕНСЫ (читать перед любым спринтом)

```
design-ui-ux-figma/questmap/questmap-sample.png          — общий вид дерева
design-ui-ux-figma/questmap/questmap-ui-frame-cards.png  — UI-фрейм с сайдбаром
design-ui-ux-figma/questmap/questcard-fill-explanation.png — градиенты карточки
design-ui-ux-figma/questmap/connectors-explanation.png   — коннекторы
design-ui-ux-figma/questmap/questmap-drawer.png          — дровер
```

---

## АРХИТЕКТУРА: StubNode для cross-trader рёбер

В EFT-дереве 72 cross-trader зависимости. Длинные линии пересекают колонки — хаос.
Решение: stub-дубликат в целевой колонке вместо crossing-линии.

```
Skier column            Therapist column
┌───────────────┐       ┌──────────────────────────────────┐
│ Реагент 4     │       │ ↗ [icon] SKIER: Реагент. Часть 4 │  ← StubNode (180×52px)
│   [Skier]     │       └──────────────────────────────────┘
└───────────────┘              │ короткая вертикальная линия
                        ┌──────────────────────┐
                        │ Простое любопытство  │
                        └──────────────────────┘
```

**Правила коннекторов:**
| Тип ребра | Линия |
|---|---|
| TraderNode → rootQuest | прямая вертикальная пунктирная |
| A→B, линейная цепочка 1→1 | прямая вертикальная пунктирная |
| A→B, ветвление, один торговец | Безье-кривая |
| A→B, разные торговцы | НЕТ линии → StubNode в колонке B |
| StubNode → B | прямая вертикальная пунктирная |

**Стиль всех линий:** `strokeDasharray="14 7"` `strokeLinecap="round"` `strokeWidth={2}`
**Анимация:** медленный flow через `stroke-dashoffset` (active=8s, locked=14s, completed=10s)
**Цвета:** completed=`--color-success`/op=0.25 | locked=`--color-lines-hover`/op=1 | active=`--trader-X`/op=1

**StubNode поведение:**
- Hover на оригинал → его stubs подсвечиваются как `chainRole='descendant'`
- Клик на stub → `flyToQuest(original.id)` → после анимации → открыть `QuestDrawer`
- Лимит: max 5 stubs + collapsed "и ещё {N} заданий"
- Расположение: горизонтальный ряд над целевым квестом, ширина stub = 180px, gap = 8px

---

## SPRINT 1 — Утилита + Новая карточка QuestNode ✅ ВЫПОЛНЕНО

### Читаем
- `src/components/features/quests/QuestNode/index.tsx`

### Пишем

**НОВЫЙ: `src/lib/trader-utils.ts`**
```ts
export const TRADER_SLUG: Record<string, string> = { 'btr-driver': 'btrdriver' };
export const traderImg = (n: string) => `/images/traders/eft/${TRADER_SLUG[n] ?? n}.webp`;
export const traderCssVar = (n: string) => `--trader-${TRADER_SLUG[n] ?? n}`;
```

Также: точечно заменить локальные `traderImg`/`TRADER_SLUG` на import из trader-utils в:
- `QuestDrawer/index.tsx`
- `TraderNode/index.tsx`
- `QuestSearch/index.tsx`
- `QuestMapClient.tsx`

**РЕРАЙТ: `src/components/features/quests/QuestNode/index.tsx`**

Пропсы (`QuestNodeData` — не менять интерфейс):
```
task, status, lockReason, levelGap, dimmed, freshlyUnlocked,
pinned, chainRole, traderLevels, onToggle, onSelect, onHover, onPin
```

Новый store вызов: `useQuestStore(s => s.incrementItem)` для кнопок целей.

Разметка:
```
<article
  data-no-pan
  style={{ width: 348 }}        ← фиксированная ширина, высота динамическая
  className=...                  ← см. статусы ниже
  onClick={() => onSelect(task)}
  onMouseEnter={() => onHover(task.id)}
  onMouseLeave={() => onHover(null)}
>
  {/* Фон — абсолютный, gradient по статусу */}
  <div className="absolute inset-0 z-0" style={{ background: gradientByStatus }} />

  {/* Контент поверх фона */}
  <div className="relative z-10 flex flex-col">

    {/* HEADER */}
    <header className="flex items-center gap-2 px-3 pt-3 pb-2">
      <img src={traderImg(task.trader.normalizedName)} width={32} height={32} className="rounded-xs shrink-0" />
      <span className="font-blender-medium text-xs uppercase tracking-widest text-(--color-text-secondary)">
        {task.trader.name}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {task.kappaRequired && <span className="icon-eft-kappa w-4 h-4" />}
        {task.lightkeeperRequired && <span className="icon-eft-lightkeeper w-4 h-4" />}
        {pinned && <span className="icon-eft-pin text-(--primary) w-4 h-4" />}
      </div>
    </header>

    {/* TITLE */}
    <h3 className="px-3 pb-2 font-blender-medium text-sm leading-tight text-(--color-text-primary)">
      {task.name}
    </h3>

    {/* OBJECTIVES */}
    <ul className="px-3 space-y-1">
      {task.objectives.slice(0, 5).map(obj => {
        const done = itemProgress[task.id]?.[obj.id] ?? 0;
        const total = 'count' in obj ? (obj as TaskObjectiveItem).count : 0;
        const isItem = obj.__typename === 'TaskObjectiveItem';
        const iconCls = getObjectiveIcon(obj);
        return (
          <li key={obj.id} className="flex items-center gap-2">
            <button
              data-no-pan
              onClick={e => { e.stopPropagation(); incrementItem(task.id, obj.id, total); }}
              className={`shrink-0 w-4 h-4 ${iconCls} transition-opacity ${done === total && total > 0 ? 'opacity-100' : 'opacity-40'}`}
            />
            <span className="text-xs text-(--color-text-secondary) truncate flex-1">
              {obj.description}
            </span>
            {isItem && total > 0 && (
              <span className="text-xs font-blender-medium text-(--color-text-secondary) shrink-0">
                {done}/{total}
              </span>
            )}
          </li>
        );
      })}
      {task.objectives.length > 5 && (
        <li className="flex items-center gap-1.5 mt-1 opacity-60">
          <span className="text-lg leading-none">···</span>
          <span className="text-xs text-(--color-text-secondary)">
            + {task.objectives.length - 5} задач
          </span>
        </li>
      )}
    </ul>

    {/* ПРОГРЕСС-БАР (только active + есть ItemObjective) */}
    {status === 'active' && hasItemObjectives && (
      <div className="mx-3 mt-2 h-0.5 bg-(--color-border) rounded-full overflow-hidden">
        <div className="h-full bg-(--primary) transition-all" style={{ width: `${progressPct}%` }} />
      </div>
    )}

    {/* FOOTER */}
    <footer className="px-3 pb-3 pt-2 flex items-center gap-2">
      <button
        data-no-pan
        onClick={e => { e.stopPropagation(); onToggle(task.id); }}
        disabled={status === 'locked'}
        className={footerBtnCls}
      >
        {status === 'completed' ? '✓ ВЫПОЛНЕНО' : status === 'locked' ? 'ЗАБЛОКИРОВАНО' : 'ВЫПОЛНЕНО?'}
      </button>
      <button
        data-no-pan
        onClick={e => { e.stopPropagation(); onPin(task.id); }}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xs border border-(--color-border) hover:border-(--primary) transition-colors"
      >
        <span className={`icon-eft-bookmark w-4 h-4 ${pinned ? 'text-(--primary)' : 'text-(--color-text-secondary)'}`} />
      </button>
    </footer>

  </div>
</article>
```

**Градиенты (inline style):**
```ts
const traderColor = `var(${traderCssVar(task.trader.normalizedName)})`;
const gradients = {
  active:    `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 15%, transparent), #000000)`,
  locked:    `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 8%, transparent), #000000)`,
  completed: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 5%, transparent), #000000)`,
};
```

**Классы рамок:**
```ts
const borderCls = {
  active:    `border border-(--trader-${slug}) shadow-[0_0_12px_color-mix(in_srgb,var(--trader-${slug})_30%,transparent)]`,
  locked:    'border border-(--color-border)',
  completed: 'border border-(--color-success)/40',
}[status];
```

**Иконки типов целей:**
```ts
function getObjectiveIcon(obj: TaskObjective): string {
  if (obj.__typename === 'TaskObjectiveTraderLevel') return 'icon-eft-quests-rep';
  if (obj.__typename === 'TaskObjectiveItem') return 'icon-eft-quests-loot';
  if (obj.__typename === 'TaskObjectiveShoot') return 'icon-eft-quests-eliminate';
  if (obj.__typename === 'TaskObjectiveMark') return 'icon-eft-quests-visit';
  if (obj.__typename === 'TaskObjectiveBasic') {
    const t = (obj as TaskObjectiveBasic).type;
    if (t === 'findItem' || t === 'findQuestItem') return 'icon-eft-quests-investigate';
    if (t === 'visit' || t === 'plantItem') return 'icon-eft-quests-visit';
    if (t === 'survive' || t === 'extract') return 'icon-eft-quests-survive';
    if (t === 'buildWeapon' || t === 'modifyWeapon') return 'icon-eft-quests-modify';
  }
  return 'icon-eft-quests-investigate';
}
```

### Верификация Sprint 1
- `npm run dev` → /eft/questmap
- Карточки новые: градиент, trader header, список целей
- 3 состояния (locked/active/completed) визуально различимы
- Клик на иконку цели → счётчик растёт, иконка ярче
- Карточки разной высоты, контент не обрезан
- Выполнить 1 квест → анимация fresh-unlock работает

---

## SPRINT 2 — StubNode + Dynamic Layout (crossing minimization) ✅ ВЫПОЛНЕНО

### Читаем
- `src/app/eft/progress/quests/QuestMapClient.tsx` — секция constants + computeLayout (строки ~1-182)
- `src/types/quest.ts`

### Пишем

**НОВЫЙ: `src/components/features/quests/StubNode/index.tsx`**
```tsx
'use client';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import type { TaskRaw } from '@/types/quest';

interface StubNodeProps {
  originalTask: TaskRaw;
  chainRole?: 'ancestor' | 'descendant' | 'self' | null;
  dimmed?: boolean;
  onFlyTo: (id: string, task: TaskRaw) => void;
}

interface CollapsedStubProps {
  count: number;
  onExpand: () => void;
}

export function StubNode({ originalTask, chainRole, dimmed, onFlyTo }: StubNodeProps) {
  const traderColor = `var(${traderCssVar(originalTask.trader.normalizedName)})`;
  const opacity = dimmed ? 'opacity-20' : chainRole === 'descendant' ? 'opacity-100' : 'opacity-70';
  const glow = chainRole === 'descendant' ? `shadow-[0_0_8px_${traderColor}]` : '';

  return (
    <button
      data-no-pan
      onClick={() => onFlyTo(originalTask.id, originalTask)}
      style={{
        width: 180,
        height: 52,
        borderColor: traderColor,
        boxShadow: chainRole === 'descendant' ? `0 0 8px color-mix(in srgb, ${traderColor} 50%, transparent)` : undefined,
      }}
      className={`flex items-center gap-2 px-3 rounded-xs border border-dashed bg-(--color-base) transition-all ${opacity} hover:opacity-100 shrink-0`}
    >
      <img src={traderImg(originalTask.trader.normalizedName)} width={20} height={20} className="rounded-xs shrink-0" />
      <span className="text-xs text-(--color-text-secondary) truncate flex-1 text-left leading-tight">
        {originalTask.trader.name.toUpperCase()}: {originalTask.name}
      </span>
      <span className="text-sm text-(--color-text-secondary) shrink-0">↗</span>
    </button>
  );
}

export function CollapsedStub({ count, onExpand }: CollapsedStubProps) {
  return (
    <button
      data-no-pan
      onClick={onExpand}
      style={{ width: 180, height: 52 }}
      className="flex items-center gap-2 px-3 rounded-xs border border-dashed border-(--color-border) bg-(--color-base) opacity-60 hover:opacity-100 transition-opacity shrink-0"
    >
      <span className="text-lg leading-none text-(--color-text-secondary)">···</span>
      <span className="text-xs text-(--color-text-secondary)">+ {count} задач</span>
    </button>
  );
}
```

**EDIT: `src/app/eft/progress/quests/QuestMapClient.tsx`**

a) **Добавить константы** (после NODE_W/NODE_H):
```ts
const STUB_W = 180;
const STUB_H = 52;
const STUB_GAP = 8;
const MAX_STUBS_VISIBLE = 5;
const OBJ_ROW_H = 28;
const CARD_BASE_H = 148; // header(52) + title(32) + footer(44) + padding(20)

function getQuestNodeHeight(objCount: number): number {
  return CARD_BASE_H + Math.min(objCount, 5) * OBJ_ROW_H + (objCount > 5 ? 24 : 0);
}
```

b) **Изменить `computeLayout`** — заменить фиксированный NODE_H на динамический:
```ts
// Вместо: const ROW_H = NODE_H + ROW_GAP;
// Для каждой строки вычислять: rowH = max(heights в строке) + ROW_GAP
// Y позиции накапливать: let currentY = QUEST_START_Y; currentY += rowH каждую строку
```

c) **Добавить cross-trader stub detection** (после computeLayout, в useMemo):
```ts
// crossTraderEdges: Map<childQuestId, TaskRaw[]>
// Для каждого quest.taskRequirements:
//   если prereq.trader !== quest.trader → добавить в crossTraderEdges[quest.id]

const crossTraderEdges = useMemo(() => {
  const map = new Map<string, TaskRaw[]>();
  for (const task of tasks) {
    const foreignPrereqs = task.taskRequirements
      .map(r => tasks.find(t => t.id === r.task.id))
      .filter((p): p is TaskRaw => !!p && p.trader.normalizedName !== task.trader.normalizedName);
    if (foreignPrereqs.length > 0) map.set(task.id, foreignPrereqs);
  }
  return map;
}, [tasks]);
```

d) **Позиции stubs** (в computeLayout или отдельный useMemo):
```ts
// stubRowPositions: Map<childQuestId, { x: number, y: number }>
// x = childPos.x + (NODE_W / 2) - (Math.min(prereqs.length, MAX_STUBS_VISIBLE) * (STUB_W + STUB_GAP) - STUB_GAP) / 2
// y = childPos.y - STUB_H - 12
```

e) **Hover propagation** для stubs — в `computeChainIds`:
```ts
// Когда hoveredId = 'реагент-4-id', также пометить все квесты где он в crossTraderEdges как descendant
// Т.е. для каждого (childId, prereqs) в crossTraderEdges:
//   если prereqs.some(p => p.id === hoveredId) → stubsOfHoveredId.add(childId ... original)
```

f) **Рендер стабов** (в JSX после рендера QuestNode):
```tsx
{Array.from(crossTraderEdges.entries()).map(([childId, prereqs]) => {
  const rowPos = stubRowPositions.get(childId);
  if (!rowPos) return null;
  const visible = prereqs.slice(0, MAX_STUBS_VISIBLE);
  const collapsed = prereqs.length - MAX_STUBS_VISIBLE;
  return (
    <React.Fragment key={`stubs-${childId}`}>
      {visible.map((orig, i) => (
        <div key={orig.id} style={{ position: 'absolute', left: rowPos.x + i * (STUB_W + STUB_GAP), top: rowPos.y, zIndex: 5 }}>
          <StubNode
            originalTask={orig}
            chainRole={chainIds.get(orig.id) as 'ancestor'|'descendant'|'self'|null}
            dimmed={filteredIds !== null && !filteredIds.has(orig.id)}
            onFlyTo={(id, task) => { flyToQuest(id, 1.5, 400); setTimeout(() => setSelectedTask(task), 450); }}
          />
        </div>
      ))}
      {collapsed > 0 && (
        <div style={{ position: 'absolute', left: rowPos.x + MAX_STUBS_VISIBLE * (STUB_W + STUB_GAP), top: rowPos.y, zIndex: 5 }}>
          <CollapsedStub count={collapsed} onExpand={() => { /* TODO: show list in Drawer */ }} />
        </div>
      )}
    </React.Fragment>
  );
})}
```

g) **Stub → child линия** (в SVG секции):
```ts
// Для каждого cross-trader prereq рисовать прямую линию stub → child:
// x = stubPos.x + STUB_W / 2
// y1 = stubPos.y + STUB_H, y2 = childPos.y
// style: dashed, цвет torговца-источника
```

### Верификация Sprint 2
- Реагент. Часть 4 (Skier): над Простым любопытством (Therapist) и Большим заказчиком (Prapor) видны stubs
- Нет длинных crossing-линий между колонками торговцев
- Hover на Реагент 4 → его stubs в других колонках светятся
- Клик на stub → viewport летит к Реагент 4, открывается Drawer
- Сетевой провайдер: 5 stubs + "и ещё 7 заданий"
- Карточки разной высоты не перекрываются

---

## SPRINT 3 — Коннекторы + Анимация ✅ ВЫПОЛНЕНО

### Читаем
- `src/app/eft/progress/quests/QuestMapClient.tsx` — только секция connector drawing
- `src/app/globals.css` — для добавления keyframe

### Пишем

**EDIT: `src/app/globals.css`** — добавить keyframe:
```css
@keyframes dash-flow {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -21; }
}

.qc-active    { animation: dash-flow 8s linear infinite; }
.qc-locked    { animation: dash-flow 14s linear infinite; }
.qc-completed { animation: dash-flow 10s linear infinite; }
```

**EDIT: `QuestMapClient.tsx`** — connector секция:

Все `<path>` получают:
```
strokeDasharray="14 7"
strokeLinecap="round"
strokeWidth={2}
className={`qc-${status}`}
```

Функция выбора формы:
```ts
function isLinearChain(parentId: string, childId: string): boolean {
  return (childrenMap.get(parentId)?.length ?? 0) === 1
      && (parentsMap.get(childId)?.length ?? 0) === 1;
}

// TraderNode → rootQuest:          прямая  `M ${cx} ${y1} L ${cx} ${y2}`
// isLinearChain(a, b):             прямая
// cross-trader (a.trader ≠ b.trader): ПРОПУСТИТЬ (stub заменяет)
// ветвление (same trader):         текущий makeQuestPath (Bezier) без изменений
// stub → child:                    прямая (из Sprint 2)
```

Цвета:
```ts
const stroke =
  status === 'completed' ? 'var(--color-success)'
  : status === 'locked'  ? 'var(--color-lines-hover)'
  : `var(${traderCssVar(traderName)})`;
const opacity =
  status === 'completed' ? 0.25 : 1.0;
```
Trader→root: opacity=0.5.

### Верификация Sprint 3
- Все линии пунктирные с round caps
- Линии медленно "текут" (dash-offset анимация)
- Active=8s, locked=14s, completed=10s
- Нет пересекающих линий между колонками торговцев

---

## SPRINT 4 — Новый QuestDrawer ✅ ВЫПОЛНЕНО

### Читаем
- `src/components/features/quests/QuestDrawer/index.tsx`
- `src/types/quest.ts`

### Пишем

**НОВЫЙ: `src/lib/quest-utils.ts`**
```ts
export function getQuestHeroImg(taskId: string): string {
  return `/images/quests/eft/${taskId}.webp`;
}
```

**РЕРАЙТ: `src/components/features/quests/QuestDrawer/index.tsx`**

Структура:
```
<aside>  fixed right-0 top-[var(--header-h)]
         w-80 h-[calc(100vh-var(--header-h))]
         flex flex-col
         bg-(--color-base) border-l border-(--color-border) z-50

  HEADER (shrink-0, px-4 py-3, flex items-center gap-3):
    img trader 28×28 rounded-xs
    span trader.name UPPERCASE text-xs tracking-widest
    [K] [LK] badges
    button "×" ml-auto onClick=onClose

  HERO (shrink-0, h-40, relative, overflow-hidden):
    <Image> fill object-cover src={getQuestHeroImg(task.id)}
    onError → setHeroFailed(true) → если true скрыть весь блок
    gradient: absolute inset-0 bg-linear-to-t from-black/90 to-transparent
    h2: absolute bottom-3 left-4 right-4
        font-blender-medium uppercase tracking-widest text-sm

  если !hero: h2 px-4 py-3 font-blender-medium uppercase text-sm

  OBJECTIVES (flex-1, overflow-y-auto, px-4 py-3):
    полный список ObjectiveRow (все типы — как в текущем QuestDrawer)
    QuestItemTracker если есть TaskObjectiveItem

  REWARDS (shrink-0, px-4 py-3, border-t border-(--color-border)):
    "+{experience} XP" text-xs font-blender-medium text-(--color-success)
    traderStanding: img 20×20 + "+{standing}" text-xs
    items: div overflow-x-auto flex gap-2 — иконки наград

  FOOTER (shrink-0, px-4 py-3, border-t border-(--color-border)):
    button grow h-9 font-blender-medium text-xs uppercase tracking-widest
    status===completed → "ОТМЕНИТЬ" | иначе → "ВЫПОЛНЕНО"
    onClick = () => toggleQuest(task.id)

Анимация открытия: translate-x-full → translate-x-0 (200ms ease-out)
через className transition-transform + useEffect для mount
```

### Верификация Sprint 4
- Клик на квест → drawer справа с hero-image
- Нет файла `/images/quests/eft/{id}.webp` → drawer без hero-блока, только h2
- Все цели/награды/кнопка работают
- Drawer закрывается кнопкой ×
- Клик stub из Sprint 2 открывает drawer оригинала

---

## SPRINT 5 — Левый сайдбар (QuestSearch) ✅ ВЫПОЛНЕНО

### Читаем
- `src/components/features/quests/QuestSearch/index.tsx`
- `src/app/eft/questmap/QuestMapLoader.tsx`

### Пишем

**РЕРАЙТ: `src/components/features/quests/QuestSearch/index.tsx`**
```tsx
// Принцип работы тот же — поиск, onFocus(task), Escape
// Изменение: из floating overlay → боковая панель-компонент

interface QuestSearchProps {
  tasks: TaskRaw[];
  onFocus: (task: TaskRaw) => void;
}

// <aside> w-64 h-full flex flex-col bg-(--color-base) border-r border-(--color-border)
//
// ПОИСК (shrink-0, px-3 py-3):
//   div flex items-center gap-2 px-3 h-9 bg-(--color-card-menu) rounded-xs
//     span icon-search w-4 h-4 text-(--color-text-secondary)
//     input placeholder="Поиск по всем заданиям" text-xs
//            bg-transparent outline-none w-full text-(--color-text-primary)
//
// СПИСОК (flex-1, overflow-y-auto):
//   если query.length < 2:
//     p "Введите название квеста" px-3 py-2 text-xs text-(--color-text-secondary)
//   иначе results.slice(0,8).map:
//     button onClick=() => onFocus(task)
//       className px-3 py-2 flex items-center gap-2 hover:bg-(--color-card-menu) w-full text-left
//       img traderImg 20×20 rounded-xs
//       span task.name text-xs leading-tight (с HighlightedText как сейчас)
//     /button
//   результатов нет: "Ничего не найдено"
```

**EDIT: `src/app/eft/questmap/QuestMapLoader.tsx`**
```tsx
// searchOpen state — оставить как есть (toggle в QuestFilterBar тоже оставить)
// Обернуть в flex layout:

return (
  <div className="flex h-[calc(100vh-var(--header-h))]">
    {searchOpen && (
      <QuestSearch tasks={tasks} onFocus={handleFocusNode} />
    )}
    <div className="flex-1 relative overflow-hidden min-w-0">
      {/* Весь текущий контент viewport, filterBar, etc. */}
      <QuestMapViewport ref={vpRef} ...>
        {/* nodes, SVG, etc. */}
      </QuestMapViewport>
      <QuestFilterBar ... />
      {/* другие overlay элементы */}
    </div>
    {selectedTask && (
      <QuestDrawer task={selectedTask} onClose={() => setSelectedTask(null)} ... />
    )}
  </div>
);
```

### Верификация Sprint 5
- Toggle кнопка в QuestFilterBar открывает/скрывает сайдбар
- При открытии viewport сужается, при закрытии расширяется (flex-1 автоматически)
- Поиск работает в реальном времени
- Клик на результат → flyToQuest

---

## SPRINT 6 — TraderNode (по результатам Sprint 1-5) ✅ ВЫПОЛНЕНО

### Читаем
- `src/components/features/quests/TraderNode/index.tsx`

### Оцениваем
Если TraderNode выглядит несвязно с новыми карточками:
- Добавить `border: 1px solid color-mix(in srgb, var(--trader-X) 40%, transparent)`
- Добавить лёгкий glow: `box-shadow: 0 0 16px color-mix(in srgb, var(--trader-X) 20%, transparent)`

Если всё ок — спринт пропускается.

---

## СВОДНАЯ ТАБЛИЦА

| # | Спринт | Файлов читаем | Файлов пишем | Сложность |
|---|---|---|---|---|
| 1 | trader-utils + QuestNode | 1 | 2 | LOW |
| 2 | StubNode + Layout crossing | 2 | 2 | HIGH |
| 3 | Коннекторы + анимация | 2 | 1 | LOW |
| 4 | QuestDrawer + hero | 2 | 2 | MEDIUM |
| 5 | QuestSearch сайдбар | 2 | 2 | LOW |
| 6 | TraderNode (optional) ✅ | 1 | 1 | LOW |
