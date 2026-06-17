# Quest Map — User-Friendly Upgrade: Итерации UX-улучшений

> **Контекст:** Базовый квест-граф реализован (Sprint 1-4 в `quest-map-sprints.md`).  
> Данный документ описывает следующий слой — геймификацию и UX-интеллект поверх работающего канваса.

> **Правило для каждого спринта:** перед написанием кода с полями квестов — обязательно вызвать `/tarkov-api`, секция **Tasks (Quests) API**. Ключевые поля:
> 
> **После выполнения каждого спринта:** обновить его статус на `✅ DONE` в этом файле (`quest-map-user-friendly-upgrade-sprints.md`).
> - `minPlayerLevel` — Int, уровень ЧВК для открытия
> - `objectives[].foundInRaid` — Boolean, FiR-требование
> - `objectives[].__typename` — дискриминатор типа (`TaskObjectiveItem`, `TaskObjectiveShoot`, и др.)
> - `objectives[].item { id name shortName image512pxLink }` — только у `TaskObjectiveItem`
> - `taskRequirements[].task.id` — прямые предшественники (только прямые, не вся цепочка)
> - `objectives[].trader { normalizedName }` + `level` — у `TaskObjectiveTraderLevel`

---

## Глубокий UX-анализ: точки боли и возможности

### Что сейчас (после Sprint 1-4)

| Слой | Состояние | Проблема |
|---|---|---|
| Нода-карточка | Три статуса: locked / active / completed | `locked` не говорит ПОЧЕМУ — уровень? пререквизит? |
| Прогресс игрока | Не интегрирован с `usePlayerStore` | Уровень ЧВК игнорируется, нет персонализации |
| После "ВЫПОЛНЕНО" | Нода перекрашивается | Взгляд теряется — где следующий квест? |
| Объективы типа Item | Только показываются в Drawer | Нельзя отметить "нашёл 3 из 5" — нет трекинга |
| Новые разблокировки | Нет уведомления | Граф просто перекрашивается, событие не подсвечено |

### Что делаем

1. **Level Gate Intelligence** — разделить `locked` на подсостояния, показывать `ЛВЛ. N` с прогрессом
2. **Smart Focus-Next** — после выполнения квеста — автопан к следующему разблокированному
3. **Item Objective Tracker** — счётчики предметов с Zustand persist, мост к будущему "Трекеру Предметов"
4. **Cascade Unlock Animation** — визуальное событие "X квестов разблокировано"
5. **Item Tracker Bridge** — публичный API стора для cross-модульной интеграции

---

## ✅ DONE Предусловие: расширить GraphQL запрос

> Добавить в `getQuestMapTasks()` в `src/lib/eft-api.ts` недостающие поля, нужные для всех UX-спринтов.

**Файл:** `src/lib/eft-api.ts`

Добавить в запрос:
```graphql
objectives {
  id
  type
  description
  optional
  ... on TaskObjectiveItem {
    item { id name shortName image512pxLink }
    count
    foundInRaid
  }
  ... on TaskObjectiveShoot {
    target
    times
    shotType
  }
  ... on TaskObjectivePlayerLevel {
    playerLevel
  }
  ... on TaskObjectiveTraderLevel {
    trader { name normalizedName }
    level
  }
}
finishRewards {
  items { item { id name shortName image512pxLink } count }
  traderStanding { trader { name normalizedName } standing }
  experience
}
```

Также добавить в `TaskRaw` (в `src/types/quest.ts`) соответствующие типы — `objectives: TaskObjective[]` с union типами.

---

## ✅ DONE Sprint UX-1 — Level Gate Intelligence

**Цель:** Locked-нода должна объяснять ПОЧЕМУ заблокирована. Интеграция с `usePlayerStore`.

