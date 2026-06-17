# Quest Map — Итерации разработки

Каждый спринт запускается отдельно. Скопируй промпт в чат.

> **Правило для каждого спринта:** перед написанием или изменением любого кода, связанного с данными квестов (типы, GraphQL запросы, поля объектов), **обязательно вызвать `/tarkov-api`** — скилл даёт точные имена полей tasks API tarkov.dev (включая `taskRequirements`, типы objectives, `kappaRequired`, `lightkeeperRequired`, структуру `finishRewards`). Это предотвращает ошибки по типу несуществующих полей.

---

## ✅ Sprint 1 — DONE: Фундамент (GraphQL + Dagre Layout)

Создано:
- `src/types/quest.ts` — TypeScript типы
- `src/lib/eft-api.ts` — добавлен `getQuestMapTasks()`
- `src/app/eft/progress/quests/page.tsx` — Server Component
- `src/app/eft/progress/quests/QuestMapClient.tsx` — Client, dagre layout + ReactFlow canvas
- `src/data/pageContent.ts` — добавлен ключ `eft-progress-quests`
- `src/app/eft/progress/page.tsx` — обновлён href карточки → `/eft/progress/quests`

Верификация: `npm run dev` → `/eft/progress/quests` — канвас с ~290 нодами, pan/zoom работает.

---

## ⏳ Sprint 2 — QuestNode: кастомные карточки

**Промпт:**
> Сначала вызови `/tarkov-api` и найди в нём раздел про Tasks — убедись в точных именах полей `trader`, `kappaRequired`, `lightkeeperRequired`, `taskRequirements`. Затем:
>
> Продолжаем разработку Quest Map (`/eft/progress/quests`). Sprint 1 завершён — работающий ReactFlow канвас с dagre layout. Теперь Sprint 2: заменить дефолтные ноды на кастомный компонент `QuestNode`.
>
> Создай `src/components/features/quests/QuestNode/index.tsx` — ReactFlow custom node.
>
> Структура: `w-[220px] min-h-[88px] rounded-xs flex flex-col p-2 cursor-pointer transition-all duration-200`. Три визуальных состояния из `data.status: QuestNodeStatus`:
> - `locked`: `bg-(--color-darkbase) opacity-60 border border-dashed border-(--color-lines-hover) text-(--color-text-muted)`
> - `active`: `bg-(--color-card-menu) border border-(--primary) text-(--color-text-primary)` + glow shadow через `shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_25%,transparent)]`
> - `completed`: `bg-[#182216] border border-[#6A8B5D] text-[#739964] opacity-70`
>
> Внутри карточки (сверху вниз):
> 1. Header row: `img` 20×20 из `/images/traders/eft/{task.trader.normalizedName}.webp` + `span` с `task.trader.name` (text-[10px] font-blender-medium uppercase tracking-widest text-(--color-text-muted)) + badges справа (`.icon-bg.icon-eft-profile-kappa` если `kappaRequired`, `.icon-bg.icon-eft-profile-lightkeeper` если `lightkeeperRequired`, размер `w-3.5 h-3.5`)
> 2. `span` с `task.name` — `text-[11px] font-blender-medium uppercase leading-tight mt-1 mb-auto`
> 3. `button` с классом `nodrag` — toggle. `locked`: disabled + `cursor-not-allowed`; `active`: `bg-(--primary)/10 text-(--primary) hover:bg-(--primary)/20`; `completed`: `bg-(--color-lines-hover)/50 text-(--color-text-muted) hover:text-(--color-text-primary)`. Текст кнопки: locked="ЗАБЛОКИРОВАНО", active="ВЫПОЛНЕНО?", completed="✓ ВЫПОЛНЕНО". Кнопка: `h-6 w-full text-[9px] font-blender-medium uppercase tracking-wider rounded-xs mt-1`.
>
> Click на карточку (не на кнопку) → `data.onSelect(task)`. Кнопка → `e.stopPropagation()` + `data.onToggle(task.id)`. Dimmed: если `data.dimmed` → обернуть в `pointer-events-none opacity-20 grayscale`.
>
> Handle слева (target) и справа (source) — `style={{ visibility: 'hidden' }}`, `Position.Left`/`Position.Right`.
>
> Затем обнови `QuestMapClient.tsx`:
> - Добавить `import { QuestNode } from '@/components/features/quests/QuestNode'`
> - Определить `const nodeTypes = { questNode: QuestNode }` на УРОВНЕ МОДУЛЯ (не внутри компонента — иначе ReactFlow ремаунтит все ноды)
> - В `buildLayout` изменить `type: 'default'` → `type: 'questNode'` и передавать в `data`: `{ task, status: 'active', onToggle: () => {}, onSelect: () => {} }` (временные заглушки до Sprint 3)
> - Передать `nodeTypes={nodeTypes}` в `<ReactFlow>`
>
> Файлы типов: `src/types/quest.ts` уже содержит `QuestNodeStatus`, `QuestNodeData`, `TaskRaw`.

---

## ⏳ Sprint 3 — Zustand Store + Реактивность

