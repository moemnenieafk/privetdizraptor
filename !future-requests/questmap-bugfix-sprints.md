# QuestMap Bugfix & Completion — Исполняемые спринты

> Каждый спринт запускается отдельной сессией.
> Скажи Клоду: **"Выполни Sprint N из @!future-requests/questmap-bugfix-sprints.md"**

---

## ПРАВИЛА ВЕДЕНИЯ СПРИНТОВ

### Статусы
- `⬜ TODO` — не начат
- `🔄 IN PROGRESS` — выполняется в текущей сессии
- `✅ DONE` — завершён, верифицирован
- `❌ BLOCKED` — заблокирован зависимостью или багом

### Автоматическое отслеживание (Claude обязан делать при каждом запуске)
1. **Перед правками** — выставить спринту статус `🔄 IN PROGRESS` в таблице СТАТУСЫ
2. **После каждого файла** — отметить подзадачу как выполненную в таблице СТАТУСЫ
3. **После всех правок** — выставить статус `✅ DONE`
4. **Если не влезает в контекст** — разбить спринт на ЧАСТИ (Sprint Nа, Sprint Nб) и описать что в каждой части, затем выполнить часть Nа

### Правило контекста
Если изменения не помещаются в один контекст (>2 больших файла + сложная логика):
- Разбить на части прямо в этом файле: добавить `### Sprint N — часть А` и `### Sprint N — часть Б`
- Часть А завершить полностью, поставить `✅ DONE`
- Сообщить пользователю: "Часть А выполнена, запусти Sprint Nб для продолжения"

---

## СТАТУСЫ СПРИНТОВ

| # | Спринт | Статус | Подзадачи |
|---|---|---|---|
| 1 | Hover FPS fix | ✅ DONE | QuestMapViewport ✅ · QuestMapClient ✅ · StubNode ✅ |
| 2 | Fullscreen + Auto-unpin | ✅ DONE | useQuestStore ✅ · QuestFilterBar ✅ · QuestMapClient ✅ |
| 3 | nvg-green цвет | ✅ DONE | QuestNode ✅ · globals.css ✅ · QuestDrawer ✅ |
| 4 | QuestResetModal | ✅ DONE | QuestResetModal ✅ · QuestFilterBar ✅ · QuestMapClient ✅ |
| 5 | QuestFilterBar рерайт | ✅ DONE | QuestFilterBar ✅ |
| 6 | QuestStatusBar новый | ✅ DONE | QuestStatusBar ✅ · QuestMapClient ✅ |
| 7 | Force-complete 5s hold | ✅ DONE | QuestNodeData ✅ · QuestNode ✅ · globals.css ✅ · QuestMapClient ✅ |

---

## ДИЗАЙН-РЕФЕРЕНС

```
design-ui-ux-figma/questmap/ui-frame/QuestMap-1100px-DefaultUI.png — целевой вид
```

---

## SPRINT 1 — Производительность: hover FPS fix

### Проблема
`connections` useMemo (168+ объектов) пересоздаётся на каждый mouseenter/mouseleave
потому что зависит от `chainHighlight`. FPS падает при движении мыши по карте.

### Читаем
- `src/app/eft/progress/quests/QuestMapClient.tsx` — строки 405-557 (chainHighlight + connections useMemo)
- `src/components/features/quests/QuestMapViewport/index.tsx` — строки 28-56 (ConnectionDef type) и 409-422 (SVG render)
- `src/components/features/quests/StubNode/index.tsx` — вся (~62 строки)

### Пишем

**EDIT: `src/components/features/quests/QuestMapViewport/index.tsx`**

a) Расширить `ConnectionDef` — добавить опциональные поля:
```ts
export interface ConnectionDef {
  id:           string;
  d:            string;
  stroke:       string;
  opacity:      number;         // базовая opacity (без hover-логики)
  nodeIds?:     [string, string]; // [srcTaskId, tgtTaskId] для hover-highlight
  strokeWidth?: number;
  dashArray?:   string;
  className?:   string;
}
```

b) Добавить проп `chainSet` к `Props`:
```ts
interface Props {
  children?:          ReactNode;
  connections?:       ConnectionDef[];
  chainSet?:          Set<string> | null;   // ← НОВОЕ
  className?:         string;
  style?:             CSSProperties;
  initialTransform?:  Transform;
  onTransformChange?: (t: Transform) => void;
}
```

c) В SVG render блоке изменить вычисление opacity:
```tsx
{connections.map((c) => {
  const finalOpacity = c.nodeIds && chainSet
    ? (chainSet.has(c.nodeIds[0]) && chainSet.has(c.nodeIds[1]) ? c.opacity : 0.05)
    : c.opacity;
  return (
    <path
      key={c.id}
      d={c.d}
      fill="none"
      stroke={c.stroke}
      strokeWidth={c.strokeWidth ?? 2}
      opacity={finalOpacity}
      strokeDasharray={c.dashArray ?? '14 7'}
      strokeLinecap="round"
      className={c.className}
    />
  );
})}
```

