/**
 * One-time script: fetch full quest data from tarkov.dev, apply patches,
 * add story quest stubs, save to src/data/quests/eft-quests.json
 * Run: node scripts/dump-quests.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';

const QUERY = `
  query QuestMapTasks {
    tasks(lang: ru) {
      id
      name
      normalizedName
      kappaRequired
      lightkeeperRequired
      minPlayerLevel
      experience
      trader { name normalizedName imageLink }
      taskRequirements { task { id name } }
      objectives {
        id
        type
        __typename
        description
        optional
        ... on TaskObjectiveItem {
          item { id name shortName image512pxLink }
          count
          foundInRaid
        }
        ... on TaskObjectiveShoot {
          target
          distance { value compareMethod }
        }
        ... on TaskObjectivePlayerLevel {
          playerLevel
        }
        ... on TaskObjectiveTraderLevel {
          trader { name normalizedName }
          level
        }
        ... on TaskObjectiveMark {
          markerItem { id name shortName image512pxLink }
        }
        ... on TaskObjectiveBasic {
          maps { id name normalizedName }
        }
      }
      finishRewards {
        items { item { id name shortName image512pxLink } count }
        traderStanding { trader { name normalizedName } standing }
      }
    }
  }
`;

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

async function main() {
  console.log('Fetching quests from tarkov.dev...');

  const res = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);

  const tasks = json.data.tasks;
  console.log(`Fetched ${tasks.length} quests.`);

  // Apply patches: replace taskRequirements for known API errors
  const nameToTask = new Map(tasks.map(t => [t.name, t]));
  let patchedCount = 0;

  for (const task of tasks) {
    const patch = PATCHES.find(p => p.quest === task.name);
    if (!patch) continue;
    task.taskRequirements = patch.prereqs
      .map(name => {
        const prereq = nameToTask.get(name);
        return prereq ? { task: { id: prereq.id, name: prereq.name } } : null;
      })
      .filter(Boolean);
    patchedCount++;
  }
  console.log(`Applied ${patchedCount} patches.`);

  // Add story quest stubs
  const storyTrader = {
    name: 'Истории',
    normalizedName: 'stories',
    imageLink: '/images/traders/eft/stories.webp',
  };

  for (const sq of STORY_QUESTS) {
    tasks.push({
      id: sq.id,
      name: sq.name,
      normalizedName: sq.normalizedName,
      kappaRequired: false,
      lightkeeperRequired: false,
      minPlayerLevel: 0,
      experience: 0,
      trader: storyTrader,
      taskRequirements: [],
      objectives: [],
      finishRewards: { items: [], traderStanding: [] },
    });
  }
  console.log(`Added ${STORY_QUESTS.length} story quest stubs.`);

  mkdirSync('./src/data/quests', { recursive: true });
  writeFileSync('./src/data/quests/eft-quests.json', JSON.stringify(tasks, null, 2), 'utf-8');
  console.log(`Done: src/data/quests/eft-quests.json (${tasks.length} quests total)`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
