# QuestMap Polish — Спринты Волны 3 (ошибки.md)

> Каждый спринт = **1 контекстное окно**.
> Скажи Клоду: **"Выполни Sprint N из @!future-requests/questmap-wave3-sprints.md"**

---

## ПРАВИЛА ВЕДЕНИЯ СПРИНТОВ

### Статусы
- `⬜ TODO` — не начат
- `🔄 IN PROGRESS` — выполняется в текущей сессии
- `✅ DONE` — завершён, верифицирован
- `❌ BLOCKED` — заблокирован зависимостью или багом

### Claude ОБЯЗАН при каждом запуске:
1. **До правок** → выставить `🔄 IN PROGRESS` в таблице СТАТУСЫ
2. **После каждого файла** → отметить подзадачу ✅ в таблице СТАТУСЫ
3. **После всех правок** → выставить `✅ DONE`
4. **Контекст-бюджет (проверить ДО начала)**:
   - MAX 2 файла глубокого чтения
   - MAX 2 файла правок
   - MAX ~50 строк диффа суммарно
   - Если спринт выходит за бюджет → **разбить на части (Sprint Na / Sprint Nб) прямо в этом файле до начала правок, затем выполнить часть a**

### Правило: 1 спринт = 1 контекст
Спринты намеренно малые. Если задача кажется больше — это сигнал разбить, а не ужать.

---

## СТАТУСЫ СПРИНТОВ

| # | Спринт | Статус | Подзадачи |
|---|---|---|---|
| 3 | QuestNode: карточка-фиксы | ✅ DONE | 3a ✅ · 3b ✅ · 3c ✅ · 3d ✅ |
| 4 | Линия-коннектор: stepped+rounded | ✅ DONE | makeQuestPath ✅ |
| 5а | UI TopBar | ✅ DONE | — |
| 5б | UI BottomBar | ✅ DONE | — |

---

## ДИЗАЙН-РЕФЕРЕНСЫ

```
design-ui-ux-figma/questmap/ui-frame/QuestMap-1100px-DefaultUI.png — целевой вид UI
design-ui-ux-figma/questmap/quest-map-line-connector-principle.png — принцип коннектора
```

---

## SPRINT 3 — QuestNode: карточка-фиксы

### Файл
`src/components/features/quests/QuestNode/index.tsx` — читаем и пишем.

### 3a — Убрать Paperclip из header

**Читаем:** строки 134–144 (блок `ml-auto` в `<header>`).

**Удалить** блок строки 141–143:
```tsx
{pinned && (
  <Paperclip className="w-4 h-4 text-(--primary) shrink-0" />
)}
```

### 3b — Footer Paperclip: toggle-стиль

**Читаем:** строки 219–225 (footer `<button>` с Paperclip).

Текущий код кнопки:
```tsx
<button
  ...
  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xs border border-lines-hover hover:border-(--primary) transition-colors"
>
  <Paperclip className={`w-4 h-4 ${pinned ? 'text-(--primary)' : 'text-text-secondary'}`} />
</button>
```

Заменить на стиль через inline style (pinned меняет всё три свойства):
```tsx
<button
  data-no-pan
  onClick={e => { e.stopPropagation(); onPin(task.id); }}
  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xs border transition-colors"
  style={pinned
    ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }
    : { borderColor: 'var(--color-lines-hover)' }
  }
>
  <Paperclip className={`w-4 h-4 ${pinned ? 'text-(--color-darkbase)' : 'text-text-secondary'}`} />
</button>
```

### 3c — Kappa/LK индикаторы: 28×28 bg-фрейм

**Читаем:** строки 135–140.

Заменить два индикатора на обёрнутые версии:
```tsx
{task.kappaRequired && (
  <span
    className="w-7 h-7 flex items-center justify-center rounded-xs shrink-0"
    style={{ background: 'color-mix(in srgb, var(--color-nvg-green) 10%, transparent)' }}
  >
    <span className="icon-bg icon-eft-profile-kappa w-4 h-4" />
  </span>
)}
{task.lightkeeperRequired && (
  <span
    className="w-7 h-7 flex items-center justify-center rounded-xs shrink-0"
    style={{ background: 'color-mix(in srgb, var(--trader-lightkeeper) 10%, transparent)' }}
  >
    <span className="icon-bg icon-eft-profile-lightkeeper w-4 h-4" />
  </span>
)}
```

### 3d — Переставить иконки задач: [текст][прогресс][иконка]

**Читаем:** строки 159–176 (return в `.map(obj => ...)`).

Текущий порядок: `[icon-button][text][progress]`
Целевой порядок: `[text][progress][icon-button]`

```tsx
<li key={obj.id} className="flex items-center gap-2">
  <span className="text-xs text-text-secondary truncate flex-1">
    {obj.description}
  </span>
  {isItem && total > 0 && (
    <span className="text-xs font-blender-medium text-text-secondary shrink-0">
      {done}/{total}
    </span>
  )}
  <button
    data-no-pan
    onClick={e => { e.stopPropagation(); if (isItem) incrementItem(task.id, obj.id, total); }}
    className={`icon-bg ${iconCls} shrink-0 w-4 h-4 transition-opacity ${
      done === total && total > 0 ? 'opacity-100' : 'opacity-40'
    }`}
  />
</li>
```

### Верификация Sprint 3
- Открыть `/eft/progress/quests`
- ✓ Карточки без скрепки в хедере
- ✓ Кнопка-скрепка в футере: обычная = серый border, серая иконка; закреплено = оранжевый фон, тёмная иконка, оранжевый border
- ✓ Kappa/LK иконки в цветном квадратном фрейме 28×28px
- ✓ В строках заданий: текст слева, иконка справа, счётчик X/Y между ними