---

**EDIT: `src/app/eft/progress/quests/QuestMapClient.tsx`**

a) Заменить `chainHighlight` useMemo на `chainSet` useMemo:
```ts
// УДАЛИТЬ старый chainHighlight useMemo (строки 406-413)
// ДОБАВИТЬ:
const chainSet = useMemo<Set<string> | null>(() => {
  if (!hoveredId) return null;
  const anc  = ancestorMap.get(hoveredId)   ?? new Set<string>();
  const desc = descendantMap.get(hoveredId) ?? new Set<string>();
  return new Set([...anc, hoveredId, ...desc]);
}, [hoveredId, ancestorMap, descendantMap]);
```

b) Обновить `getChainRole` и `getStubChainRole` — заменить использование `chainHighlight` на `chainSet`:
```ts
const getChainRole = useCallback((id: string): 'ancestor' | 'descendant' | 'self' | null | undefined => {
  if (!chainSet) return undefined;
  if (id === hoveredId)          return 'self';
  if (ancestorMap.get(hoveredId)?.has(id))   return 'ancestor';
  if (descendantMap.get(hoveredId)?.has(id)) return 'descendant';
  return null;
}, [chainSet, hoveredId, ancestorMap, descendantMap]);

const getStubChainRole = useCallback((origId: string): 'ancestor' | 'descendant' | 'self' | null | undefined => {
  if (hoveredId === origId) return 'descendant';
  return getChainRole(origId);
}, [hoveredId, getChainRole]);
```

c) Переименовать `connections` → `staticConnections` и УБРАТЬ `chainHighlight` из зависимостей.
Вместо `chainSet` в useMemo — хранить `nodeIds` в каждом ConnectionDef:
```ts
// Вместо: const connections = useMemo(..., [..., chainHighlight, ...])
const staticConnections = useMemo<ConnectionDef[]>(() => {
  const result: ConnectionDef[] = [];
  const taskById = new Map(initialTasks.map(t => [t.id, t]));

  function isLinearChain(parentId: string, childId: string): boolean {
    return (childrenMap.get(parentId)?.length ?? 0) === 1
        && (parentsMap.get(childId)?.length ?? 0) === 1;
  }

  for (const task of initialTasks) {
    for (const req of task.taskRequirements) {
      const edgeId = `${req.task.id}->${task.id}`;
      if (!staticEdgeIds.has(edgeId)) continue;
      const srcTask = taskById.get(req.task.id);
      if (!srcTask) continue;
      if (srcTask.trader.normalizedName !== task.trader.normalizedName) continue;

      const srcPos = layoutPositions.get(req.task.id);
      const tgtPos = layoutPositions.get(task.id);
      if (!srcPos || !tgtPos) continue;

      const srcStatus   = statusMap.get(req.task.id)?.status ?? 'locked';
      const traderVar   = `var(${traderCssVar(task.trader.normalizedName)})`;
      const stroke      = srcStatus === 'completed' ? 'var(--color-nvg-green)'
        : srcStatus === 'locked'  ? 'var(--color-lines-hover)'
        : traderVar;
      const baseOpacity = srcStatus === 'completed' ? 0.25 : 1.0;
      const srcH        = nodeHeights.get(req.task.id) ?? NODE_H;

      result.push({
        id:        edgeId,
        d:         isLinearChain(req.task.id, task.id)
          ? `M ${srcPos.x + NODE_W / 2} ${srcPos.y + srcH} L ${tgtPos.x + NODE_W / 2} ${tgtPos.y}`
          : makeQuestPath(srcPos.x + NODE_W / 2, srcPos.y + srcH, tgtPos.x + NODE_W / 2, tgtPos.y),
        stroke,
        opacity:   baseOpacity,   // базовая, без chainHighlight
        nodeIds:   [req.task.id, task.id],
        className: `qc-${srcStatus}`,
      });
    }
  }

  // Trader portrait → root quests
  for (const [traderName, rootIds] of traderRoots) {
    const traderVar = `var(${traderCssVar(traderName)})`;
    const traderPos = layoutPositions.get(`trader-${traderName}`);
    if (!traderPos) continue;
    for (const rootId of rootIds.slice(0, 4)) {
      const questPos = layoutPositions.get(rootId);
      if (!questPos) continue;
      result.push({
        id:      `trader-${traderName}->${rootId}`,
        d:       `M ${traderPos.x + TRADER_W / 2} ${traderPos.y + TRADER_H} L ${questPos.x + NODE_W / 2} ${questPos.y}`,
        stroke:  traderVar,
        opacity: 0.5,
        nodeIds: [`trader-${traderName}`, rootId],
        className: 'qc-active',
      });
    }
  }

  // Stub → child connections
  for (const [childId, prereqs] of crossTraderEdges) {
    const childPos = layoutPositions.get(childId);
    const rowPos   = stubRowPositions.get(childId);
    if (!childPos || !rowPos) continue;
    const childStatus = statusMap.get(childId)?.status ?? 'locked';
    prereqs.slice(0, MAX_STUBS_VISIBLE).forEach((orig, i) => {
      const stubCenterX   = rowPos.x + i * (STUB_W + STUB_GAP) + STUB_W / 2;
      const origTraderVar = `var(${traderCssVar(orig.trader.normalizedName)})`;
      const stroke        = childStatus === 'completed' ? 'var(--color-nvg-green)'
        : childStatus === 'active' ? origTraderVar
        : 'var(--color-lines-hover)';
      result.push({
        id:        `stub-${orig.id}->${childId}-${i}`,
        d:         `M ${stubCenterX} ${rowPos.y + STUB_H} L ${childPos.x + NODE_W / 2} ${childPos.y}`,
        stroke,
        opacity:   childStatus === 'completed' ? 0.25 : 1.0,
        nodeIds:   [orig.id, childId],
        className: `qc-${childStatus}`,
      });
    });
  }

  return result;
}, [initialTasks, layoutPositions, nodeHeights, statusMap, staticEdgeIds, traderRoots,
    crossTraderEdges, stubRowPositions, childrenMap, parentsMap]);
// ↑ chainHighlight/chainSet НЕТ в зависимостях — это ключевой фикс
```

