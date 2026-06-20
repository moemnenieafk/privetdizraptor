# Sprint: Исправление пресетов квестов по MD-файлам торговцев

## Цель
Привести `taskRequirements` в `src/data/quests/eft-quests.json` в соответствие с деревьями квестов из `docs/quests-origin/*.md`.

Алгоритм layout в QuestMapClient автоматически пересчитывает позиции из prerequisites — достаточно исправить JSON.

## Метод (на примере ПРАПОРА)
1. Читаем MD файл — дерево показывает ТОЧНУЮ структуру веток
2. Запускаем `node -e` скрипт сравнения текущих prereqs с MD
3. Определяем где линейная цепочка вместо нужного веера
4. Патчим JSON одним `node -e` скриптом через ID квестов
5. Верифицируем через `computeGlobalDepths` симуляцию

## Статус по торговцам

| Торговец | MD файл | Статус | Ключевые фиксы |
|----------|---------|--------|----------------|
| ПРАПОР | ПРАПОР.md | ✅ DONE | Тест-драйв 3-6→1; КвСД.1 8 детей; Вам посылка 3 детей; Лучшая работа |
| БАРАХОЛЬЩИК | БАРАХОЛЬЩИК.md | ⏳ TODO | — |
| МЕХАНИК | МЕХАНИК.md | ⏳ TODO | — |
| ТЕРАПЕВТ | ТЕРАПЕВТ.md | ⏳ TODO | — |
| ЛЫЖНИК | ЛЫЖНИК.md | ⏳ TODO | — |
| МИРОТВОРЕЦ | МИРОТВОРЕЦ.md | ⏳ TODO | — |
| ЕГЕРЬ | ЕГЕРЬ.md | ⏳ TODO | — |
| РЕФ | РЕФ.md | ⏳ TODO | — |
| СКУПЩИК | СКУПЩИК.md | ⏳ TODO | — |
| СМОТРИТЕЛЬ МАЯКА | СМОТРИТЕЛЬ МАЯКА.md | ⏳ TODO | — |
| ВОДИТЕЛЬ БТР | ВОДИТЕЛЬ БТР.md | ⏳ TODO | — |

## Шаблон анализа (на каждый MD)

```bash
# 1. Показать текущие prereqs всех квестов торговца
node -e "
const data = require('./src/data/quests/eft-quests.json');
const trader = data.filter(q => q.trader.normalizedName === 'TRADER');
trader.forEach(q => {
  const prereqs = q.taskRequirements.map(r => {
    const p = data.find(t => t.id === r.task.id);
    return p ? p.name : r.task.id;
  });
  console.log('[' + q.name + '] prereqs: [' + prereqs.join(', ') + ']');
});
"

# 2. Патч-скрипт (заполнять по результатам анализа)
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./src/data/quests/eft-quests.json', 'utf8'));
const changes = [
  { id: 'QUEST_ID', prereqs: [{ id: 'PARENT_ID', name: 'Parent Name' }] },
];
// ... apply changes
fs.writeFileSync('./src/data/quests/eft-quests.json', JSON.stringify(data, null, '\t'), 'utf8');
"

# 3. Верификация
node -e "
// simluate computeGlobalDepths + childrenMap
// check specific parent → children
"
```

## Важные паттерны

- **Веер**: MD показывает несколько детей на одном уровне отступа → все они должны иметь prereq на ОДНОГО общего родителя
- **Цепочка** (не трогать): MD показывает `└──` в ряд, каждый следующий глубже → JSON цепочка корректна
- **Кросс-трейдер**: квест другого торговца в дереве → его prereq меняется на родителя из MD; на графе появится StubNode `↗`
- **Ключ от города**: всегда оставлять дочерним Ответочке (уже корректно)

## Файл изменений
`src/data/quests/eft-quests.json` — только поле `taskRequirements`

## Быстрая верификация после каждого торговца
```bash
node -e "
const data = require('./src/data/quests/eft-quests.json');
const prereqMap = new Map(data.map(t => [t.id, t.taskRequirements.map(r => r.task.id)]));
const depths = new Map();
const comp = new Set();
function depth(id) {
  if (depths.has(id)) return depths.get(id);
  if (comp.has(id)) return 0;
  comp.add(id); const pids = prereqMap.get(id)??[]; const d = pids.length?1+Math.max(...pids.map(depth)):0; comp.delete(id); depths.set(id,d); return d;
}
data.forEach(t=>depth(t.id));
const childrenMap=new Map();
data.forEach(t=>t.taskRequirements.forEach(r=>{const l=childrenMap.get(r.task.id)??[];l.push(t);childrenMap.set(r.task.id,l);}));
// check parent quest by name:
const q=data.find(t=>t.name==='QUEST NAME');
(childrenMap.get(q.id)??[]).forEach(c=>console.log(c.name,'depth='+depths.get(c.id)));
"
```