**Промпт:**
> Сначала вызови `/tarkov-api` и найди секцию **Tasks** — убедись в полях `minPlayerLevel`, `taskRequirements`, и секцию **Gamification Integration Patterns** — паттерн `levelLocked`. Затем:
>
> Quest Map UX Sprint 1 — Level Gate Intelligence.
>
> **1. Расширить `QuestNodeStatus` в `src/types/quest.ts`:**
> ```typescript
> export type QuestLockReason = 'level' | 'prereq' | 'both';
>
> export interface QuestNodeData {
>   task: TaskRaw;
>   status: QuestNodeStatus;
>   lockReason?: QuestLockReason;     // только когда status === 'locked'
>   levelGap?: number;                 // minPlayerLevel - playerLevel (> 0 когда locked-level)
>   dimmed?: boolean;
>   freshlyUnlocked?: boolean;
>   onToggle: (id: string) => void;
>   onSelect: (task: TaskRaw) => void;
> }
> ```
>
> **2. Обновить `computeStatusMap` в `QuestMapClient.tsx`:**
> Вместо возвращения `Map<string, QuestNodeStatus>` возвращать `Map<string, { status: QuestNodeStatus; lockReason?: QuestLockReason; levelGap?: number }>`.
> Логика:
> - `completedSet.has(id)` → `{ status: 'completed' }`
> - `prereqsAllDone && levelOk` → `{ status: 'active' }`
> - `!prereqsAllDone && !levelOk` → `{ status: 'locked', lockReason: 'both', levelGap: minPlayerLevel - playerLevel }`
> - `!prereqsAllDone && levelOk` → `{ status: 'locked', lockReason: 'prereq' }`
> - `prereqsAllDone && !levelOk` → `{ status: 'locked', lockReason: 'level', levelGap: minPlayerLevel - playerLevel }`
> Где `levelOk = playerLevel >= (task.minPlayerLevel ?? 0)`.
>
> **3. Обновить `QuestNode/index.tsx`:**
>
> Добавить четвёртый визуальный подрежим для `locked`:
> - `lockReason === 'level'` (пререквизиты ок, только уровень) → нода не совсем серая: `opacity-80` (не 60). Показывать Level Badge.
> - `lockReason === 'prereq'` → обычный locked.
> - `lockReason === 'both'` → самый dim: `opacity-50`.
>
> **Level Badge** (показывать если `lockReason === 'level' || lockReason === 'both'`):
> Абсолютно спозиционированный чип в правом нижнем углу ноды:
> `absolute bottom-1 right-1 flex items-center gap-0.5 rounded-xs px-1 py-0.5`
> - Если `levelGap <= 5` → `bg-[var(--primary)]/15 border border-[var(--primary)]/40 text-[var(--primary)]` (почти доступен)
> - Если `levelGap > 5` → `bg-lines-hover text-text-muted`
> - Содержимое: иконка `.icon-bg.icon-eft-profile-level w-2.5 h-2.5` + `span` с текстом `ЛВЛ. {task.minPlayerLevel}` (`text-[9px] font-blender-medium uppercase`)
>
> **Trader Level Badge** (показывать если у квеста есть `objectives` типа `TaskObjectiveTraderLevel` И соответствующий уровень трейдера у игрока не достигнут):
> Чип слева от Level Badge или под header'ом:
> `img` 12×12 `/images/traders/eft/{trader.normalizedName}.webp` + `ЛВЛ. {level}` — те же цвета.
> Данные берутся из `data.task.objectives.filter(o => o.__typename === 'TaskObjectiveTraderLevel')`.
> Проверка по `usePlayerStore` — `profile.traderLevels[normalizedName] < required.level`.
>
> **4. Подписка на `usePlayerStore` в `QuestMapClient.tsx`:**
> ```typescript
> import { usePlayerStore } from '@/store/usePlayerStore';
> const profiles = usePlayerStore(s => s.profiles);
> const activeId = usePlayerStore(s => s.activeProfileId);
> const activeProfile = profiles.find(p => p.id === activeId);
> const playerLevel = Number(activeProfile?.level ?? 1);
> const traderLevels = activeProfile?.traderLevels ?? {};
> ```
> Передавать `traderLevels` в `QuestNode` через `data.traderLevels`.
>
> **Файлы:**
> - `src/types/quest.ts` (MODIFY — добавить `QuestLockReason`, обновить `QuestNodeData`)
> - `src/app/eft/progress/quests/QuestMapClient.tsx` (MODIFY — обновить `computeStatusMap` + `usePlayerStore`)
> - `src/components/features/quests/QuestNode/index.tsx` (MODIFY — Level Badge + Trader Badge)

---

## ✅ DONE Sprint UX-2 — Smart Focus-Next on Completion

**Цель:** После нажатия "ВЫПОЛНЕНО?" — камера плавно смещается к следующему разблокированному квесту в ветке.

**Промпт:**
> Вызови `/tarkov-api` — секция Tasks, поле `taskRequirements[].task.id`. Подтверди что это ПРЯМЫЕ предшественники. Затем:
>
> Quest Map UX Sprint 2 — Smart Focus-Next on Completion.
>
> Реализовать авто-фокус на следующий квест после выполнения и анимацию "freshly unlocked" на нодах.
>
> **1. Построить обратный индекс зависимостей (`childrenMap`):**
> В `QuestMapClient.tsx` добавить `useMemo`:
> ```typescript
> const childrenMap = useMemo(() => {
>   const map = new Map<string, string[]>(); // parentId → [childId, ...]
>   for (const task of initialTasks) {
>     for (const req of task.taskRequirements) {
>       const children = map.get(req.task.id) ?? [];
>       children.push(task.id);
>       map.set(req.task.id, children);
>     }
>   }
>   return map;
> }, [initialTasks]);
> ```
>
> **2. Состояние `freshlyUnlocked`:**
> ```typescript
> const [freshlyUnlocked, setFreshlyUnlocked] = useState<Set<string>>(new Set());
> ```
>
> **3. Обёртка `handleToggle` вокруг `toggleQuest`:**
> ```typescript
> const rf = useReactFlow();
>
> const handleToggle = useCallback((taskId: string) => {
>   const wasCompleted = completedQuests.includes(taskId);
>   toggleQuest(taskId);
>
>   if (!wasCompleted) {
>     // Квест только что ВЫПОЛНЕН — ищем новые разблокировки
>     const candidateIds = childrenMap.get(taskId) ?? [];
>     const newlyActive = candidateIds.filter(childId => {
>       const childTask = initialTasks.find(t => t.id === childId);
>       if (!childTask) return false;
>       const newCompleted = new Set([...completedQuests, taskId]);
>       const allPrereqsDone = childTask.taskRequirements.every(r => newCompleted.has(r.task.id));
>       const levelOk = playerLevel >= (childTask.minPlayerLevel ?? 0);
>       return allPrereqsDone && levelOk;
>     });
>
>     if (newlyActive.length > 0) {
>       setFreshlyUnlocked(new Set(newlyActive));
>       setTimeout(() => setFreshlyUnlocked(new Set()), 4000);
>
>       // Фокус на первый разблокированный квест
>       const targetNode = rf.getNode(newlyActive[0]);
>       if (targetNode) {
>         rf.setCenter(
>           targetNode.position.x + 110,  // 110 = половина ширины ноды (220px)
>           targetNode.position.y + 44,   // 44 = половина высоты ноды (88px)
>           { zoom: 1.4, duration: 700 }
>         );
>       }
>     }
>   }
> }, [completedQuests, toggleQuest, childrenMap, initialTasks, playerLevel, rf]);
> ```
>
> Передавать `handleToggle` вместо `toggleQuest` в `data.onToggle`.
>
> **4. Анимация "Freshly Unlocked" в `QuestNode/index.tsx`:**
> Если `data.freshlyUnlocked === true` — добавить к ноде ring-анимацию через CSS keyframes:
> `animate-[fresh-unlock_0.6s_ease-out]` — класс в `globals.css`:
> ```css
> @keyframes fresh-unlock {
>   0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 60%, transparent); }
>   50%  { box-shadow: 0 0 0 8px color-mix(in srgb, var(--primary) 20%, transparent); }
>   100% { box-shadow: 0 0 0 0 transparent; }
> }
> ```
> Badge "НОВЫЙ" — абсолютно `top-[-8px] left-1/2 -translate-x-1/2`:
> `text-[8px] font-blender-medium uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-(--primary) text-(--color-base) animate-pulse`
> Скрывается вместе с `freshlyUnlocked` (4 сек).
>
> **5. Floating Unlock Toast (если > 1 разблокировки):**
> Если `newlyActive.length > 1` — показать тост в правом нижнем углу канваса (над ReactFlow):
> `absolute bottom-4 right-4 z-50 flex items-center gap-2 rounded-xs border border-(--primary)/40 bg-card-menu px-3 py-2`
> Текст: `.icon-bg.icon-eft-quests-unlock w-3 h-3` + `Разблокировано: {newlyActive.length} квестов` (`text-[10px] font-blender-medium uppercase text-(--primary)`)
> Тост появляется с `opacity-0 → opacity-100 transition-opacity duration-300` и скрывается через 4 сек.
>
> **Файлы:**
> - `src/app/eft/progress/quests/QuestMapClient.tsx` (MODIFY)
> - `src/components/features/quests/QuestNode/index.tsx` (MODIFY)
> - `src/app/globals.css` (MODIFY — добавить `@keyframes fresh-unlock`)