d) RAF-дебаунс на `handleHover` (строка ~641):
```ts
// УДАЛИТЬ: const handleHover = useCallback((id: string | null) => setHoveredId(id), []);
// ДОБАВИТЬ (после объявления vpRef):
const hoveredRafRef = useRef<number>(0);
const pendingHoverRef = useRef<string | null>(null);

const handleHover = useCallback((id: string | null) => {
  pendingHoverRef.current = id;
  cancelAnimationFrame(hoveredRafRef.current);
  hoveredRafRef.current = requestAnimationFrame(() => setHoveredId(pendingHoverRef.current));
}, []);
```

e) В JSX: передать `chainSet` и заменить `connections` → `staticConnections`:
```tsx
<QuestMapViewport
  ref={vpRef}
  connections={staticConnections}
  chainSet={chainSet}
  className="absolute inset-0"
>
```

**EDIT: `src/components/features/quests/StubNode/index.tsx`**

Обернуть оба компонента в `memo`:
```ts
// БЫЛО:
export function StubNode(...) { ... }
export function CollapsedStub(...) { ... }

// СТАЛО:
import { memo } from 'react';
export const StubNode = memo(function StubNode(...) { ... });
export const CollapsedStub = memo(function CollapsedStub(...) { ... });
```

### Верификация Sprint 1
- `npm run dev` → /eft/progress/quests
- Chrome DevTools → Performance → запись 5 секунд хаотичного движения мыши по карте
- Framerate должен быть стабильным (> 50fps)
- Hover-подсветка цепочек работает как раньше
- При hover на квест — его ancestors синие, descendants янтарные
- Коннекторы не в цепочке затухают до opacity 0.05

---

## SPRINT 2 — Критические баги: Fullscreen + Auto-unpin

### Читаем
- `src/app/eft/progress/quests/QuestMapClient.tsx` — строки 605-730 (fullscreen logic, containerCls, JSX структура)
- `src/components/features/quests/QuestFilterBar/index.tsx` — кнопка fullscreen (найти по `isFullscreen`)
- `src/store/useQuestStore.ts` — `toggleQuest` action

### Пишем

**EDIT: `src/store/useQuestStore.ts`** — auto-unpin в toggleQuest:
```ts
// Заменить toggleQuest:
toggleQuest: (id) =>
  set((s) => {
    const isCompleting = !s.completedQuests.includes(id);
    return {
      completedQuests: isCompleting
        ? [...s.completedQuests, id]
        : s.completedQuests.filter((q) => q !== id),
      // Автоматически открепить при выполнении
      pinnedQuests: isCompleting
        ? s.pinnedQuests.filter((p) => p !== id)
        : s.pinnedQuests,
    };
  }),
```

После этого в `QuestMapClient.tsx` строка ~650 удалить ручное открепление:
```ts
// УДАЛИТЬ эту строку из handleToggle:
// if (nowPinned.includes(taskId)) togglePin(taskId);
```

**EDIT: `src/components/features/quests/QuestFilterBar/index.tsx`**

Найти и УДАЛИТЬ кнопку fullscreen из QuestFilterBar. Убрать из пропсов:
- `isFullscreen`
- `onToggleFullscreen`

**EDIT: `src/app/eft/progress/quests/QuestMapClient.tsx`**

a) Убрать `isFullscreen` и `onToggleFullscreen` из пропсов QuestFilterBar.