---

## SPRINT 4 — Линия-коннектор: stepped+rounded

### Файл
`src/app/eft/progress/quests/QuestMapClient.tsx` — читаем и пишем.

### Читаем
Найти функцию `makeQuestPath` (примерно строки 200–230). Записать её точные координаты.

### Принцип из референса
`design-ui-ux-figma/questmap/quest-map-line-connector-principle.png`:
- Коннектор: вертикаль → горизонтальный переход → вертикаль
- corner-radius = 28px на каждом сгибе
- Дашовый паттерн сохраняется

### Алгоритм замены makeQuestPath

```ts
function makeQuestPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  if (Math.abs(dx) < 2) return `M ${x1} ${y1} V ${y2}`;  // прямая линия

  const r   = 28;
  const sx  = dx > 0 ? 1 : -1;
  const midY = (y1 + y2) / 2;

  // Arcs: (rx ry x-rotation large-arc-flag sweep-flag x y)
  // Сгиб 1: вертикаль → горизонталь
  const sweepA = dx > 0 ? 1 : 0;
  // Сгиб 2: горизонталь → вертикаль
  const sweepB = dx > 0 ? 0 : 1;

  return [
    `M ${x1} ${y1}`,
    `V ${midY - r}`,
    `A ${r} ${r} 0 0 ${sweepA} ${x1 + sx * r} ${midY}`,
    `L ${x2 - sx * r} ${midY}`,
    `A ${r} ${r} 0 0 ${sweepB} ${x2} ${midY + r}`,
    `V ${y2}`,
  ].join(' ');
}
```

> **Примечание:** Если `(midY - y1) < r` или `(y2 - midY) < r`, углы могут перекрыться.
> В таком случае добавить зажим: `const safeR = Math.min(r, (y2 - y1) / 4)` и использовать `safeR` вместо `r`.

### Верификация Sprint 4
- Линии между квестами одной колонки → прямые вертикали
- Линии между сдвинутыми квестами → Z-форма с плавными (r=28) углами
- Дашовый паттерн (14/7) сохранён
- Цвет и opacity без изменений

---

## SPRINT 5а — UI TopBar

> Перед выполнением: прочитать текущий `QuestFilterBar/index.tsx` полностью,
> затем задать уточняющие вопросы если текущая реализация сильно отличается.

### Дизайн-спек

Из `QuestMap-1100px-DefaultUI.png`:

```
[ 🔍 ] [ portrait×11 ] [ ─── ] [ map-icon×N ] [ ─── ] [ reset ]
```

**Поиск (левый край):**
- CSS-иконка `.icon-eft-search-icon` (не Lucide)
- Клик → открывает SearchPanel overlay (уже есть в QuestSearch)

**Торговцы (центр-лево):**
- 11 портретов по 32×32px, `rounded-xs`
- Дефолт: без обводки, opacity 60% при inactive фильтре
- Active (выбран): обводка `ring-1 ring-(--primary)`

**Карты (центр-право):**
- Иконки карт из `icons.css` → `icon-eft-maps-*`
- Убрать: Ночной Завод, Ночной Эпицентр
- Добавить: Конец Пути → `.icon-eft-end-of-line-map-icon`
- Лаборатория → `.icon-eft-maps-lab`
- Остальные карты — сверить текущий список с icons.css

**Reset (правый край):**
- `.icon-eft-profile-reset` CSS-иконка
- При hover/active: красный тинт

### Файлы
- Читаем: `src/components/features/quests/QuestFilterBar/index.tsx`
- Пишем: тот же файл

---

## SPRINT 5б — UI BottomBar

> Перед выполнением: прочитать текущий `QuestStatusBar/index.tsx` полностью
> и `src/components/layout/header-modules/PlayerTelemetry.tsx`.

### Дизайн-спек

Из `QuestMap-1100px-DefaultUI.png`:

```
[ выполнено: N/510 - N% ] [─── flex-1 ───] [ LK toggle ] [ Kappa toggle ] [ PlayerTelemetry ] [─── ] [ ↑ ] [ ↓ ] [ ⛶ ]
```

**Левый край:**
- Текст `"выполнено: N/510 - N%"` — серый, `font-blender-book text-sm`
- N — число выполненных, 510 — всего квестов, N% — процент

**Центр (flex-1 justify-center, gap-2):**
- **Lightkeeper toggle**: chip-кнопка с прогрессом "7/257 - 2%", иконка смотрителя, amber-цвет
- **Kappa toggle**: chip-кнопка с прогрессом "7/128 - 0%", иконка каппы, green-цвет
- При клике → фильтровать карту только по квестам для соответствующего достижения
- **PlayerTelemetry**: переиспользовать `@src/components/layout/header-modules/PlayerTelemetry.tsx`

**Правый край:**
- Import icon (скачать прогресс)
- Export icon (загрузить прогресс)
- Fullscreen icon

### Файлы
- Читаем: `src/components/features/quests/QuestStatusBar/index.tsx`
- Читаем: `src/components/layout/header-modules/PlayerTelemetry.tsx`
- Пишем: QuestStatusBar (или создать новый если структура кардинально другая)

---

## СВОДНАЯ ТАБЛИЦА

| # | Спринт | Файл | Строк диффа | Сложность |
|---|---|---|---|---|
| 3 | QuestNode card fixes | QuestNode/index.tsx | ~35 | LOW |
| 4 | Линия-коннектор | QuestMapClient.tsx | ~20 | MEDIUM |
| 5а | TopBar | QuestFilterBar/index.tsx | ~60 | MEDIUM |
| 5б | BottomBar | QuestStatusBar/index.tsx | ~60 | MEDIUM |

**Порядок выполнения:** 3 → 4 → 5а → 5б