---

## ✅ DONE Sprint UX-3 — Interactive Item Objective Tracker

**Цель:** Для квестов с `TaskObjectiveItem` — интерактивный счётчик найденных предметов с Zustand persist. Мост к будущему разделу "Трекер Предметов".

**Промпт:**
> Сначала вызови `/tarkov-api` — секция Tasks, блок `TaskObjectiveItem` с полями `item { id name shortName image512pxLink }`, `count`, `foundInRaid`. Также проверь секцию Gamification Integration Patterns — паттерн `neededForActiveQuest`. Затем:
>
> Quest Map UX Sprint 3 — Interactive Item Objective Tracker.
>
> **1. Расширить `useQuestStore` (`src/store/useQuestStore.ts`):**
> Добавить в store поле `itemProgress` и экшны:
> ```typescript
> interface QuestStore {
>   completedQuests: string[];
>   toggleQuest: (id: string) => void;
>   resetProgress: () => void;
>
>   // NEW: Item tracking
>   // Map: questId → Map: objectiveId → foundCount
>   itemProgress: Record<string, Record<string, number>>;
>   setItemCount: (questId: string, objectiveId: string, count: number) => void;
>   incrementItem: (questId: string, objectiveId: string, max: number) => void;
>   decrementItem: (questId: string, objectiveId: string) => void;
>   resetItemProgress: (questId: string) => void;
>   getItemCount: (questId: string, objectiveId: string) => number;
> }
> ```
>
> Реализация:
> ```typescript
> itemProgress: {},
>
> setItemCount: (questId, objectiveId, count) => set(s => ({
>   itemProgress: {
>     ...s.itemProgress,
>     [questId]: { ...(s.itemProgress[questId] ?? {}), [objectiveId]: Math.max(0, count) }
>   }
> })),
>
> incrementItem: (questId, objectiveId, max) => set(s => {
>   const current = s.itemProgress[questId]?.[objectiveId] ?? 0;
>   return {
>     itemProgress: {
>       ...s.itemProgress,
>       [questId]: { ...(s.itemProgress[questId] ?? {}), [objectiveId]: Math.min(max, current + 1) }
>     }
>   };
> }),
>
> decrementItem: (questId, objectiveId) => set(s => {
>   const current = s.itemProgress[questId]?.[objectiveId] ?? 0;
>   return {
>     itemProgress: {
>       ...s.itemProgress,
>       [questId]: { ...(s.itemProgress[questId] ?? {}), [objectiveId]: Math.max(0, current - 1) }
>     }
>   };
> }),
>
> resetItemProgress: (questId) => set(s => {
>   const { [questId]: _, ...rest } = s.itemProgress;
>   return { itemProgress: rest };
> }),
>
> getItemCount: (questId, objectiveId) =>
>   get().itemProgress[questId]?.[objectiveId] ?? 0,
> ```
>
> В `partialize` добавить `itemProgress: s.itemProgress`.
>
> **2. Создать `src/components/features/quests/QuestItemTracker/index.tsx`:**
> Props: `{ task: TaskRaw }` — рендерит список только `TaskObjectiveItem` objectives.
>
> Структура компонента:
> ```
> div.flex.flex-col.gap-1
>   for each objective:
>     div.flex.items-center.gap-2.py-1 (border-b border-lines-hover последнего нет)
>       img 24×24 из objective.item.image512pxLink (rounded-xs)
>       div.flex-1.flex.flex-col
>         span.text-[10px].font-blender-medium.uppercase.text-text-primary → objective.item.shortName
>         if foundInRaid: span.text-[8px].font-blender-medium.text-[var(--primary)] → "НАЙДЕНО В РЕЙДЕ"
>       div.flex.items-center.gap-1 (счётчик)
>         button.decrement [−] w-5 h-5
>         span.text-xs.font-blender-medium.w-8.text-center → "{found} / {total}"
>         button.increment [+] w-5 h-5
>       div.w-3.h-3 → иконка ✓ если found >= total (text-success)
> ```
>
> Стили кнопок декремент/инкремент:
> `flex items-center justify-center rounded-xs border border-lines-hover bg-lines-hover/50 text-text-secondary hover:border-(--primary)/50 hover:text-(--primary) transition-colors text-xs font-blender-medium`
>
> Прогресс-бар под списком (суммарный по всем item-objectives):
> `div.h-0.5.w-full.bg-lines-hover.rounded-full.mt-2`
>   `div.h-full.rounded-full.transition-all.duration-300` ширина = `${totalFound/totalNeeded * 100}%`
>   цвет: `bg-(--primary)` если < 100%, `bg-success` если 100%
>
> Если нет TaskObjectiveItem objectives → компонент возвращает `null`.
>
> **3. Добавить `QuestItemTracker` в `QuestDrawer/index.tsx`:**
> Разместить после списка всех objectives как отдельную секцию:
> ```tsx
> {/* Трекер предметов */}
> {task.objectives.some(o => o.__typename === 'TaskObjectiveItem') && (
>   <div className="border-t border-lines-hover pt-3 mt-3">
>     <div className="text-[10px] font-blender-medium uppercase tracking-widest text-text-muted mb-2">
>       Трекер предметов
>     </div>
>     <QuestItemTracker task={task} />
>   </div>
> )}
> ```
>
> **4. Mini-прогресс в `QuestNode/index.tsx`:**
> Только для `active` статуса: если у квеста есть `TaskObjectiveItem` objectives —
> показать тонкую прогресс-полоску `h-0.5` внизу карточки (перед кнопкой или под ней):
> ```tsx
> {data.status === 'active' && hasItemObjectives && (
>   <div className="h-0.5 w-full bg-lines-hover rounded-full mt-1">
>     <div
>       className="h-full rounded-full bg-(--primary)/60 transition-all duration-300"
>       style={{ width: `${itemCompletionPct}%` }}
>     />
>   </div>
> )}
> ```
> Вычислить `itemCompletionPct` через `useQuestStore(s => s.itemProgress)[task.id]`.
>
> **5. Публичная функция-мост (для будущего "Трекера Предметов"):**
> В `src/store/useQuestStore.ts` экспортировать вспомогательную функцию:
> ```typescript
> // Возвращает все item objectives из активных квестов с текущим прогрессом
> // Используется в будущем разделе /eft/progress/items
> export function getActiveItemRequirements(
>   tasks: TaskRaw[],
>   completedQuests: string[],
>   itemProgress: Record<string, Record<string, number>>
> ): Array<{
>   questId: string;
>   questName: string;
>   objectiveId: string;
>   item: { id: string; name: string; shortName: string; image512pxLink: string };
>   needed: number;
>   found: number;
>   foundInRaid: boolean;
> }> {
>   const completedSet = new Set(completedQuests);
>   return tasks
>     .filter(t => !completedSet.has(t.id))
>     .flatMap(t =>
>       t.objectives
>         .filter((o): o is TaskObjectiveItem => o.__typename === 'TaskObjectiveItem')
>         .map(o => ({
>           questId: t.id,
>           questName: t.name,
>           objectiveId: o.id,
>           item: o.item,
>           needed: o.count,
>           found: itemProgress[t.id]?.[o.id] ?? 0,
>           foundInRaid: o.foundInRaid,
>         }))
>     );
> }
> ```
>
> **Файлы:**
> - `src/store/useQuestStore.ts` (MODIFY — добавить `itemProgress` + экшны + `getActiveItemRequirements`)
> - `src/types/quest.ts` (MODIFY — добавить `TaskObjectiveItem` и другие union types если ещё не добавлены)
> - `src/components/features/quests/QuestItemTracker/index.tsx` (NEW)
> - `src/components/features/quests/QuestDrawer/index.tsx` (MODIFY — вставить `QuestItemTracker`)
> - `src/components/features/quests/QuestNode/index.tsx` (MODIFY — mini progress bar)