b) Добавить кнопку fullscreen в правый нижний угол — внутри `<div className="relative flex-1 min-w-0">`, ПОСЛЕ `<QuestMapViewport ...>`:
```tsx
{/* Fullscreen button — bottom-right of canvas */}
<button
  onClick={() => setIsFullscreen(v => !v)}
  className="absolute bottom-4 right-4 z-20 w-7 h-7 flex items-center justify-center
             rounded-xs border border-(--color-border) bg-(--color-base)/80
             hover:border-(--primary) hover:bg-(--color-card-menu) transition-colors"
  title={isFullscreen ? 'Выйти из полноэкранного' : 'Полноэкранный режим'}
>
  <span className={`icon-bg ${isFullscreen ? 'icon-eft-fullscreen-exit' : 'icon-eft-fullscreen'} w-4 h-4`} />
</button>
```

c) Проверить `containerCls` — убедиться что fullscreen container имеет нужный z-index:
```ts
// Если header имеет z-index выше 95 — поднять до 100:
const containerCls = isFullscreen
  ? 'fixed inset-0 z-[100] flex flex-col bg-(--color-base)'
  : 'flex flex-col w-full';
```

### Верификация Sprint 2
- Открыть /eft/progress/quests
- Нажать кнопку fullscreen (нижний правый угол) → карта на весь экран, хедер скрыт
- Нажать кнопку ещё раз → возврат к нормальному виду
- ESC также закрывает fullscreen
- Выполнить закреплённый квест → он автоматически убирается из закреплённых
- Выполнить незакреплённый квест → закреплённые остаются нетронутыми

---

## SPRINT 3 — Цвет выполненных квестов → --color-nvg-green

> **ВАЖНО**: Sprint 1 должен быть выполнен до Sprint 3, так как Sprint 1 уже
> заменяет `--color-success` на `--color-nvg-green` в `staticConnections`.
> Этот спринт только правит QuestNode и QuestDrawer.

### Читаем
- `src/components/features/quests/QuestNode/index.tsx` — строки 43-47 (borderStyle)
- `src/app/globals.css` — убедиться что `--color-nvg-green` задан
- `src/components/features/quests/QuestDrawer/index.tsx` — кнопка "ВЫПОЛНЕНО" (цвет)

### Пишем

**EDIT: `src/components/features/quests/QuestNode/index.tsx`**

Строка ~46: border для completed → `--color-nvg-green`:
```ts
const borderStyle: React.CSSProperties = status === 'active'
  ? { borderColor: traderColor, boxShadow: `0 0 12px color-mix(in srgb, ${traderColor} 30%, transparent)` }
  : status === 'completed'
  ? { borderColor: 'color-mix(in srgb, var(--color-nvg-green) 40%, transparent)' }
  : { borderColor: 'var(--color-lines-hover)' };
```

Строка ~39: gradient для completed — усилить до 8% (сейчас 5%):
```ts
completed: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 5%, transparent), #000000)`,
// оставить 5% — не менять
```

Строка ~61: ringCls для chainRole — добавить nvg-green для completed:
```ts
const ringCls = !dimmed && chainRole !== null
  ? chainRole === 'self'       ? 'ring-2 ring-(--primary)'
  : chainRole === 'ancestor'   ? 'ring-1 ring-sky-500/60'
  : chainRole === 'descendant' ? 'ring-1 ring-(--primary)/60'
  : ''
  : '';
// Для completed self — добавить отдельный класс если нужно, иначе оставить как есть
```

**Проверить** в `src/app/globals.css` что `--color-nvg-green` определён:
```css
/* должно быть в :root */
--color-nvg-green: #689963;
```
Если отсутствует — добавить.

### Верификация Sprint 3
- Выполнить любой квест
- Граничная линия карточки → зелёная (nvg-green), не синяя
- Коннекторы к этому квесту → зелёные с opacity 0.25
- Невыполненные квесты: цвет не изменился (locked=серый, active=цвет торговца)

---

## SPRINT 4 — QuestResetModal

### Читаем
- `src/components/layout/header-modules/ProfileResetModal.tsx` — полностью (~120 строк)
- `src/hooks/useModalAnimation.ts` — интерфейс хука
- `src/store/useQuestStore.ts` — `resetProgress` action

### Пишем

**НОВЫЙ: `src/components/features/quests/QuestResetModal/index.tsx`**

Структура аналогична `ProfileResetModal.tsx`:
```tsx
'use client';
import { useModalAnimation } from '@/hooks/useModalAnimation';

interface Props {
  isOpen:    boolean;
  onClose:   () => void;
  onConfirm: () => void;
}

