# Sprint: QuestMap — Правка пресетов + алгоритм layout

## Цель
1. Привести `taskRequirements` в `src/data/quests/eft-quests.json` в соответствие с деревьями в `docs/quests-origin/*.md`
2. Затем — улучшить `computeLayout` в `QuestMapClient.tsx`: barycenter-сортировка + локальная глубина

---

## Статус (обновляй по мере выполнения)

| # | Торговец | normalizedName | MD файл | Пресеты | Проверка |
|---|----------|----------------|---------|---------|----------|
| 1 | ПРАПОР | prapor | ПРАПОР.md | ✅ DONE | ✅ verified |
| 2 | БАРАХОЛЬЩИК | ragman | БАРАХОЛЬЩИК.md | ✅ DONE | ✅ verified |
| 3 | МЕХАНИК | mechanic | МЕХАНИК.md | ✅ DONE | ✅ verified |
| 4 | ТЕРАПЕВТ | therapist | ТЕРАПЕВТ.md | ✅ DONE | ✅ verified |
| 5 | ЛЫЖНИК | skier | ЛЫЖНИК.md | ✅ DONE | ✅ verified |
| 6 | МИРОТВОРЕЦ | peacekeeper | МИРОТВОРЕЦ.md | ✅ DONE | ✅ verified |
| 7 | ЕГЕРЬ | jaeger | ЕГЕРЬ.md | ✅ DONE | ✅ verified |
| 8 | РЕФ | ref | РЕФ.md | ✅ DONE | ✅ verified |
| 9 | СКУПЩИК | fence | СКУПЩИК.md | ✅ DONE | ✅ verified |
| 10 | СМОТРИТЕЛЬ МАЯКА | lightkeeper | СМОТРИТЕЛЬ МАЯКА.md | ✅ DONE | ✅ verified |
| 11 | ВОДИТЕЛЬ БТР | btr-driver | ВОДИТЕЛЬ БТР.md | ✅ DONE | ✅ verified |
| 12 | Алгоритм layout | — | — | ⏳ | — |

---

## Метод для каждого торговца

### Шаг 1 — Анализ текущих пресетов
```bash
cd "c:/Users/vadim/Desktop/cta-project" && node -e "
const data = require('./src/data/quests/eft-quests.json');
const trader = data.filter(q => q.trader.normalizedName === 'TRADER_NAME');
trader.forEach(q => {
  const prereqs = q.taskRequirements.map(r => {
    const p = data.find(t => t.id === r.task.id);
    return p ? p.name : r.task.id;
  });
  console.log('[' + q.name + '] prereqs:[' + prereqs.join(', ') + ']');
});
"
```
Заменить `TRADER_NAME` на нужный normalizedName из таблицы выше.

### Шаг 2 — Патч JSON (шаблон)
```js
// node patch-prereqs.js
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./src/data/quests/eft-quests.json', 'utf8'));

const changes = [
  // { id: 'QUEST_ID', prereqs: [{ id: 'PARENT_ID', name: 'Parent Name' }] },
];

let changed = 0;
for (const quest of data) {
  const change = changes.find(c => c.id === quest.id);
  if (change) {
    quest.taskRequirements = change.prereqs.map(p => ({ task: { id: p.id, name: p.name } }));
    changed++;
  }
}
fs.writeFileSync('./src/data/quests/eft-quests.json', JSON.stringify(data, null, '\t'), 'utf8');
console.log('Patched:', changed, 'quests');
```

### Шаг 3 — Получить ID квестов
```bash
node -e "
const data = require('./src/data/quests/eft-quests.json');
['Quest Name 1', 'Quest Name 2'].forEach(name => {
  const q = data.find(t => t.name === name);
  console.log(q ? JSON.stringify({id:q.id, name:q.name, trader:q.trader.normalizedName}) : 'NOT FOUND: '+name);
});
"
```

---

## Автоматическая проверка (запускать после каждого торговца)

