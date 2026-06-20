# QuestMap Polish — Исполняемые спринты (волна 2)

> Каждый спринт запускается отдельной сессией.
> Скажи Клоду: **"Выполни Sprint N из @!future-requests/questmap-polish-sprints.md"**

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
| 1 | Zoom panel центр + Search fix | ✅ DONE | QuestMapClient ✅ · QuestSearch ✅ |
| 2 | Ref Portrait в цепочке | ✅ DONE | computeLayout ✅ · staticConnections ✅ |

---

## ДИЗАЙН-РЕФЕРЕНС

```
design-ui-ux-figma/questmap/ui-frame/QuestMap-1100px-DefaultUI.png — целевой вид
```

---

## SPRINT 1 — Zoom Panel центр + Search placeholder fix

### Проблема
1. Zoom-контролы (`+`, `−`, fit) — `absolute bottom-4 right-4` вертикально. Нужно снизу по центру, горизонтально, в стиле CTA.
2. Placeholder поиска — "Поиск по всем заданиям". Нужно "Введите задание для поиска".

### Читаем
- `src/app/eft/progress/quests/QuestMapClient.tsx` — строки 900-927 (zoom controls JSX)
- `src/components/features/quests/QuestSearch/index.tsx` — строка 46 (placeholder)

### Пишем

**EDIT: `src/app/eft/progress/quests/QuestMapClient.tsx`**

Найти блок `{/* Zoom controls */}` (строка ~900) и заменить целиком:
```tsx
{/* Zoom / Fit controls — bottom center */}
<div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1">
  <button
    onClick={() => vpRef.current?.zoomOut()}
    className="w-7 h-7 flex items-center justify-center rounded-xs border border-lines-hover bg-card-menu text-text-primary hover:border-(--primary)/40 hover:text-(--primary) transition-colors duration-150 font-blender-medium text-base leading-none"
    aria-label="Отдалить"
    title="Отдалить (−)"
  >−</button>
  <button
    onClick={() => {
      const active = [...selectedTraders][0] ?? traderOrderRef.current[0];
      if (!active) return;
      const bounds = traderColumnBoundsRef.current.get(active);
      if (bounds) vpRef.current?.fitToBounds(bounds, { padding: 0.08, duration: 400 });
    }}
    className="w-7 h-7 flex items-center justify-center rounded-xs border border-lines-hover bg-card-menu text-text-muted hover:border-(--primary)/40 hover:text-(--primary) transition-colors duration-150"
    aria-label="По размеру"
    title="Вписать колонку в экран"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </button>
  <button
    onClick={() => vpRef.current?.zoomIn()}
    className="w-7 h-7 flex items-center justify-center rounded-xs border border-lines-hover bg-card-menu text-text-primary hover:border-(--primary)/40 hover:text-(--primary) transition-colors duration-150 font-blender-medium text-base leading-none"
    aria-label="Приблизить"
    title="Приблизить (+)"
  >+</button>
</div>
```

Порядок кнопок: `[−] [fit] [+]` — fit в центре для удобного двойного клика.

---

**EDIT: `src/components/features/quests/QuestSearch/index.tsx`**

Строка 46 — заменить placeholder:
```tsx
// БЫЛО:
placeholder="Поиск по всем заданиям"
// СТАЛО:
placeholder="Введите задание для поиска"
```

### Верификация Sprint 1
- Открыть /eft/progress/quests
- Zoom controls должны быть снизу по центру карты (не справа)
- Порядок: `[−] [fit] [+]` горизонтально
- Нажать кнопку поиска → панель открывается, внутри placeholder "Введите задание для поиска"
- Zoom + и − работают как раньше
- Fit вписывает текущую колонку торговца в экран

---

## SPRINT 2 — Портрет Рефа в цепочке квестов

### Проблема
Торговец **Реф** (`normalizedName: "ref"`) — особый случай. Его квесты "Лёгкие деньги" —
линейная цепочка с небольшим числом уровней. Сейчас его портрет отображается вверху
колонки (y=0) как у всех торговцев. Пользователь хочет, чтобы портрет появлялся
**инлайн между первым и вторым уровнем глубины** его квестовой цепочки.

Визуальный эффект: [Part 1] → [Портрет Рефа] → [Part 2] → ...

### Читаем
- `src/app/eft/progress/quests/QuestMapClient.tsx` — строки 88-190 (`computeLayout` целиком)
- `src/app/eft/progress/quests/QuestMapClient.tsx` — строки 800-870 (JSX рендер `<TraderNode>`)
- `src/app/eft/progress/quests/QuestMapClient.tsx` — строки 480-560 (`staticConnections`, раздел "Trader portrait → root quests")

### Пишем

**EDIT: `src/app/eft/progress/quests/QuestMapClient.tsx`**