export function QuestResetModal({ isOpen, onClose, onConfirm }: Props) {
  const { isRendered, isVisible, modalRef } = useModalAnimation(isOpen, onClose);
  if (!isRendered) return null;

  return (
    <div className={`fixed inset-0 z-110 flex items-center justify-center bg-black/70
                     backdrop-blur-sm transition-opacity duration-300 ease-out
                     ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div
        ref={modalRef}
        className={`relative w-80 rounded-xs border border-(--color-border) overflow-hidden
                    bg-(--color-base) transition-all duration-300 ease-out
                    ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-1'}`}
      >
        {/* HEADER — danger banner */}
        <div className="h-7 flex items-center justify-between px-3 bg-(--color-danger)">
          <div className="flex items-center gap-2">
            <span className="icon-bg icon-eft-profile-reset w-3.5 h-3.5 text-white" />
            <span className="font-blender-medium text-xs uppercase tracking-widest text-white">
              Сброс прогресса заданий
            </span>
          </div>
          <button onClick={onClose}>
            <span className="icon-bg icon-eft-profile-btn-close w-3.5 h-3.5 text-white hover:opacity-70" />
          </button>
        </div>

        {/* BODY */}
        <div className="px-6 py-5 flex flex-col items-center gap-4">
          <span className="icon-bg icon-eft-profile-warning w-10 h-10 text-(--color-danger)" />
          <div className="text-center space-y-2">
            <p className="font-blender-medium text-xs text-(--color-text-primary) uppercase tracking-widest">
              Вы уверены?
            </p>
            <p className="text-xs text-(--color-text-secondary) leading-relaxed">
              Будут сброшены: <span className="text-(--color-text-primary)">все выполненные задания</span>
              и прогресс сбора предметов.
            </p>
            <p className="text-xs text-(--color-text-secondary) leading-relaxed">
              Уровень, торговцы и другие данные останутся без изменений.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className="flex-1 h-9 font-blender-medium text-xs uppercase tracking-widest
                         rounded-xs border border-(--color-danger) text-(--color-danger)
                         hover:bg-(--color-danger)/10 transition-colors"
            >
              ДА
            </button>
            <button
              onClick={onClose}
              className="flex-1 h-9 font-blender-medium text-xs uppercase tracking-widest
                         rounded-xs border border-(--color-border) text-(--color-text-secondary)
                         hover:border-(--primary) hover:text-(--color-text-primary) transition-colors"
            >
              НЕТ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**EDIT: `src/components/features/quests/QuestFilterBar/index.tsx`**

Найти прямую кнопку сброса (которая вызывает `onReset`) и заменить на триггер модала.
Добавить `onResetProgress` проп (отдельно от `onReset` который сбрасывает только фильтры).

**EDIT: `src/app/eft/progress/quests/QuestMapClient.tsx`**

Добавить state `resetModalOpen` и подключить модал:
```tsx
const [resetModalOpen, setResetModalOpen] = useState(false);
const resetProgress = useQuestStore(s => s.resetProgress);

// В JSX добавить:
<QuestResetModal
  isOpen={resetModalOpen}
  onClose={() => setResetModalOpen(false)}
  onConfirm={resetProgress}
/>
```

Передать `onResetProgress={() => setResetModalOpen(true)}` в QuestFilterBar.

### Верификация Sprint 4
- Нажать кнопку сброса → появляется модал
- Нажать НЕТ → модал закрывается, прогресс цел
- Нажать ДА → модал закрывается, все квесты сбрасываются
- Уровень персонажа и торговцы не сбрасываются

---

## SPRINT 5 — Редизайн Top Bar (QuestFilterBar)

> Цель: привести верхнюю панель к виду из Figma `QuestMap-1100px-DefaultUI.png`
> Одна горизонтальная строка: [🔍] | [торговцы] | [карты] | [ресет(красный)]

### Читаем
- `src/components/features/quests/QuestFilterBar/index.tsx` — полностью (~276 строк)
- `design-ui-ux-figma/questmap/ui-frame/QuestMap-1100px-DefaultUI.png` — макет (верхняя панель)
- `src/styles/icons.css` — доступные `icon-eft-maps-*` классы

### Пишем

**РЕРАЙТ: `src/components/features/quests/QuestFilterBar/index.tsx`**

Пропсы (удалить `isFullscreen`, `onToggleFullscreen`; добавить `onResetProgress`):
```ts
interface QuestFilterBarProps {
  tasks:            TaskRaw[];
  completedQuests:  string[];
  filterKappa:      boolean;
  filterLK:         boolean;
  selectedTraders:  Set<string>;
  selectedMaps:     Set<string>;
  searchOpen:       boolean;
  maps:             { id: string; name: string; normalizedName: string }[];
  onKappa:          () => void;
  onLK:             () => void;
  onTrader:         (name: string) => void;
  onMap:            (id: string) => void;
  onReset:          () => void;          // сброс фильтров (не прогресса)
  onResetProgress:  () => void;          // открывает QuestResetModal
  onSearchOpen:     () => void;
  onExport:         () => void;
  onImport:         (file: File) => void;
}
```

Разметка:
```tsx
<div className="flex items-center gap-1.5 px-3 h-10 border-b border-(--color-border)
                bg-(--color-card-menu) shrink-0 overflow-x-auto">

  {/* SEARCH toggle */}
  <button
    onClick={onSearchOpen}
    className={`w-7 h-7 flex items-center justify-center rounded-xs transition-colors shrink-0
                ${searchOpen ? 'bg-(--primary)/20 border border-(--primary)/40 text-(--primary)'
                            : 'border border-(--color-border) text-(--color-text-secondary) hover:border-(--primary)/40'}`}
  >
    <span className="icon-bg icon-eft-search w-3.5 h-3.5" />
  </button>

  <div className="w-px h-5 bg-(--color-border) shrink-0 mx-1" />

  {/* TRADERS */}
  <div className="flex items-center gap-1 shrink-0">
    {traderOrder.map(name => {
      const isActive = selectedTraders.has(name);
      const traderColor = `var(--trader-${name === 'btr-driver' ? 'btrdriver' : name})`;
      return (
        <button
          key={name}
          onClick={() => onTrader(name)}
          className="w-7 h-7 rounded-xs overflow-hidden shrink-0 transition-all"
          style={{
            outline: isActive ? `1.5px solid ${traderColor}` : '1.5px solid transparent',
            boxShadow: isActive ? `0 0 8px color-mix(in srgb, ${traderColor} 40%, transparent)` : 'none',
          }}
          title={task.trader.name}  // тут использовать имя торговца
        >
          <img src={traderImg(name)} width={28} height={28} className="block object-cover object-top" />
        </button>
      );
    })}
  </div>

  <div className="w-px h-5 bg-(--color-border) shrink-0 mx-1" />

  {/* MAPS */}
  {maps.length > 0 && (
    <div className="flex items-center gap-1 shrink-0">
      {maps.map(map => {
        const isActive = selectedMaps.has(map.id);
        const iconCls  = `icon-eft-maps-${map.normalizedName}`;
        return (
          <button
            key={map.id}
            onClick={() => onMap(map.id)}
            className={`w-7 h-7 flex items-center justify-center rounded-xs transition-colors shrink-0
                        ${isActive
                          ? 'bg-(--primary)/20 border border-(--primary)/40 text-(--primary)'
                          : 'border border-(--color-border) text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'}`}
            title={map.name}
          >
            <span className={`icon-mask ${iconCls} w-4 h-4`} />
          </button>
        );
      })}
    </div>
  )}

  {/* RESET PROGRESS — красный, в правом краю */}
  <div className="ml-auto shrink-0">
    <button
      onClick={onResetProgress}
      className="w-7 h-7 flex items-center justify-center rounded-xs border
                 border-(--color-danger)/60 text-(--color-danger)/60
                 hover:border-(--color-danger) hover:text-(--color-danger)
                 hover:bg-(--color-danger)/10 transition-colors"
      title="Сбросить прогресс заданий"
    >
      <span className="icon-bg icon-eft-profile-reset w-3.5 h-3.5" />
    </button>
  </div>

</div>
```

**Примечание по traderOrder:** взять из `useMemo(() => [...byTrader.keys()], [tasks])` или передать пропсом из QuestMapClient.

### Верификация Sprint 5
- Одна строка фильтрации (не две)
- Торговцы — квадраты 28×28, при клике — glow-обводка цветом торговца
- Карты — иконки из CSS mask, 28×28
- Ресет-кнопка — красная, в правом краю панели
- Кнопки fullscreen, export, import НЕ в этой панели (они в Sprint 6)

---

## SPRINT 6 — Status Bar (QuestStatusBar)

> Нижняя панель карты: прогресс + kappa/lk значки + export/import/fullscreen

### Читаем
- `src/app/eft/progress/quests/QuestMapClient.tsx` — строки 630-640 (kappaStats), 678-698 (handlers export/import)
- `design-ui-ux-figma/questmap/ui-frame/QuestMap-1100px-DefaultUI.png` — нижняя панель

### Пишем

**НОВЫЙ: `src/components/features/quests/QuestStatusBar/index.tsx`**
```tsx
'use client';

interface QuestStatusBarProps {
  totalQuests:      number;
  completedCount:   number;
  kappaTotal:       number;
  kappaCompleted:   number;
  lkTotal:          number;
  lkCompleted:      number;
  isFullscreen:     boolean;
  onToggleFullscreen: () => void;
  onExport:         () => void;
  onImport:         (file: File) => void;
}

export function QuestStatusBar({
  totalQuests, completedCount, kappaTotal, kappaCompleted,
  lkTotal, lkCompleted, isFullscreen, onToggleFullscreen, onExport, onImport,
}: QuestStatusBarProps) {
  const pct = totalQuests > 0 ? Math.round((completedCount / totalQuests) * 100) : 0;
  const kappaPct = kappaTotal > 0 ? Math.round((kappaCompleted / kappaTotal) * 100) : 0;
  const lkPct    = lkTotal    > 0 ? Math.round((lkCompleted    / lkTotal)    * 100) : 0;

  return (
    <div className="flex items-center gap-3 px-3 h-9 border-t border-(--color-border)
                    bg-(--color-card-menu) shrink-0">

      {/* Общий прогресс */}
      <span className="font-blender-medium text-[11px] uppercase tracking-widest text-(--color-text-secondary) shrink-0">
        ВЫПОЛНЕНО: <span className="text-(--color-text-primary)">{completedCount}</span>
        /{totalQuests} — <span className="text-(--color-text-primary)">{pct}%</span>
      </span>

      {/* Kappa badge */}
      <div className="flex items-center gap-1.5 px-2 h-6 rounded-xs border border-(--color-border) shrink-0">
        <span className="icon-bg icon-eft-profile-kappa w-3 h-3 text-(--color-success)" />
        <span className="font-blender-medium text-[11px] text-(--color-success)">
          {kappaCompleted}/{kappaTotal} — {kappaPct}%
        </span>
      </div>

      {/* LK badge */}
      <div className="flex items-center gap-1.5 px-2 h-6 rounded-xs border border-(--color-border) shrink-0">
        <span className="icon-bg icon-eft-profile-lightkeeper w-3 h-3 text-(--color-text-secondary)" />
        <span className="font-blender-medium text-[11px] text-(--color-text-secondary)">
          {lkCompleted}/{lkTotal} — {lkPct}%
        </span>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1 shrink-0">
        {/* Export */}
        <button
          onClick={onExport}
          className="w-7 h-7 flex items-center justify-center rounded-xs border border-(--color-border)
                     text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary) transition-colors"
          title="Экспорт прогресса"
        >
          <span className="icon-bg icon-eft-export w-3.5 h-3.5" />
        </button>

        {/* Import */}
        <label
          className="w-7 h-7 flex items-center justify-center rounded-xs border border-(--color-border)
                     text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary) transition-colors cursor-pointer"
          title="Импорт прогресса"
        >
          <span className="icon-bg icon-eft-import w-3.5 h-3.5" />
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }}
          />
        </label>

        <div className="w-px h-4 bg-(--color-border) mx-0.5" />

        {/* Fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="w-7 h-7 flex items-center justify-center rounded-xs border border-(--color-border)
                     text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary) transition-colors"
          title={isFullscreen ? 'Выйти из полноэкранного' : 'Полноэкранный режим'}
        >
          <span className={`icon-bg ${isFullscreen ? 'icon-eft-fullscreen-exit' : 'icon-eft-fullscreen'} w-3.5 h-3.5`} />
        </button>
      </div>

    </div>
  );
}
```

**EDIT: `src/app/eft/progress/quests/QuestMapClient.tsx`**

a) Добавить `lkTotal/lkCompleted` в kappa stats useMemo:
```ts
const { kappaTotal, kappaCompleted, lkTotal, lkCompleted } = useMemo(() => {
  const completedSet = new Set(completedQuests);
  return {
    kappaTotal:     initialTasks.filter(t => t.kappaRequired).length,
    kappaCompleted: initialTasks.filter(t => t.kappaRequired && completedSet.has(t.id)).length,
    lkTotal:        initialTasks.filter(t => t.lightkeeperRequired).length,
    lkCompleted:    initialTasks.filter(t => t.lightkeeperRequired && completedSet.has(t.id)).length,
  };
}, [initialTasks, completedQuests]);
```

b) Убрать из QuestFilterBar: `onExport`, `onImport`, `isFullscreen`, `onToggleFullscreen`

c) Добавить `<QuestStatusBar .../>` внутри `<div className={containerCls}>` ПОСЛЕ canvas-div:
```tsx
<QuestStatusBar
  totalQuests={initialTasks.length}
  completedCount={completedQuests.length}
  kappaTotal={kappaTotal}
  kappaCompleted={kappaCompleted}
  lkTotal={lkTotal}
  lkCompleted={lkCompleted}
  isFullscreen={isFullscreen}
  onToggleFullscreen={() => setIsFullscreen(v => !v)}
  onExport={handleExport}
  onImport={handleImport}
/>
```