---

## ✅ DONE Sprint UX-4 — Objective Type Icons + QuestDrawer UX Upgrade

**Цель:** Визуально разделить типы задач в Drawer. Добавить XP и awards в удобном формате.

**Промпт:**
> Вызови `/tarkov-api` — секция Tasks, таблицу "Типы objectives" (все 6 типов и их `__typename`), поле `finishRewards { experience, items, traderStanding }`. Проверь точные имена. Затем:
>
> Quest Map UX Sprint 4 — Objective Type Icons + Drawer UX.
>
> **1. Objective Icon Map:**
> В `QuestDrawer/index.tsx` добавить маппинг `__typename` → иконка (CSS icon class):
> ```typescript
> const OBJECTIVE_ICON: Record<string, string> = {
>   TaskObjectiveItem:        'icon-eft-quest-obj-item',
>   TaskObjectiveMark:        'icon-eft-quest-obj-mark',
>   TaskObjectiveShoot:       'icon-eft-quest-obj-shoot',
>   TaskObjectiveLocation:    'icon-eft-quest-obj-location',
>   TaskObjectivePlayerLevel: 'icon-eft-profile-level',
>   TaskObjectiveTraderLevel: 'icon-eft-quests-trader',
> };
> ```
> Если иконки CSS не существуют — использовать `.icon-bg.icon-eft-quests-active` как fallback.
>
> **2. Restructure Drawer sections:**
>
> Структура Drawer (сверху вниз):
> ```
> HEADER (trader img 32×32 + quest name + kappa/LK badges + close button)
> ─────────────────────────────────────────────
> SECTION: Задачи
>   for each objective:
>     row: [icon 12×12] [description] [optional badge если optional: true]
>     if TaskObjectiveItem: подстрочник с item.shortName + FiR бейдж + (found/needed)
>     if TaskObjectiveShoot: подстрочник "{times}× {target} | {distance}м | {shotType}"
>     if TaskObjectiveTraderLevel: trader img + "ЛВЛ. {level}"
> ─────────────────────────────────────────────
> SECTION: Трекер предметов (только если есть TaskObjectiveItem objectives)
>   <QuestItemTracker task={task} />
> ─────────────────────────────────────────────
> SECTION: Награды
>   XP row: icon-bg.icon-eft-profile-xp + "{task.experience.toLocaleString('ru-RU')} XP"
>   items: горизонтальный scroll strip с img 32×32 + count badge
>   traderStanding: trader img 16×16 + "+{standing} репутация" per trader
> ─────────────────────────────────────────────
> FOOTER: кнопка ВЫПОЛНЕНО / ОТМЕНИТЬ с drag-lock (nodrag)
> ```
>
> **3. Стилизация секций Drawer:**
> Секции разделяются `border-t border-lines-hover`, заголовки секций:
> `text-[9px] font-blender-medium uppercase tracking-widest text-text-muted px-4 pt-3 pb-1.5`
>
> **4. Optional objective styling:**
> Если `objective.optional === true` — всю строку в `opacity-50` + `italic`-тег + бейдж `[НЕ ОБЯЗАТЕЛЬНО]` справа (`text-[8px] font-blender-medium uppercase text-text-muted border border-lines-hover rounded-xs px-1`).
>
> **Файлы:**
> - `src/components/features/quests/QuestDrawer/index.tsx` (MODIFY — полный UX редизайн)