```bash
cd "c:/Users/vadim/Desktop/cta-project" && node -e "
const data = require('./src/data/quests/eft-quests.json');
const prereqMap = new Map(data.map(t => [t.id, t.taskRequirements.map(r => r.task.id)]));
const depths = new Map();
const comp = new Set();
function depth(id) {
  if (depths.has(id)) return depths.get(id);
  if (comp.has(id)) return 0;
  comp.add(id);
  const pids = prereqMap.get(id) ?? [];
  const d = pids.length ? 1 + Math.max(...pids.map(depth)) : 0;
  comp.delete(id); depths.set(id, d); return d;
}
data.forEach(t => depth(t.id));
const childrenMap = new Map();
data.forEach(t => t.taskRequirements.forEach(r => {
  const l = childrenMap.get(r.task.id) ?? []; l.push(t); childrenMap.set(r.task.id, l);
}));

// Проверяем конкретного родителя
function checkParent(name) {
  const q = data.find(t => t.name === name);
  if (!q) { console.log('NOT FOUND:', name); return; }
  const kids = childrenMap.get(q.id) ?? [];
  console.log('\\n=== ' + name + ' (depth=' + depths.get(q.id) + ', ' + q.trader.normalizedName + ') ===');
  kids.forEach(c => {
    const prereqs = c.taskRequirements.map(r => data.find(t=>t.id===r.task.id)?.name).join(', ');
    console.log('  child: ' + c.name + ' [' + c.trader.normalizedName + '] depth=' + depths.get(c.id) + ' | prereqs:[' + prereqs + ']');
  });
}

// Добавляй сюда имена родительских квестов по мере продвижения:
checkParent('Тест-драйв. Часть 1');        // ПРАПОР ✅
checkParent('Как в старые добрые. Часть 1'); // ПРАПОР ✅
checkParent('Вам посылка');                 // ПРАПОР ✅
checkParent('Только бизнес');              // БАРАХОЛЬЩИК ✅
checkParent('Вернем Ультре былое величие'); // БАРАХОЛЬЩИК ✅
checkParent('Картотека. Часть 2');          // БАРАХОЛЬЩИК ✅
checkParent('Спасение крота');             // МЕХАНИК ✅
checkParent('Разведка боем');              // МЕХАНИК ✅
checkParent('Стрим. Часть 2');             // МЕХАНИК ✅
checkParent('Санэпиднадзор. Часть 1');    // ТЕРАПЕВТ ✅
checkParent('Медицинский журнал');         // ТЕРАПЕВТ ✅
checkParent('Сельпо');                     // ТЕРАПЕВТ ✅
checkParent('Реагент. Часть 4');           // ЛЫЖНИК ✅
checkParent('Провизор');                   // ЛЫЖНИК ✅ (Своего рода саботаж)
checkParent('Гуманитарка');               // МИРОТВОРЕЦ ✅
checkParent('Мокрое дело. Часть 4');      // МИРОТВОРЕЦ ✅
checkParent('Наставник');                 // МИРОТВОРЕЦ ✅
checkParent('Знакомство');               // ЕГЕРЬ ✅
checkParent('Путь охотника. Охранка');   // ЕГЕРЬ ✅
checkParent('Путь охотника. Санитар леса'); // ЕГЕРЬ ✅
checkParent('Баланс. Часть 2 [PVP ZONE]');     // РЕФ ✅
checkParent('Профпригодность - Часть 1 [PVP ZONE]'); // РЕФ ✅
checkParent('Сделка с совестью. Часть 2 [PVP ZONE]'); // РЕФ ✅
checkParent('Наладить контакт');                     // СКУПЩИК ✅
checkParent('Новое знакомство');                     // СМОТРИТЕЛЬ МАЯКА ✅
checkParent('Загладить вину. Подкуп');               // СМОТРИТЕЛЬ МАЯКА ✅
checkParent('Шиномонтажка');                         // ВОДИТЕЛЬ БТР ✅
checkParent('Скрепить дружбу');                      // ВОДИТЕЛЬ БТР ✅
checkParent('Переиграть и уничтожить');              // ВОДИТЕЛЬ БТР ✅
// checkParent('...следующий торговец...');
"
```

---

## Шаг 12 — Алгоритм layout (после всех торговцев)

**Файл**: `src/app/eft/progress/quests/QuestMapClient.tsx` — функция `computeLayout`

**Изменение 1: Barycenter-сортировка внутри depth-групп**

Вместо `a.name.localeCompare(b.name)` при сортировке внутри depthGroups:
- Для каждого квеста вычислить средний X его родителей в той же колонке (торговца)
- Сортировать по этому среднему X по возрастанию
- Квесты без родителей в той же колонке → avg X = 0 (в начало)

Это устраняет перекрещивание линий внутри колонки.

**Изменение 2 (опционально): Локальная глубина**

Заменить `computeGlobalDepths` на `computeLocalDepths`:
- Глубина считается только по цепочке квестов ТОГО ЖЕ ТОРГОВЦА
- Кросс-трейдерные пресеты не влияют на Y-позицию
- Каждая колонка компактна и независима
- Кросс-трейдер видим только через StubNode

```ts
function computeLocalDepths(tasks: TaskRaw[]): Map<string, number> {
  const prereqMap = new Map(
    tasks.map(t => [t.id, t.taskRequirements
      .filter(r => {
        const parent = tasks.find(p => p.id === r.task.id);
        return parent && parent.trader.normalizedName === t.trader.normalizedName;
      })
      .map(r => r.task.id)
    ])
  );
  // same depth recursion as computeGlobalDepths
  const depths = new Map<string, number>();
  const computing = new Set<string>();
  function depth(id: string): number {
    if (depths.has(id)) return depths.get(id)!;
    if (computing.has(id)) return 0;
    computing.add(id);
    const pids = prereqMap.get(id) ?? [];
    const d = pids.length === 0 ? 0 : 1 + Math.max(...pids.map(depth));
    computing.delete(id);
    depths.set(id, d);
    return d;
  }
  for (const t of tasks) depth(t.id);
  return depths;
}
```

---

## Паттерны MD (что искать)

- **Веер** (исправить): несколько квестов на одном уровне отступа `├──` с одним родителем → JSON должен иметь ОДНОГО родителя
- **Цепочка** (OK): `└──` → дочерний → `└──` → его дочерний → цепочка правильная
- **Кросс-трейдер**: квест из другого торговца в дереве → изменить его prereq на нужный родитель
- **NOT FOUND**: квест не найден в JSON → либо другое написание, либо отсутствует в данных

---

## Правила патча

1. Использовать ТОЛЬКО ID (не имена) в `taskRequirements`
2. Сохранять `{ task: { id, name } }` формат
3. После патча запускать проверку через `checkParent()`
4. Один `node -e` скрипт на всего торговца (атомарно)