d) Убрать `<button fullscreen>` из правого нижнего угла (добавленный в Sprint 2) — теперь он в QuestStatusBar.

### Верификация Sprint 6
- Нижняя панель показывает прогресс: "ВЫПОЛНЕНО: 29/510 — 6%"
- Два значка: kappa и LK с процентами
- Кнопки Export/Import/Fullscreen в правом краю нижней панели
- Fullscreen работает через кнопку в нижней панели

---

## SPRINT 7 — Force-complete заблокированного квеста (5-секундное удержание)

### Читаем
- `src/components/features/quests/QuestNode/index.tsx` — footer/кнопка, секция ЗАБЛОКИРОВАНО
- `src/types/quest.ts` — QuestNodeData интерфейс
- `src/app/eft/progress/quests/QuestMapClient.tsx` — handleToggle, ancestorMap

### Пишем

**EDIT: `src/types/quest.ts`** — добавить `onForceComplete` в QuestNodeData:
```ts
export interface QuestNodeData {
  // ... существующие поля ...
  onForceComplete: (id: string) => void;  // ← НОВОЕ
}
```

**EDIT: `src/components/features/quests/QuestNode/index.tsx`**

Добавить hold-логику в компонент:
```tsx
// Добавить в пропсы:
const { ..., onForceComplete } = data;

// Refs для таймера:
const holdTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
const holdProgressRef = useRef<HTMLDivElement>(null);
const [isHolding, setIsHolding] = useState(false);

const startHold = (e: React.MouseEvent | React.TouchEvent) => {
  if (status !== 'locked') return;
  e.preventDefault();
  setIsHolding(true);
  holdTimerRef.current = setTimeout(() => {
    onForceComplete(task.id);
    setIsHolding(false);
  }, 5000);
};

const cancelHold = () => {
  if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  setIsHolding(false);
};

// Cleanup on unmount:
useEffect(() => () => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current); }, []);
```

