export interface EftItem {
  id: string;
  name: string;
  shortName: string;
  types: string[];
  width: number;
  height: number;
  gridImageLink: string;
  lastLowPrice: number | null;
  backgroundColor?: string;
}

/**
 * Получает все предметы из Tarkov.dev API.
 * Next.js закэширует этот fetch-запрос на сервере, 
 * поэтому поиск по всем предметам будет происходить мгновенно из оперативной памяти.
 */
export async function getAllEftItems(): Promise<EftItem[]> {
  console.log(`🌐 X-RAY [API]: Выполняю GraphQL fetch к api.tarkov.dev (Кэш: 1 час)`);
  const query = `
    query {
      items(lang: ru) {
        id
        name
        shortName
        types
        width
        height
        gridImageLink
        lastLowPrice
        backgroundColor
      }
    }
  `;

  // ВАЖНО: Внешний API эндпоинт tarkov.dev остается без изменений!
  const response = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query }),
    next: { revalidate: 3600 } // Обновляем кэш базы раз в час в фоне
  });

  const json = await response.json();
  
  if (json.errors) {
    console.error(`❌ X-RAY [API ERROR]: GraphQL вернул ошибку:`, json.errors);
    throw new Error(json.errors[0].message);
  }
  
  const items = json.data?.items || [];
  console.log(`✅ X-RAY [API]: Успешно получено ${items.length} предметов из Tarkov.dev.`);
  return items;
}

export interface AmmoItem {
  name: string;
  shortName: string;
  image512pxLink: string;
  properties: {
    damage: number;
    penetrationPower: number;
  } | null;
}

import type { TaskRaw } from '@/types/quest';

const QUEST_MAP_QUERY = `
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
          times
          shotType
          distance
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
        ... on TaskObjectiveLocation {
          map { id name normalizedName }
        }
      }
      finishRewards {
        items { item { id name shortName image512pxLink } count }
        traderStanding { trader { name normalizedName } standing }
      }
    }
  }
`;

export async function getQuestMapTasks(): Promise<TaskRaw[]> {
  try {
    const response = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: QUEST_MAP_QUERY }),
      next: { revalidate: 3600 },
    });
    const json = await response.json();
    if (json.errors) {
      console.error('❌ [QuestMap API]: GraphQL error:', json.errors[0]?.message);
      return [];
    }
    return json.data?.tasks ?? [];
  } catch (err) {
    console.error('❌ [QuestMap API]: Fetch failed:', err);
    return [];
  }
}

export async function getAmmoData(): Promise<AmmoItem[]> {
  const query = `
    {
      items(type: ammo, lang: ru) {
        name
        shortName
        image512pxLink
        properties {
          ... on ItemPropsAmmo {
            damage
            penetrationPower
          }
        }
      }
    }
  `;

  // ВАЖНО: Внешний API эндпоинт tarkov.dev остается без изменений!
  const response = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query }),
    next: { revalidate: 3600 }
  });

  const json = await response.json();
  return json.data?.items || [];
}