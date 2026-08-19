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
 * Run: node scripts/dump-quests.mjs [regular|pve]
 *   regular → src/data/quests/eft-quests.json (по умолчанию)
 *   pve     → src/data/quests/eft-quests.pve.json
 */

import { writeFileSync, mkdirSync } from 'fs';

const JSON_BASE = 'https://json.tarkov.dev';
// Режим игры: regular (PVP) | pve. Требования предметов почти совпадают, но набор задач
// различается (regular 517 / pve 513), поэтому дампим по режиму и читаем по профилю игрока.
const MODE = (process.argv[2] || 'regular').toLowerCase();
if (!['regular', 'pve'].includes(MODE)) { console.error(`Неизвестный режим: ${MODE} (regular|pve)`); process.exit(1); }

// RU-имена торговцев по normalizedName (совпадает с src/lib/tarkov-labels TRADER_RU).
const TRADER_RU = {
  prapor: 'Прапор', therapist: 'Терапевт', fence: 'Скупщик', skier: 'Лыжник',
  peacekeeper: 'Миротворец', mechanic: 'Механик', ragman: 'Барахольщик',
  jaeger: 'Егерь', ref: 'Реф', lightkeeper: 'Смотритель', 'btr-driver': 'Водитель БТР',
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
  console.log(`Fetching quests from json.tarkov.dev/${MODE} (GraphQL отставлен)...`);
  const [tasksData, tr, itemsRu, tradersData, mapsData, mapsRu] = await Promise.all([
    getJson(`${MODE}/tasks`),
    getJson(`${MODE}/tasks_ru`),
    getJson(`${MODE}/items_ru`),
    getJson(`${MODE}/traders`),
    getJson(`${MODE}/maps`),
    getJson(`${MODE}/maps_ru`),
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
  // Quest-item цели (findQuestItem/giveQuestItem/plantQuestItem): предмет лежит в o.questItem
  // (id из коллекции questItems), а имена — в tasks_ru (НЕ items_ru!). Без этого item был null →
  // 230 целей выпадали из «Важных предметов»/трекера и роняли прод-билд (§4.4-гочи).
  const questItemObj = (id) => id && {
    id,
    name: T(`${id} Name`),
    shortName: T(`${id} ShortName`),
    image512pxLink: `https://assets.tarkov.dev/${id}-512.webp`,
  };
  const tradersById = tradersData; // dict по id
  const traderObj = (id) => {
    const nn = tradersById[id]?.normalizedName ?? id;
    return { name: TRADER_RU[nn] ?? nn, normalizedName: nn, imageLink: `https://assets.tarkov.dev/${id}.webp` };
  };

  // УЛ квеста (1..4): явный traderRequirements для СВОЕГО торговца → его level; иначе
  // аппроксимация minPlayerLevel → полка по порогам requiredPlayerLevel торговца (реальные
  // пороги УЛ из /traders). NB: tarkov.dev размечает УЛ явно лишь у ~16/510 → остальное — оценка.
  const llBands = (traderId) => (tradersById[traderId]?.levels ?? [])
    .filter((l) => l.level != null)
    .map((l) => ({ level: l.level, minLevel: l.requiredPlayerLevel ?? 0 }))
    .sort((a, b) => a.level - b.level);
  const ulTierOf = (t) => {
    const own = (t.traderRequirements ?? [])
      .filter((r) => r?.requirementType === 'level' && r?.value != null && r?.trader === t.trader)
      .map((r) => r.value);
    let ul = own.length ? Math.max(...own) : 1;
    if (!own.length) {
      const ml = t.minPlayerLevel ?? 0;
      for (const b of llBands(t.trader)) if (b.minLevel <= ml) ul = b.level;
    }
    return Math.min(4, Math.max(1, ul));
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
    // предмет(ы): JSON даёт items:[id]; старый файл ждёт item:{...} (первый допустимый).
    // any-of (o.items.length>1): помимо представительного item сохраняем ВЕСЬ список принимаемых
    // → acceptedItems[] + anyOf=true. Нужно для «групповой строки» трекера «N любых из категории»
    // (иначе теряется, что цель принимает любой из вариантов). Решение important-items-merge.
    const itemId = o.item ?? (Array.isArray(o.items) ? o.items[0] : undefined);
    if (itemId) out.item = itemObj(itemId);
    else if (o.questItem) out.item = questItemObj(o.questItem);
    if (Array.isArray(o.items) && o.items.length > 1) {
      out.anyOf = true;
      out.acceptedItems = o.items.map(itemObj);
    }
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
    ulTier: ulTierOf(t),
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
      traderRequirements: [], requiredPrestige: null, factionName: null, ulTier: 1,
      objectives: [],
      finishRewards: { traderStanding: [], items: [] },
    });
  }
  console.log(`Added ${STORY_QUESTS.length} story quest stubs.`);

  mkdirSync('./src/data/quests', { recursive: true });
  const outFile = MODE === 'regular' ? 'eft-quests.json' : `eft-quests.${MODE}.json`;
  writeFileSync(`./src/data/quests/${outFile}`, JSON.stringify(tasks, null, 2), 'utf-8');
  console.log(`Done: src/data/quests/${outFile} (${tasks.length} quests total)`);

  // Пообъектные точки целей карт — только для regular (пины на карте mode-агностичны).
  if (MODE !== 'regular') return;

  // Пообъектные точки целей (possibleLocations, сырые game x/y/z) — ОТДЕЛЬНЫЙ лёгкий файл:
  // читает только серверная страница карты (пообъектные пины по ?quest=id), в клиентский
  // бандл eft-quests.json не тащим. Форма: { questId: { mapSlug: [{x,y,z,label}] } }.
  const objectivePoints = {};
  let ptCount = 0;
  for (const t of rawTasks) {
    for (const o of t.objectives ?? []) {
      const label = T(o.description) ?? '';
      for (const pl of o.possibleLocations ?? []) {
        const slug = mapById.get(pl.map)?.normalizedName;
        if (!slug || !Array.isArray(pl.positions)) continue;
        for (const p of pl.positions) {
          ((objectivePoints[t.id] ??= {})[slug] ??= []).push({ x: p.x, y: p.y, z: p.z, label });
          ptCount++;
        }
      }
    }
  }
  writeFileSync('./src/data/quests/eft-objective-points.json', JSON.stringify(objectivePoints), 'utf-8');
  console.log(`Done: src/data/quests/eft-objective-points.json (${Object.keys(objectivePoints).length} квестов, ${ptCount} точек)`);
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