Изменить кнопку "ЗАБЛОКИРОВАНО":
```tsx
<button
  data-no-pan
  disabled={false}  // ← убрать disabled для locked (чтобы mousedown работал)
  onMouseDown={startHold}
  onMouseUp={cancelHold}
  onMouseLeave={cancelHold}
  onTouchStart={startHold}
  onTouchEnd={cancelHold}
  onClick={e => { e.stopPropagation(); if (status !== 'locked') onToggle(task.id); }}
  style={footerBtnStyle}
  className={`${footerBtnCls} relative overflow-hidden select-none`}
>
  {/* Progress fill при удержании */}
  {isHolding && (
    <div
      className="absolute inset-0 bg-(--color-danger)/20 origin-left"
      style={{ animation: 'hold-fill 5s linear forwards' }}
    />
  )}
  <span className="relative z-10">
    {status === 'completed' ? '✓ ВЫПОЛНЕНО'
      : status === 'locked' && isHolding ? 'Уже выполнил? Другалёк'
      : status === 'locked'              ? 'ЗАБЛОКИРОВАНО'
      : 'ВЫПОЛНЕНО?'}
  </span>
</button>
```

**EDIT: `src/app/globals.css`** — добавить keyframe:
```css
@keyframes hold-fill {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
```

**EDIT: `src/app/eft/progress/quests/QuestMapClient.tsx`**

