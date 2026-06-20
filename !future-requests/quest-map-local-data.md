# Карта заданий — переход на локальные данные + сюжетные квесты

## Контекст и текущее состояние

### Архитектура карты квестов
- **Рабочая реализация:** `src/app/eft/progress/quests/` (ReactFlow + Dagre layout)
  - `page.tsx` → `getQuestMapTasks()` → `QuestMapDynamic.tsx` → `QuestMapClient.tsx`
  - Данные: GraphQL запрос к `https://api.tarkov.dev/graphql`, кэш 1 час
  - 510 квестов, тип `TaskRaw` из `src/types/quest.ts`
- **Старая статичная версия:** `src/app/eft/questmap/*.ts` — устаревшая, с ручными x/y координатами. Скорее всего надо удалить.

### Проблема с API
`tarkov.dev` берёт данные из SPT (Single Player Tarkov mod), который **не обновляется** вместе с живой игрой:
- Отсутствуют все **сюжетные квесты** (Stories / Истории)
- Зависимости некоторых квестов устарели (уже исправлены патчами в `src/lib/eft-api.ts`)

### Уже сделано (патчи в `src/lib/eft-api.ts`)
Функция `applyQuestPatches()` исправляет 4 известные ошибки API:
1. **Ад на земле. Часть 1** — prereq изменён на «Стрельба по баночкам» (вместо «Как в старые добрые. Часть 1»)
2. **Оружейник. Часть 4** — prereq только «Оружейник. Часть 3» (убрана зависимость от Части 2)
3. **Коллеги. Часть 3** — prereq «Коллеги. Часть 2» (вместо «Путь охотника. Садист» от Егеря)
4. **Путь охотника. Стиратель. Часть 2** — prereq только «Стиратель. Часть 1» (убрана «Охранка»)

### Файлы с данными (сохранены для работы)
- `docs/quests-origin/api-raw.json` — полный дамп API (510 квестов, JSON)
- `docs/quests-origin/api-tree.txt` — дерево квестов по трейдерам (читаемый текст)
- `docs/quests-origin/API-SRAVNENIE.md` — отчёт всех расхождений API vs документы
- `docs/quests-origin/ПРАПОР.md`, `ТЕРАПЕВТ.md`, ... (все трейдеры) — **актуальный ручной источник** (записан из живой игры, точнее API)

### Иконки сюжетных квестов (уже есть в проекте)
`public/icons/eft/02-quests/story-*.svg`:
- `story-accidental-witness` — Нечаянный свидетель
- `story-batya` — Батя
- `story-blue-fire` — Синий огонь
- `story-boreas` — Борей
- `story-falling-skies` — Падающие небеса
- `story-the-labyrinth` — Лабиринт
- `story-the-ticket` — Билет
- `story-the-unheard` — Непрочитанный
- `story-they-are-already-here` — Они уже здесь
- `story-tour` — Тур

Все эти квесты **отсутствуют в API**, у нас нулевые данные по ним.

---

## Задача

### Шаг 1 — Создать локальный файл данных квестов
Создать `src/data/quests/eft-quests.ts` (или `src/data/quests/eft-quests.json`):
- Взять базу из `docs/quests-origin/api-raw.json` (510 квестов)
- Применить все патчи из `applyQuestPatches()` прямо в данные (больше не нужна рантайм-функция)
- Добавить сюжетные квесты (см. ниже)

### Шаг 2 — Добавить сюжетные квесты
У них особый характер:
- Нет классического трейдера — нужно либо создать виртуального трейдера «Истории» / «Stories», либо привязывать к существующему
- Имеют зависимости от обычных квестов (открываются на определённом уровне или после конкретных квестов)
- Нужны иконки — SVG уже есть (`story-boreys.svg` и т.д.)
- Поля: `id`, `name`, `kappaRequired` (как правило false), `lightkeeperRequired`, `minPlayerLevel`, `trader`, `taskRequirements`, `objectives`, `finishRewards`

**Вопрос к Вадиму перед началом:** нужно заполнить данные по сюжетным квестам:
- Какие prereqs у каждого (после каких квестов открываются)?
- Минимальный уровень игрока?
- Задачи (objectives) — описание?

### Шаг 3 — Отключить API-запрос
В `src/lib/eft-api.ts` функция `getQuestMapTasks()`:
- Заменить `fetch('https://api.tarkov.dev/graphql', ...)` на `import { quests } from '@/data/quests/eft-quests'`
- Удалить `QUEST_PATCHES` и `applyQuestPatches()` — патчи войдут в сами данные
- Удалить GraphQL query `QUEST_MAP_QUERY`
- Оставить интерфейс функции (`async function getQuestMapTasks(): Promise<TaskRaw[]>`) нетронутым — вся остальная система не меняется

### Шаг 4 — Механизм добавления новых квестов
При выходе нового патча в игре:
- Открываем `src/data/quests/eft-quests.ts`
- Добавляем новый объект в массив по образцу
- Деплой — карта обновилась

---

## Рекомендуемый формат локальных данных

```typescript
// src/data/quests/eft-quests.ts
import type { TaskRaw } from '@/types/quest';

export const EFT_QUESTS: TaskRaw[] = [
  {
    id: 'unique-id',
    name: 'Стрельба по баночкам',
    normalizedName: 'shooting-cans',
    kappaRequired: true,
    lightkeeperRequired: false,
    minPlayerLevel: 1,
    experience: 2100,
    trader: { name: 'Прапор', normalizedName: 'prapor', imageLink: '' },
    taskRequirements: [],
    objectives: [],
    finishRewards: { items: [], traderStanding: [] },
  },
  // ... 509 остальных
];
```

Для сюжетных — отдельный трейдер:
```typescript
trader: { name: 'Истории', normalizedName: 'stories', imageLink: '/images/traders/eft/stories.webp' },
```

---

## Что НЕ меняется
- `QuestMapClient.tsx` — не трогаем
- `QuestMapDynamic.tsx` — не трогаем  
- `QuestNode`, `QuestDrawer`, `QuestFilterBar` — не трогаем
- `useQuestStore.ts` — не трогаем
- Типы `TaskRaw`, `QuestNodeStatus` и т.д. — не трогаем
- Вся логика патчинга переходит в сами данные, функция-обёртка остаётся

---

## Дополнительно — старая версия (папка src/app/eft/questmap/)
`src/app/eft/questmap/` содержит файлы (`mechanic.ts`, `skier.ts`, `ragman.ts` и т.д.) — 
это ручная реализация с hardcoded координатами, сделанная другом Вадима. 
**Не используется в текущей карте, не важна.** Можно удалить целиком без рисков.
