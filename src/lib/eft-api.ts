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
export interface SellOffer {
  price: number;
  priceRUB: number | null;
  currency?: string;
  vendor: { name: string; normalizedName: string };
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

/**
 * Точечно догружает цены продажи (sellFor) для конкретных предметов по их id.
 * Используется только для топ-результатов поиска — чтобы не раздувать
 * часовой кэш основной базы (~2500 предметов) вложенными прайсами вендоров.
 */
export interface ItemPricing {
  normalizedName: string;
  sellFor: SellOffer[];
}

export async function getEftItemsPricing(ids: string[]): Promise<Map<string, ItemPricing>> {
  if (ids.length === 0) return new Map();

  const query = `
    query {
      items(ids: ${JSON.stringify(ids)}, lang: ru) {
        id
        normalizedName
        sellFor {
          price
          priceRUB
          currency
          vendor { name normalizedName }
        }
      }
    }
  `;

  const response = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query }),
    next: { revalidate: 600 } // Цены живут 10 минут
  });

  const json = await response.json();

  if (json.errors) {
    console.error(`❌ X-RAY [API ERROR]: Запрос цен вернул ошибку:`, json.errors);
    return new Map();
  }

  const items = (json.data?.items ?? []) as Array<{ id: string; normalizedName: string | null; sellFor: SellOffer[] | null }>;
  return new Map(items.map((it) => [it.id, { normalizedName: it.normalizedName ?? '', sellFor: it.sellFor ?? [] }]));
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