Добавить `handleForceComplete`:
```ts
const handleForceComplete = useCallback((taskId: string) => {
  const { completedQuests: nowCompleted, toggleQuest } = useQuestStore.getState();
  // Каскадно выполнить все предыдущие незавершённые квесты в цепочке
  const ancestors = ancestorMap.get(taskId) ?? new Set<string>();
  for (const ancestorId of ancestors) {
    if (!nowCompleted.includes(ancestorId)) {
      toggleQuest(ancestorId);
    }
  }
  // Выполнить сам квест
  if (!nowCompleted.includes(taskId)) {
    toggleQuest(taskId);
  }
}, [ancestorMap]);
```

Передать в QuestNode: `onForceComplete: handleForceComplete`

### Верификация Sprint 7
- Найти заблокированный квест
- Зажать кнопку "ЗАБЛОКИРОВАНО" → полоска прогресса заполняется за 5 сек
- Текст меняется на "Уже выполнил? Другалёк" через ~1.5 сек
- Отпустить досрочно → прогресс сбрасывается, квест остаётся заблокированным
- Удержать до конца → квест и все предыдущие в цепочке выполняются

---

## СВОДНАЯ ТАБЛИЦА

| # | Спринт | Файлов читаем | Файлов пишем | Сложность |
|---|---|---|---|---|
| 1 | Hover FPS fix | 3 | 2 | HIGH |
| 2 | Fullscreen + Auto-unpin | 3 | 3 | LOW |
| 3 | nvg-green цвет | 3 | 1 | LOW |
| 4 | QuestResetModal | 3 | 3 | LOW |
| 5 | QuestFilterBar рерайт | 3 | 1 | MEDIUM |
| 6 | QuestStatusBar новый | 2 | 2 | MEDIUM |
| 7 | Force-complete 5s hold | 3 | 4 | HIGH |

**Порядок выполнения:** 1 → 2 → 3 → 4 → 5 → 6 → 7
Sprint 3 зависит от Sprint 1 (nvg-green в connections уже проставлен там).
Sprint 6 зависит от Sprint 2 (убирает кнопку fullscreen из правого угла).