---

## ✅ DONE Sprint UX-5 — MiniMap + Search Overlay + QuestMap Polish

**Цель:** Навигация по графу из 290 нод — UX must. MiniMap + поиск по имени квеста.

**Промпт:**
> Quest Map UX Sprint 5 — Navigation polish.
>
> **1. ReactFlow MiniMap:**
> В `QuestMapClient.tsx` добавить `<MiniMap>` из `@xyflow/react`:
> ```tsx
> import { MiniMap } from '@xyflow/react';
>
> // Внутри <ReactFlow>:
> <MiniMap
>   nodeColor={(node) => {
>     const status = node.data?.status as QuestNodeStatus;
>     if (status === 'completed') return '#6A8B5D';
>     if (status === 'active') return 'var(--primary)';
>     return 'rgba(255,255,255,0.08)';
>   }}
>   nodeBorderRadius={2}
>   maskColor="rgba(0,0,0,0.7)"
>   style={{
>     background: 'var(--color-card-menu)',
>     border: '1px solid var(--color-lines-hover)',
>   }}
>   className="bottom-10! right-4!"
>   pannable
>   zoomable
> />
> ```
>
> **2. Search Overlay:**
> Создать `src/components/features/quests/QuestSearch/index.tsx`.
> State: `query: string`, `results: TaskRaw[]` (filter по `task.name.toLowerCase().includes(query)`).
> Открывается кнопкой в `QuestFilterBar` (иконка `.icon-bg.icon-eft-search`).
> Popup: `absolute top-full left-0 w-64 z-50 bg-card-menu border border-lines-hover rounded-xs shadow-xl mt-1`
> Список результатов (max 8): клик → `rf.setCenter(node.position.x + 110, node.position.y + 44, { zoom: 1.5, duration: 500 })` + закрыть popup.
> Подсветка части имени совпадающей с query (bold/primary цвет).
>
> **3. Keyboard shortcut:**
> В `QuestMapClient.tsx` добавить `useEffect` для `Ctrl+F` / `Cmd+F` (prevent default) → открыть поиск.
>
> **4. Статус-бар внизу канваса:**
> `absolute bottom-0 left-0 right-0 z-10 h-8 flex items-center px-4 gap-4 border-t border-lines-hover bg-card-menu/80 backdrop-blur-sm`
> Содержит:
> - Всего: `{total}` квестов
> - Выполнено: `{completed}` (`text-success`)
> - Каппа: `{kappaCompleted}/{kappaTotal}` (если фильтр Kappa включён)
> - Уровень ЧВК: иконка `.icon-eft-profile-level` + `{playerLevel} ЛВЛ.`
>
> **Файлы:**
> - `src/app/eft/progress/quests/QuestMapClient.tsx` (MODIFY)
> - `src/components/features/quests/QuestSearch/index.tsx` (NEW)
> - `src/components/features/quests/QuestFilterBar/index.tsx` (MODIFY — добавить кнопку поиска)

---

## ✅ DONE Sprint UX-6 — Chain Highlight (Ancestor/Descendant Traversal)

**Цель:** При наведении на ноду — подсветить всю цепочку пресквизитов (синим) и всех потомков (акцентным). Игрок сразу видит «что нужно сделать до» и «что откроется после».

**Промпт:**
> Quest Map UX Sprint 6 — Chain Highlight on hover.
>
> **1. Построить `ancestorMap` в `QuestMapClient.tsx`:**
> ```typescript
> const ancestorMap = useMemo(() => {
>   // taskId → Set всех прямых и транзитивных предшественников
>   const map = new Map<string, Set<string>>();
>   function getAncestors(id: string): Set<string> {
>     if (map.has(id)) return map.get(id)!;
>     const result = new Set<string>();
>     const task = initialTasks.find(t => t.id === id);
>     if (!task) { map.set(id, result); return result; }
>     for (const req of task.taskRequirements) {
>       result.add(req.task.id);
>       for (const a of getAncestors(req.task.id)) result.add(a);
>     }
>     map.set(id, result);
>     return result;
>   }
>   for (const t of initialTasks) getAncestors(t.id);
>   return map;
> }, [initialTasks]);
> ```
> `childrenMap` уже есть из UX-2 — использовать его для потомков (аналогично транзитивно через рекурсию или итерацию BFS).
>
> **2. Состояние `hoveredId`:**
> ```typescript
> const [hoveredId, setHoveredId] = useState<string | null>(null);
> ```
> Передавать в `QuestNodeData` новые поля:
> ```typescript
> chainRole?: 'ancestor' | 'descendant' | 'self' | null;
> onHover: (id: string | null) => void;
> ```
> В `buildLayout` вычислять `chainRole` для каждой ноды на основе `hoveredId` + `ancestorMap` + `childrenMap`.
>
> **3. Визуал в `QuestNode/index.tsx`:**
> - `chainRole === 'self'` → кольцо `ring-2 ring-(--primary)` вокруг ноды
> - `chainRole === 'ancestor'` → кольцо `ring-1 ring-sky-500/60`, лёгкий `bg-sky-500/5`
> - `chainRole === 'descendant'` → кольцо `ring-1 ring-(--primary)/60`, лёгкий `bg-(--primary)/5`
> - `chainRole === null && hoveredId !== null` → `opacity-30` (все остальные гасятся)
> - Переход через `transition-all duration-150`
>
> **4. Edge highlighting:**
> В `buildLayout` при `hoveredId !== null` — рёбра в цепочке (ancestor→self, self→descendant) получают `stroke: var(--primary)` и `opacity: 1`; остальные → `opacity: 0.05`.
>
> **Файлы:**
> - `src/app/eft/progress/quests/QuestMapClient.tsx` (MODIFY — ancestorMap, hoveredId, chainRole логика)
> - `src/types/quest.ts` (MODIFY — добавить `chainRole`, `onHover` в `QuestNodeData`)
> - `src/components/features/quests/QuestNode/index.tsx` (MODIFY — chain визуал)