**Промпт:**
> Сначала вызови `/tarkov-api` и найди структуру `taskRequirements` — убедись, что поле называется именно так и содержит `task { id }`. Затем:
>
> Продолжаем Quest Map. Sprint 2 завершён — кастомные QuestNode карточки. Sprint 3: глобальный state + реактивные обновления.
>
> 1. Создай `src/store/useQuestStore.ts` — Zustand v5 с persist:
> ```typescript
> import { create } from 'zustand';
> import { persist } from 'zustand/middleware';
>
> interface QuestStore {
>   completedQuests: string[];
>   toggleQuest: (id: string) => void;
>   resetProgress: () => void;
> }
>
> export const useQuestStore = create<QuestStore>()(
>   persist(
>     (set) => ({
>       completedQuests: [],
>       toggleQuest: (id) => set((s) => ({
>         completedQuests: s.completedQuests.includes(id)
>           ? s.completedQuests.filter((q) => q !== id)
>           : [...s.completedQuests, id],
>       })),
>       resetProgress: () => set({ completedQuests: [] }),
>     }),
>     { name: 'cta-quest-progress', partialize: (s) => ({ completedQuests: s.completedQuests }) }
>   )
> );
> ```
>
> 2. Обнови `QuestMapClient.tsx`:
> - Добавить `computeStatusMap(tasks, completedSet, playerLevel)` — чистая O(n) функция:
>   - `completedSet.has(id)` → 'completed'
>   - `task.minPlayerLevel > playerLevel` → 'locked'
>   - все prereq в completedSet → 'active', иначе 'locked'
> - Подписаться через селекторы: `useQuestStore(s => s.completedQuests)`, `useQuestStore(s => s.toggleQuest)`
> - Взять `playerLevel` из `usePlayerStore` (`src/store/usePlayerStore.ts`): `Number(activeProfile?.level ?? 1)`
> - `useMemo` для nodes+edges вместе — зависит от `[completedQuests, playerLevel, initialTasks, toggleQuest]`
> - В `buildLayout` добавить параметр `statusMap: Map<string, QuestNodeStatus>` и передавать в `node.data`: `{ task, status: statusMap.get(task.id) ?? 'locked', onToggle: toggleQuest, onSelect: setSelectedTask }`
> - Edge styling по статусу source: completed → opacity 0.4; active → animated + stroke primary; locked → opacity 0.15
> - Добавить `useState<TaskRaw | null>(null)` для `selectedTask` (понадобится в Sprint 4)
>
> Файлы: `src/store/useQuestStore.ts` (NEW), `src/app/eft/progress/quests/QuestMapClient.tsx` (MODIFY).

---

## ⏳ Sprint 4 — QuestFilterBar + QuestDrawer

**Промпт:**
> Сначала вызови `/tarkov-api` и проверь структуру `objectives` (типы `TaskObjectiveItem`, `TaskObjectiveShoot`, `TaskObjectivePlayerLevel`) и `finishRewards` — точные поля для рендера в Drawer. Затем:
>
> Продолжаем Quest Map. Sprint 3 завершён — Zustand store + реактивность. Sprint 4: фильтры и выдвижная панель деталей.
>
> 1. Создай `src/components/features/quests/QuestFilterBar/index.tsx`:
> Принимает props: `{ tasks, completedQuests, filterKappa, filterLK, selectedTraders, onKappa, onLK, onTrader, onReset }`
> Структура: `flex items-center gap-3 px-4 py-2 border-b border-(--color-lines-hover) bg-(--color-card-menu) flex-wrap`
> - Слева: прогресс-стат `"Каппа: X / Y (Z%)"` или общий если нет фильтра
> - Центр: кнопки `[К] Путь к Каппе` и `[Л] Смотритель Маяка` — toggle кнопки
> - Торговцы: список чипов по уникальным `task.trader.normalizedName` — `img` 16×16 из `/images/traders/eft/{normalizedName}.webp` + имя, chip toggle
> - Справа: кнопка `Сбросить прогресс` (danger, subtle) — вызывает `useQuestStore(s => s.resetProgress)`
>
> 2. Создай `src/components/features/quests/QuestDrawer/index.tsx`:
> Использует `useModalAnimation` из `src/hooks/useModalAnimation.ts`.
> Props: `{ task: TaskRaw | null; onClose: () => void }`
> - `if (!isRendered) return null`
> - Overlay: `fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300` + opacity по isVisible
> - Drawer: `fixed inset-y-0 right-0 z-50 w-[420px] max-w-[90vw] bg-(--color-card-menu) border-l border-(--color-lines-hover) flex flex-col transform transition-transform duration-300 ease-out` + `translate-x-full` / `translate-x-0` по isVisible
> - Внутри: header с названием + торговцем + кнопкой закрытия, список objectives, rewards, XP
>
> 3. Обнови `QuestMapClient.tsx`:
> - Добавить filter state: `filterKappa`, `filterLK`, `selectedTraders`
> - В `useMemo` вычислять `filteredIds: Set<string>` — AND логика фильтров, ноды вне фильтра получают `data.dimmed = true`
> - Рендерить `<QuestFilterBar>` над канвасом, `<QuestDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />` как сиблинг div-контейнера ReactFlow (не внутри него)
>
> Файлы:
> - `src/components/features/quests/QuestFilterBar/index.tsx` (NEW)
> - `src/components/features/quests/QuestDrawer/index.tsx` (NEW)
> - `src/app/eft/progress/quests/QuestMapClient.tsx` (MODIFY)
