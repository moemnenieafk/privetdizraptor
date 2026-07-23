// Рантайм-фетчи каталога/патронов. Историческая точка §4.11 (в идеале это должно
// читаться из нашей БД — см. бэклог), пока оставляем внешний фетч, но делаем его
// устойчивым: GraphQL-primary (живые ru-имена, кэш 1ч) → JSON-fallback (json.tarkov.dev,
// имена там плейсхолдеры → подставляем normalizedName). Убирает 503-падение questmap/
// поиска при дауне GraphQL. Свой инлайн-фетч (не shared no-store хелпер) — чтобы
// сохранить рантайм-кэш `next.revalidate`.
import { isPlaceholderName } from "@/lib/tarkov-labels";

const GRAPHQL = "https://api.tarkov.dev/graphql";
const JSON_ITEMS = "https://json.tarkov.dev/regular/items";
const REVALIDATE = 3600; // кэш базы обновляем раз в час в фоне

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

interface JsonItem {
  id: string;
  normalizedName?: string;
  name?: string;
  shortName?: string;
  types?: string[];
  width?: number;
  height?: number;
  gridImageLink?: string;
  lastLowPrice?: number | null;
  backgroundColor?: string;
  categories?: string[];
  image512pxLink?: string;
  properties?: { damage?: number; penetrationPower?: number } | null;
}

async function itemsFromGraphQL(): Promise<EftItem[]> {
  const query = `
    query {
      items(lang: ru) {
        id normalizedName name shortName types width height
        gridImageLink lastLowPrice backgroundColor bsgCategoryId
      }
    }
  `;
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`tarkov.dev items → HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { items?: EftItem[] }; errors?: { message?: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "GraphQL error");
  const items = json.data?.items;
  if (!items) throw new Error("items: ответ без data.items");
  return items;
}

async function itemsFromJson(): Promise<EftItem[]> {
  const res = await fetch(JSON_ITEMS, { headers: { Accept: "application/json" }, next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`json.tarkov.dev items → HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { items?: Record<string, JsonItem> } };
  const items = json.data?.items ?? {};
  return Object.values(items).map((it) => ({
    id: it.id,
    normalizedName: it.normalizedName ?? "",
    name: isPlaceholderName(it.name, it.id) ? it.normalizedName ?? it.id : (it.name as string),
    shortName: isPlaceholderName(it.shortName, it.id) ? "" : it.shortName ?? "",
    types: it.types ?? [],
    width: it.width ?? 1,
    height: it.height ?? 1,
    gridImageLink: it.gridImageLink ?? "",
    lastLowPrice: it.lastLowPrice ?? null,
    backgroundColor: it.backgroundColor,
    bsgCategoryId: it.categories?.[0],
  }));
}

/**
 * Все предметы (для поиска/questmap). GraphQL-primary → JSON-fallback → []. Next кэширует
 * на 1ч, поиск идёт из памяти. Никогда не бросает: пустой список лучше 500-й страницы.
 */
export async function getAllEftItems(): Promise<EftItem[]> {
  try {
    const items = await itemsFromGraphQL();
    if (items.length > 0) return items;
    console.warn("[eft-api] GraphQL пуст — фолбэк на JSON-плоскость");
  } catch (e) {
    console.warn(`[eft-api] GraphQL недоступен (${e instanceof Error ? e.message : String(e)}) — фолбэк на JSON-плоскость`);
  }
  try {
    return await itemsFromJson();
  } catch (e) {
    console.error("[eft-api] и JSON-плоскость недоступна:", e instanceof Error ? e.message : e);
    return [];
  }
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

async function ammoFromGraphQL(): Promise<AmmoItem[]> {
  const query = `
    query {
      items(type: ammo, lang: ru) {
        name shortName image512pxLink
        properties { ... on ItemPropertiesAmmo { damage penetrationPower } }
      }
    }
  `;
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`tarkov.dev ammo → HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { items?: AmmoItem[] }; errors?: { message?: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "GraphQL error");
  const items = json.data?.items;
  if (!items) throw new Error("ammo: ответ без data.items");
  return items;
}

async function ammoFromJson(): Promise<AmmoItem[]> {
  const res = await fetch(JSON_ITEMS, { headers: { Accept: "application/json" }, next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`json.tarkov.dev ammo → HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { items?: Record<string, JsonItem> } };
  const items = Object.values(json.data?.items ?? {});
  return items
    .filter((it) => (it.types ?? []).includes("ammo"))
    .map((it) => ({
      name: isPlaceholderName(it.name, it.id) ? it.normalizedName ?? it.id : (it.name as string),
      shortName: isPlaceholderName(it.shortName, it.id) ? "" : it.shortName ?? "",
      image512pxLink: it.image512pxLink ?? "",
      properties: it.properties
        ? { damage: it.properties.damage ?? 0, penetrationPower: it.properties.penetrationPower ?? 0 }
        : null,
    }));
}

export async function getAmmoData(): Promise<AmmoItem[]> {
  try {
    const items = await ammoFromGraphQL();
    if (items.length > 0) return items;
  } catch (e) {
    console.warn(`[eft-api] ammo GraphQL недоступен (${e instanceof Error ? e.message : String(e)}) — фолбэк на JSON`);
  }
  try {
    return await ammoFromJson();
  } catch {
    return [];
  }
}