> **После выполнения:** обновить статус на `✅ DONE` в этом файле.

---

## ✅ DONE Sprint UX-7 — Трекер Предметов (`/eft/progress/tracker`)

**Цель:** Отдельная страница `/eft/progress/tracker` с заголовком **"Трекер Предметов"** — агрегированный вид всех предметов, нужных для активных квестов. Использует bridge API `getActiveItemRequirements` из UX-3.

**Роут:** `src/app/eft/progress/tracker/` — название страницы "Трекер Предметов", добавить в навигацию прогресса рядом с "Квест-карта".

**Промпт:**
> Перед кодом вызови `/tarkov-api` секция Tasks — убедись в полях `TaskObjectiveItem.item`, `count`, `foundInRaid`. Затем вызови `/page` для создания нового роута по адресу `/eft/progress/tracker`.
>
> Quest Map UX Sprint 7 — Item Tracker Page `/eft/progress/tracker`.
>
> **1. Server Component `src/app/eft/progress/tracker/page.tsx`:**
> ```typescript
> import { getQuestMapTasks } from '@/lib/eft-api';
> import ItemTrackerClient from './ItemTrackerClient';
>
> export const metadata = { title: 'Трекер Предметов — CTA' };
>
> export default async function ItemTrackerPage() {
>   const tasks = await getQuestMapTasks();
>   return <ItemTrackerClient initialTasks={tasks} />;
> }
> ```
>
> **2. Client Component `src/app/eft/progress/tracker/ItemTrackerClient.tsx`:**
> ```typescript
> import { useQuestStore, getActiveItemRequirements } from '@/store/useQuestStore';
>
> const completedQuests = useQuestStore(s => s.completedQuests);
> const itemProgress    = useQuestStore(s => s.itemProgress);
> const activeItems     = getActiveItemRequirements(tasks, completedQuests, itemProgress);
>
> // Группировка по item.id:
> // grouped[item.id] = { item, totalNeeded, totalFound, foundInRaid, quests: [{questId, questName, needed, found}] }
> ```
>
> **3. Карточка предмета:**
> ```
> div (border border-lines-hover rounded-xs bg-card-menu p-3)
>   header: img 40×40 (image512pxLink) + item.name (font-blender-medium) + shortName badge
>           + если foundInRaid: бейдж "НАЙДЕНО В РЕЙДЕ" (text-(--primary))
>   progress: "X / Y найдено" + прогресс-бар (bg-(--primary) если < 100%, bg-success если 100%)
>   список квестов где нужен предмет:
>     trader img 12×12 + quest.questName + "×{needed}" + (+/- кнопки для этого конкретного квеста)
> ```
>
> **4. Сортировка и фильтры:**
> - Сортировка: по % выполнения (сначала начатые), по имени, по количеству
> - Фильтр: "только FiR", "только незавершённые"
> - Поиск по имени предмета (input сверху)
>
> **5. Добавить пункт в навигацию `/eft/progress/`:**
> Рядом с "Квест-карта" добавить таб **"Трекер Предметов"** с href `/eft/progress/tracker`.
>
> **Файлы:**
> - `src/app/eft/progress/tracker/page.tsx` (NEW)
> - `src/app/eft/progress/tracker/ItemTrackerClient.tsx` (NEW)
> - Навигация прогресса (MODIFY — добавить таб "Трекер Предметов" → `/eft/progress/tracker`)

> **После выполнения:** обновить статус на `✅ DONE` в этом файле.

---

## ⏳ Sprint UX-8 — Progress Export / Import

**Цель:** Экспорт прогресса квестов и предметов в JSON-файл, импорт обратно. Позволяет переносить прогресс между устройствами и делиться с другими.

**Промпт:**
> Quest Map UX Sprint 8 — Progress Export/Import.
>
> **1. Функции сериализации в `useQuestStore.ts`:**
> ```typescript
> export function exportProgress(
>   completedQuests: string[],
>   itemProgress: Record<string, Record<string, number>>
> ): string {
>   return JSON.stringify({ version: 1, completedQuests, itemProgress }, null, 2);
> }
>
> export function importProgress(json: string): {
>   completedQuests: string[];
>   itemProgress: Record<string, Record<string, number>>;
> } | null {
>   try {
>     const data = JSON.parse(json);
>     if (data.version !== 1) return null;
>     if (!Array.isArray(data.completedQuests)) return null;
>     return { completedQuests: data.completedQuests, itemProgress: data.itemProgress ?? {} };
>   } catch { return null; }
> }
> ```
>
> **2. Добавить `loadProgress` экшн в стор:**
> ```typescript
> loadProgress: (completedQuests: string[], itemProgress: Record<string, Record<string, number>>) =>
>   set({ completedQuests, itemProgress }),
> ```
>
> **3. UI в `QuestFilterBar` (или отдельный `ProgressImportExport`):**
> Кнопки "Экспорт" и "Импорт" в `ml-auto` зоне (правее кнопки сброса).
>
> Экспорт → `URL.createObjectURL(new Blob([json], { type: 'application/json' }))` + автоскачивание `cta-progress-{date}.json`.
>
> Импорт → `<input type="file" accept=".json">` (скрытый), клик по кнопке триггерит его. После выбора файла: `FileReader.readAsText` → `importProgress` → если валидно: `loadProgress` + toast "Прогресс загружен: N квестов". Если невалидно → toast с ошибкой.
>
> **4. Confirm dialog перед импортом:**
> Простой `window.confirm("Заменить текущий прогресс?")` — не делать кастомный модал.
>
> **Файлы:**
> - `src/store/useQuestStore.ts` (MODIFY — добавить `exportProgress`, `importProgress`, `loadProgress`)
> - `src/components/features/quests/QuestFilterBar/index.tsx` (MODIFY — кнопки Export/Import)

