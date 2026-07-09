export interface EftItem {
  id: string;
  normalizedName: string;
  name: string;
  shortName: string;
  types: string[];
  width: number;
  height: number;
  gridImageLink: string;
  lastLowPrice: number | null;
  backgroundColor?: string;
  bsgCategoryId?: string;
}

/** Одно предложение цены от вендора (торговец или барахолка) из tarkov.dev. */
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
        normalizedName
        name
        shortName
        types
        width
        height
        gridImageLink
        lastLowPrice
        backgroundColor
        bsgCategoryId
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
import { EFT_QUESTS } from '@/data/quests';

export async function getQuestMapTasks(): Promise<TaskRaw[]> {
  return EFT_QUESTS;
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