**a) В `computeLayout` — специальный кейс для Рефа:**

В цикле `for (const traderName of traderOrder)`, после того как уложены все группы глубины,
перед строкой `positions.set('trader-${traderName}', ...)` добавить условие:

```ts
// Для Рефа — портрет МЕЖДУ depth[0] и depth[1], а не вверху колонки
if (traderName === 'ref') {
  // Найти Y после первого depth-уровня
  const depthKeys = [...depthGroups.keys()].sort((a, b) => a - b);
  let refPortraitY = QUEST_START_Y; // fallback: top как у всех

  if (depthKeys.length >= 2) {
    // Нижняя граница depth[0]-группы
    const depth0 = depthGroups.get(depthKeys[0])!;
    const maxH0 = Math.max(...depth0.map(q => getQuestNodeHeight(q.objectives.length)));
    const y0 = positions.get(depth0[0].id)?.y ?? QUEST_START_Y;
    refPortraitY = y0 + maxH0 + ROW_GAP;

    // Сдвинуть ВСЕ квесты depth >= 1 вниз на (TRADER_H + ROW_GAP)
    const shift = TRADER_H + ROW_GAP;
    for (const dk of depthKeys.slice(1)) {
      for (const q of depthGroups.get(dk)!) {
        const pos = positions.get(q.id);
        if (pos) positions.set(q.id, { x: pos.x, y: pos.y + shift });
      }
    }
    // Скорректировать currentY (используется в colHeight)
    currentY += shift;
  }

  positions.set(`trader-${traderName}`, {
    x: currentX + effectiveWidth / 2 - TRADER_W / 2,
    y: refPortraitY,
  });
} else {
  positions.set(`trader-${traderName}`, {
    x: currentX + effectiveWidth / 2 - TRADER_W / 2,
    y: 0,
  });
}
```

**b) В `staticConnections` useMemo — убрать линию от портрета Рефа к корневым квестам:**

В блоке "Trader portrait → root quests":
```ts
for (const [traderName, rootIds] of traderRoots) {
  // Реф — портрет в середине цепочки, не вверху. Линия от торговца к корню не нужна.
  if (traderName === 'ref') continue;

  const traderVar = `var(${traderCssVar(traderName)})`;
  // ... остальное без изменений
}
```

**c) Добавить соединительные линии для Рефа:**

После блока "Trader portrait → root quests", добавить отдельный блок для Рефа:
```ts
// Ref portrait — inlined between depth 0 and depth 1
const refPortraitPos = layoutPositions.get('trader-ref');
if (refPortraitPos) {
  const refRoots = traderRoots.get('ref') ?? [];          // depth-0 квесты
  const refVar   = `var(${traderCssVar('ref')})`;

  // Линии из depth-0 квестов → низ портрета Рефа (встречные линии)
  for (const rootId of refRoots) {
    const rootPos = layoutPositions.get(rootId);
    if (!rootPos) continue;
    const rootH = nodeHeights.get(rootId) ?? NODE_H;
    result.push({
      id:        `ref-root-${rootId}->portrait`,
      d:         `M ${rootPos.x + NODE_W / 2} ${rootPos.y + rootH} L ${refPortraitPos.x + TRADER_W / 2} ${refPortraitPos.y}`,
      stroke:    refVar,
      opacity:   0.4,
      nodeIds:   [rootId, 'trader-ref'],
      className: 'qc-active',
    });
  }
}
```

> **Примечание**: `traderRoots` содержит только абсолютные корни (квесты без prereqs). Если у Рефа
> Part 1 сам имеет prerequisite из другого торговца, он не войдёт в `traderRoots`. В таком случае
> нужно вместо `traderRoots.get('ref')` найти квесты с depth === min_depth среди ref-квестов.
> Проверить при тестировании и скорректировать если нужно.

### Верификация Sprint 2
- Открыть /eft/progress/quests, найти колонку Рефа
- Портрет Рефа должен быть НЕ вверху колонки, а между первым и вторым уровнем квестов
- Линия от первого квеста(-ов) идёт ВНИЗ к портрету
- От портрета продолжаются квесты второго уровня (обычные линии quest→quest)
- Остальные торговцы — портреты по-прежнему вверху (y=0)
- Кнопка "Вписать колонку" (`fit`) корректно охватывает всю колонку Рефа включая сдвиг

---

## СВОДНАЯ ТАБЛИЦА

| # | Спринт | Файлов читаем | Файлов пишем | Сложность |
|---|---|---|---|---|
| 1 | Zoom panel центр + Search fix | 2 | 2 | LOW |
| 2 | Ref Portrait в цепочке | 3 | 1 | HIGH |

**Порядок выполнения:** 1 → 2
Sprint 2 не зависит от Sprint 1, но Sprint 1 делается первым как разминка.
