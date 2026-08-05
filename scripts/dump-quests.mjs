/**
 * One-time script: fetch full quest data from tarkov.dev JSON-плоскости (json.tarkov.dev),
 * reassemble into the shape questmap expects, apply patches, add story quest stubs,
 * save to src/data/quests/eft-quests.json.
 *
 * GraphQL ОТСТАВЛЕН (CLAUDE.md §4.12): раньше скрипт бил в api.tarkov.dev/graphql — она
 * схлопнута (422 с 21.07). Теперь источник — статический дамп json.tarkov.dev:
 *   /regular/tasks      — задачи (name/description — плейсхолдеры), achievements, questItems
 *   /regular/tasks_ru   — словарь переводов: placeholderValue -> настоящий текст
 *   /regular/items_ru   — имена предметов: "<id> Name" / "<id> ShortName"
 *   /regular/traders    — id -> normalizedName (name — плейсхолдер, RU берём из TRADER_RU)
 * Форма файла у JSON = старый ответ GraphQL, слитый в статику; здесь мы разворачиваем
 * id-ссылки (trader/item) обратно в объекты, как их ждёт QuestMapClient/quest-status.
 *
 * Run: node scripts/dump-quests.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';

const JSON_BASE = 'https://json.tarkov.dev';

// RU-имена торговцев по normalizedName (совпадает с src/lib/tarkov-labels TRADER_RU).
const TRADER_RU = {
  prapor: 'Прапор', therapist: 'Терапевт', fence: 'Скупщик', skier: 'Лыжник',
  peacekeeper: 'Миротворец', mechanic: 'Механик', ragman: 'Барахольщик',
  jaeger: 'Егерь', ref: 'Реф', lightkeeper: 'Смотритель', btr: 'БТР',
};

// type задачи-цели -> __typename (как в старом GraphQL-файле; questmap матчит предметы
// по __typename === 'TaskObjectiveItem' && item.id).
const TYPE_TYPENAME = {
  giveItem: 'TaskObjectiveItem', findItem: 'TaskObjectiveItem', plantItem: 'TaskObjectiveItem',
  sellItem: 'TaskObjectiveItem', findQuestItem: 'TaskObjectiveItem', giveQuestItem: 'TaskObjectiveItem',
  plantQuestItem: 'TaskObjectiveItem',
  mark: 'TaskObjectiveMark',
  shoot: 'TaskObjectiveShoot',
  buildWeapon: 'TaskObjectiveBuildItem',
  traderLevel: 'TaskObjectiveTraderLevel', traderStanding: 'TaskObjectiveTraderStanding',
  skill: 'TaskObjectiveSkill', level: 'TaskObjectivePlayerLevel', experience: 'TaskObjectiveExperience',
  extract: 'TaskObjectiveExtract', visit: 'TaskObjectiveBasic', useItem: 'TaskObjectiveUseItem',
  warning: 'TaskObjectiveBasic',
};

const PATCHES = [
  { quest: 'Ад на земле. Часть 1',                prereqs: ['Стрельба по баночкам'] },
  { quest: 'Оружейник. Часть 4',                  prereqs: ['Оружейник. Часть 3'] },
  { quest: 'Коллеги. Часть 3',                    prereqs: ['Коллеги. Часть 2'] },
  { quest: 'Путь охотника. Стиратель. Часть 2',   prereqs: ['Путь охотника. Стиратель. Часть 1'] },
];

const STORY_QUESTS = [
  { id: 'story-accidental-witness',   name: 'Нечаянный свидетель',  normalizedName: 'story-accidental-witness' },
  { id: 'story-batya',                name: 'Батя',                  normalizedName: 'story-batya' },
  { id: 'story-blue-fire',            name: 'Синий огонь',           normalizedName: 'story-blue-fire' },
  { id: 'story-boreas',               name: 'Борей',                 normalizedName: 'story-boreas' },
  { id: 'story-falling-skies',        name: 'Падающие небеса',       normalizedName: 'story-falling-skies' },
  { id: 'story-the-labyrinth',        name: 'Лабиринт',              normalizedName: 'story-the-labyrinth' },
  { id: 'story-the-ticket',           name: 'Билет',                 normalizedName: 'story-the-ticket' },
  { id: 'story-the-unheard',          name: 'Непрочитанный',         normalizedName: 'story-the-unheard' },
  { id: 'story-they-are-already-here',name: 'Они уже здесь',         normalizedName: 'story-they-are-already-here' },
  { id: 'story-tour',                 name: 'Тур',                   normalizedName: 'story-tour' },
];

async function getJson(path) {
  const res = await fetch(`${JSON_BASE}/${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} от json.tarkov.dev/${path}`);
  const json = await res.json();
  if (json?.data === undefined) throw new Error(`json.tarkov.dev/${path}: ответ без data`);
  return json.data;
}

async function main() {
  console.log('Fetching quests from json.tarkov.dev (GraphQL отставлен)...');
  const [tasksData, tr, itemsRu, tradersData, mapsData, mapsRu] = await Promise.all([
    getJson('regular/tasks'),
    getJson('regular/tasks_ru'),
    getJson('regular/items_ru'),
    getJson('regular/traders'),
    getJson('regular/maps'),
    getJson('regular/maps_ru'),
  ]);

  // карта id → {id, name(ru), normalizedName} для зон объективов (раньше имена были null)
  const mapArr = Array.isArray(mapsData.maps) ? mapsData.maps : Object.values(mapsData.maps ?? {});
  const mapById = new Map(
    mapArr.filter((m) => m.id).map((m) => [m.id, {
      id: m.id,
      name: mapsRu[`${m.id} Name`] ?? m.normalizedName ?? m.id,
      normalizedName: m.normalizedName ?? m.id,
    }]),
  );

  const T = (s) => (s == null ? s : tr[s] ?? s);                 // перевод по плейсхолдеру
  const itemObj = (id) => id && {
    id,
    name: itemsRu[`${id} Name`] ?? id,
    shortName: itemsRu[`${id} ShortName`] ?? id,
    image512pxLink: `https://assets.tarkov.dev/${id}-512.webp`,
  };
  const tradersById = tradersData; // dict по id
  const traderObj = (id) => {
    const nn = tradersById[id]?.normalizedName ?? id;
    return { name: TRADER_RU[nn] ?? nn, normalizedName: nn, imageLink: `https://assets.tarkov.dev/${id}.webp` };
  };

  const rawTasks = Object.values(tasksData.tasks ?? {});
  const nameById = new Map(rawTasks.map((t) => [t.id, T(t.name)]));

  const mapObjective = (o) => {
    const out = {
      id: o.id,
      type: o.type,
      __typename: TYPE_TYPENAME[o.type] ?? 'TaskObjectiveBasic',
      description: T(o.description),
      optional: o.optional ?? false,
    };
    if (o.count != null) out.count = o.count;
    if (o.foundInRaid != null) out.foundInRaid = o.foundInRaid;
    // предмет(ы): JSON даёт items:[id]; старый файл ждал item:{...} (первый допустимый)
    const itemId = o.item ?? (Array.isArray(o.items) ? o.items[0] : undefined);
    if (itemId) out.item = itemObj(itemId);
    if (o.markerItem) out.markerItem = itemObj(o.markerItem);
    // карты: JSON — [id]; разворачиваем в {id,name,normalizedName}
    if (Array.isArray(o.maps) && o.maps.length) {
      out.maps = o.maps.map((mid) => mapById.get(mid) ?? { id: mid, name: null, normalizedName: null });
    }
    return out;
  };

  const tasks = rawTasks.map((t) => ({
    id: t.id,
    name: T(t.name),
    normalizedName: t.normalizedName,
    kappaRequired: t.kappaRequired ?? false,
    lightkeeperRequired: t.lightkeeperRequired ?? false,
    minPlayerLevel: t.minPlayerLevel ?? 0,
    experience: t.experience ?? 0,
    taskRequirements: (t.taskRequirements ?? [])
      .filter((r) => r?.task)
      .map((r) => ({ task: { id: r.task, name: nameById.get(r.task) ?? r.task } })),
    trader: traderObj(t.trader),
    // УЛ-гейт: требования лояльности торговца — основа вью «по уровню лояльности» (1.1.0.0).
    // NB: у tarkov.dev пока размечено немного задач; остальное гейтится taskRequirements+minLevel.
    traderRequirements: (t.traderRequirements ?? [])
      .filter((r) => r?.trader)
      .map((r) => ({
        trader: { id: r.trader, name: traderObj(r.trader).name, normalizedName: traderObj(r.trader).normalizedName },
        requirementType: r.requirementType ?? null,
        compareMethod: r.compareMethod ?? '>=',
        level: r.value ?? null,
      })),
    requiredPrestige: t.requiredPrestige ?? null,
    factionName: t.factionName ?? null,
    objectives: (t.objectives ?? []).map(mapObjective),
    finishRewards: {
      traderStanding: (t.finishRewards?.traderStanding ?? []).map((s) => ({
        standing: s.standing,
        trader: { name: traderObj(s.trader).name, normalizedName: traderObj(s.trader).normalizedName },
      })),
      items: (t.finishRewards?.items ?? [])
        .filter((r) => r?.item)
        .map((r) => ({ count: r.count ?? 1, item: itemObj(r.item) })),
    },
  }));
  console.log(`Fetched ${tasks.length} quests.`);

  // Apply patches: replace taskRequirements for known API errors
  const nameToTask = new Map(tasks.map((t) => [t.name, t]));
  let patchedCount = 0;
  for (const task of tasks) {
    const patch = PATCHES.find((p) => p.quest === task.name);
    if (!patch) continue;
    task.taskRequirements = patch.prereqs
      .map((name) => {
        const prereq = nameToTask.get(name);
        return prereq ? { task: { id: prereq.id, name: prereq.name } } : null;
      })
      .filter(Boolean);
    patchedCount++;
  }
  console.log(`Applied ${patchedCount} patches.`);

  // Add story quest stubs
  const storyTrader = { name: 'Истории', normalizedName: 'stories', imageLink: '/images/traders/eft/stories.webp' };
  for (const sq of STORY_QUESTS) {
    tasks.push({
      id: sq.id, name: sq.name, normalizedName: sq.normalizedName,
      kappaRequired: false, lightkeeperRequired: false, minPlayerLevel: 0, experience: 0,
      taskRequirements: [], trader: storyTrader,
      traderRequirements: [], requiredPrestige: null, factionName: null,
      objectives: [],
      finishRewards: { traderStanding: [], items: [] },
    });
  }
  console.log(`Added ${STORY_QUESTS.length} story quest stubs.`);

  mkdirSync('./src/data/quests', { recursive: true });
  writeFileSync('./src/data/quests/eft-quests.json', JSON.stringify(tasks, null, 2), 'utf-8');
  console.log(`Done: src/data/quests/eft-quests.json (${tasks.length} quests total)`);
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