> **После выполнения:** обновить статус на `✅ DONE` в этом файле.

---

## ⏳ Sprint UX-9 — Quest Pins & Personal Notes

**Цель:** Личные пометки к квестам — закреплённые (Pinned), отложенные (Snoozed) и приоритетные. Сохраняются в Zustand persist. Pinned-квесты показываются в верхнем виджете над графом.

**Промпт:**
> Quest Map UX Sprint 9 — Quest Pins & Notes.
>
> **1. Расширить `useQuestStore`:**
> ```typescript
> pinnedQuests: string[];        // ids квестов в закладках
> togglePin: (id: string) => void;
> questNotes: Record<string, string>; // questId → текст заметки
> setNote: (id: string, note: string) => void;
> ```
> В `partialize` добавить оба поля.
>
> **2. Pin Badge на `QuestNode`:**
> Если `completedQuests` не содержит id и квест запинен — абсолютно `top-[-8px] right-1` маленькая иконка-кнопка `icon-eft-pin` (или `📌` fallback). Нажатие снимает пин. Цвет: `text-(--primary)`.
>
> **3. Виджет Pinned Quests над графом:**
> Горизонтальная полоска между `QuestFilterBar` и `ReactFlow`:
> `flex items-center gap-2 px-3 py-1.5 border-b border-lines-hover bg-card-menu/60 overflow-x-auto shrink-0`
> Рендерится только если `pinnedQuests.length > 0`.
> Чипы: `img` трейдера 14×14 + название квеста (truncate max-w-32) + крестик для снятия пина.
> Клик на чип (не на крестик) → `rfInstance.setCenter` к этой ноде (как в Search).
>
> **4. Поле для заметки в `QuestDrawer`:**
> После секции "Задачи" добавить коллапсируемую секцию "Заметка":
> `<textarea>` с `resize-none`, 3 строки, `bg-lines-hover/30 border border-lines-hover rounded-xs p-2 text-[11px] font-blender-book`.
> `onBlur` → `setNote(task.id, value)`. Плейсхолдер: "Личная заметка...".
> Если заметка непустая — секция открыта по умолчанию.
>
> **Файлы:**
> - `src/store/useQuestStore.ts` (MODIFY — `pinnedQuests`, `togglePin`, `questNotes`, `setNote`)
> - `src/types/quest.ts` (MODIFY — добавить `pinned?: boolean` в `QuestNodeData`)
> - `src/components/features/quests/QuestNode/index.tsx` (MODIFY — Pin Badge)
> - `src/app/eft/progress/quests/QuestMapClient.tsx` (MODIFY — Pinned Quests виджет)
> - `src/components/features/quests/QuestDrawer/index.tsx` (MODIFY — Notes секция)

> **После выполнения:** обновить статус на `✅ DONE` в этом файле.

---

## ⏳ Sprint UX-10 — Map Filter (In-game Locations)

**Цель:** Фильтрация квестов по игровой локации. Для квестов с `TaskObjectiveLocation` — показать чипы карт в `QuestFilterBar`. Квесты без привязки к карте остаются видимы всегда.

**Промпт:**
> Вызови `/tarkov-api` — секция Tasks, `TaskObjectiveLocation.map { id name normalizedName }`. Убедись в структуре. Затем:
>
> Quest Map UX Sprint 10 — Map Location Filter.
>
> **1. Извлечь уникальные карты из квестов:**
> ```typescript
> const maps = useMemo(() => {
>   const seen = new Map<string, { id: string; name: string; normalizedName: string }>();
>   for (const task of tasks) {
>     for (const obj of task.objectives) {
>       if (obj.__typename === 'TaskObjectiveLocation' && obj.map) {
>         seen.set(obj.map.id, obj.map);
>       }
>     }
>   }
>   return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
> }, [tasks]);
> ```
>
> **2. State `selectedMaps: Set<string>` в `QuestMapClient`:**
> Аналогично `selectedTraders` — передаётся в `QuestFilterBar` и `computeFilteredIds`.
>
> **3. Логика фильтрации:**
> Если `selectedMaps.size > 0` — показывать только квесты, у которых хотя бы один `TaskObjectiveLocation.map.id` входит в `selectedMaps`.
> Квесты без `TaskObjectiveLocation` objectives — НЕ скрывать (они не привязаны к локации).
>
> **4. UI в `QuestFilterBar`:**
> Новая строка (или блок после трейдеров) с map-чипами.
> Иконка: `/images/maps/eft/{normalizedName}.webp` 16×16 (если нет — `icon-eft-map` fallback).
> Те же стили что у trader chips.
>
> **5. Обновить `computeFilteredIds`:**
> ```typescript
> function computeFilteredIds(
>   tasks: TaskRaw[],
>   filterKappa: boolean,
>   filterLK: boolean,
>   selectedTraders: Set<string>,
>   selectedMaps: Set<string>,   // NEW
> ): Set<string> | null
> ```
>
> **Файлы:**
> - `src/app/eft/progress/quests/QuestMapClient.tsx` (MODIFY — selectedMaps state + передача в filterBar/computeFilteredIds)
> - `src/components/features/quests/QuestFilterBar/index.tsx` (MODIFY — map chips секция + новый проп)

> **После выполнения:** обновить статус на `✅ DONE` в этом файле.

---

## Схема зависимостей между спринтами

```
Sprint 1 (базовый граф) ─┐
                          ├─► UX-1 (Level Gate) ─────────────────────────────┐
                          │                                                    │
                          ├─► UX-2 (Focus-Next) ← зависит от UX-1 статусов   │
                          │                                                    ▼
                          └─► UX-3 (Item Tracker) ──────────────────► UX-4 (Drawer UX)
                                      │
                                      └─► getActiveItemRequirements() ──► UX-7 (/eft/progress/items)

UX-5 (MiniMap/Search) — независим, можно параллельно с UX-3/UX-4
UX-6 (Chain Highlight) — зависит от UX-2 (childrenMap уже есть)
UX-8 (Export/Import) — независим от UX-6/UX-7
UX-9 (Pins/Notes) — независим, можно после UX-4 (Drawer готов)
UX-10 (Map Filter) — независим
```

---

## Типы и расширения (`src/types/quest.ts`)

Полная типизация для всех спринтов. Реализовать в Предусловии или UX-1:

```typescript
export type QuestNodeStatus = 'locked' | 'active' | 'completed';
export type QuestLockReason = 'level' | 'prereq' | 'both';

export interface TaskObjectiveBase {
  id: string;
  type: string;
  description: string;
  optional: boolean;
  __typename: string;
}

export interface TaskObjectiveItem extends TaskObjectiveBase {
  __typename: 'TaskObjectiveItem';
  item: { id: string; name: string; shortName: string; image512pxLink: string };
  count: number;
  foundInRaid: boolean;
}

export interface TaskObjectiveShoot extends TaskObjectiveBase {
  __typename: 'TaskObjectiveShoot';
  target: string;
  times: number;
  shotType: string;
  distance: number | null;
}

export interface TaskObjectiveMark extends TaskObjectiveBase {
  __typename: 'TaskObjectiveMark';
  markerItem: { id: string; name: string; shortName: string; image512pxLink: string };
}

export interface TaskObjectiveLocation extends TaskObjectiveBase {
  __typename: 'TaskObjectiveLocation';
  map: { id: string; name: string; normalizedName: string } | null;
}

export interface TaskObjectivePlayerLevel extends TaskObjectiveBase {
  __typename: 'TaskObjectivePlayerLevel';
  playerLevel: number;
}

export interface TaskObjectiveTraderLevel extends TaskObjectiveBase {
  __typename: 'TaskObjectiveTraderLevel';
  trader: { name: string; normalizedName: string };
  level: number;
}

export type TaskObjective =
  | TaskObjectiveItem
  | TaskObjectiveShoot
  | TaskObjectiveMark
  | TaskObjectiveLocation
  | TaskObjectivePlayerLevel
  | TaskObjectiveTraderLevel
  | TaskObjectiveBase;

export interface FinishRewards {
  items: Array<{
    item: { id: string; name: string; shortName: string; image512pxLink: string };
    count: number;
  }>;
  traderStanding: Array<{
    trader: { name: string; normalizedName: string };
    standing: number;
  }>;
  experience: number;
}

export interface TaskRaw {
  id: string;
  name: string;
  normalizedName: string;
  trader: { name: string; normalizedName: string; imageLink?: string };
  minPlayerLevel: number | null;
  kappaRequired: boolean;
  lightkeeperRequired: boolean;
  experience: number;
  taskRequirements: Array<{ task: { id: string; name: string } }>;
  objectives: TaskObjective[];
  finishRewards: FinishRewards;
}

export interface QuestNodeData {
  task: TaskRaw;
  status: QuestNodeStatus;
  lockReason?: QuestLockReason;
  levelGap?: number;
  dimmed?: boolean;
  freshlyUnlocked?: boolean;
  traderLevels?: Record<string, number>;
  onToggle: (id: string) => void;
  onSelect: (task: TaskRaw) => void;
}
```

---

## Связь с "Трекером Предметов" (`/eft/progress/items`)

После реализации UX-3, раздел "Трекер Предметов" может использовать:

```typescript
// В Server Component страницы /eft/progress/items:
// Данные квестов загружаются так же через getQuestMapTasks()
// В Client Component:
import { useQuestStore, getActiveItemRequirements } from '@/store/useQuestStore';

const completedQuests = useQuestStore(s => s.completedQuests);
const itemProgress    = useQuestStore(s => s.itemProgress);
const activeItems     = getActiveItemRequirements(tasks, completedQuests, itemProgress);

// activeItems: сгруппировать по item.id (один предмет может нужен в N квестах)
// Отображать: img 32×32 + name + суммарно нужно + найдено + список квестов где нужен
```

Это позволит видеть глобально: "Нужно 7×LEDX: 3 найдено (в Ветровке×2 + Пропавшие×1)".

---

## Резюме: что улучшает UX

| UX-Sprint | Статус | Ключевой UX-выигрыш |
|---|---|---|
| UX-1 Level Gate | ✅ | Игрок понимает ПОЧЕМУ квест заблокирован — уровень или пререквизиты |
| UX-1 Trader Gate | ✅ | Визуальная связь: "качай Прапора до ЛВЛ. 2" |
| UX-2 Focus-Next | ✅ | Нет дезориентации после выполнения — камера сама ведёт к следующему |
| UX-2 Unlock Toast | ✅ | Геймификация: "4 квеста разблокировано" — мотивирует продолжать |
| UX-3 Item Tracker | ✅ | Частичный прогресс: "нашёл 3/5 GPU" сохраняется между сессиями |
| UX-3 Mini Progress | ✅ | Одним взглядом видно % выполнения item-требований прямо на ноде |
| UX-3 Bridge API | ✅ | Groundwork для /eft/progress/items без дублирования логики |
| UX-4 Objective Icons | ✅ | Быстрое сканирование задач — убить / принести / посетить |
| UX-5 MiniMap | ✅ | Навигация по 290 нодам без потери контекста |
| UX-5 Search | ✅ | Прыжок к любому квесту по имени мгновенно |
| UX-6 Chain Highlight | ✅ | Hover на ноду — подсветка полной цепочки зависимостей |
| UX-7 Item Tracker Page | ✅ | Глобальный вид: "нужно 7×GPU из 3 квестов" на `/eft/progress/tracker` |
| UX-8 Export/Import | ⏳ | Перенос прогресса между устройствами, бэкап в JSON |
| UX-9 Pins & Notes | ⏳ | Личные закладки + текстовые заметки к квестам |
| UX-10 Map Filter | ⏳ | Фильтр по игровой локации — "покажи только квесты на Лесу" |
