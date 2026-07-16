// Живой срез ИГРОВЫХ статов предметов из tarkov.dev — источник для дифф-движка
// «что реально изменилось». Наши items/item_properties наполняются вручную (db:etl),
// поэтому для детекта берём живые значения отсюда: tarkov.dev обновляется постоянно и
// отражает патчи. Ключи отпечатка совпадают с тем, что писал db/game-changes из нашей
// схемы, — чтобы срезы разных источников сравнивались корректно.
//
// Тянем ТОЛЬКО поля, которые меняются патчами (статы, вес, базовая цена, сетка).
// Рынок (флиа-цены) не трогаем — он живёт в prices и это не «изменения игры».

const ENDPOINT = "https://api.tarkov.dev/graphql";

const QUERY = `
  query {
    items(lang: ru) {
      id
      name
      shortName
      weight
      basePrice
      width
      height
      properties {
        __typename
        ... on ItemPropertiesWeapon { ergonomics recoilVertical recoilHorizontal fireRate }
        ... on ItemPropertiesAmmo { penetrationPower damage armorDamage fragmentationChance initialSpeed }
        ... on ItemPropertiesArmor { class durability bluntThroughput ergoPenalty speedPenalty turnPenalty }
        ... on ItemPropertiesHelmet { class durability bluntThroughput ergoPenalty speedPenalty turnPenalty }
        ... on ItemPropertiesContainer { capacity }
      }
    }
  }
`;

interface RawProps {
  __typename?: string;
  ergonomics?: number | null;
  recoilVertical?: number | null;
  recoilHorizontal?: number | null;
  fireRate?: number | null;
  penetrationPower?: number | null;
  damage?: number | null;
  armorDamage?: number | null;
  fragmentationChance?: number | null;
  initialSpeed?: number | null;
  class?: number | null;
  durability?: number | null;
  bluntThroughput?: number | null;
  ergoPenalty?: number | null;
  speedPenalty?: number | null;
  turnPenalty?: number | null;
  capacity?: number | null;
}

interface RawItem {
  id: string;
  name?: string | null;
  shortName?: string | null;
  weight?: number | null;
  basePrice?: number | null;
  width?: number | null;
  height?: number | null;
  properties?: RawProps | null;
}

interface RawResponse {
  data?: { items?: RawItem[] };
  errors?: unknown;
}

export interface ItemStatSnapshot {
  name: string;
  shortName: string | null;
  fingerprint: Record<string, string>;
}

function buildFingerprint(it: RawItem): Record<string, string> {
  const fp: Record<string, string> = {};
  const put = (k: string, v: number | null | undefined): void => {
    if (v !== null && v !== undefined) fp[k] = String(v);
  };
  put("weight", it.weight);
  put("basePrice", it.basePrice);
  put("gridWidth", it.width);
  put("gridHeight", it.height);

  const p = it.properties;
  if (p) {
    // Оружие
    put("ergonomics", p.ergonomics);
    put("recoilVertical", p.recoilVertical);
    put("recoilHorizontal", p.recoilHorizontal);
    put("fireRate", p.fireRate);
    // Патроны
    put("penetrationPower", p.penetrationPower);
    put("damage", p.damage);
    put("armorDamage", p.armorDamage);
    put("fragmentationChance", p.fragmentationChance);
    put("initialSpeed", p.initialSpeed);
    // Броня/шлемы (tarkov.dev: class → наш ключ armorClass)
    put("armorClass", p.class);
    put("durability", p.durability);
    put("bluntThroughput", p.bluntThroughput);
    put("ergoPenalty", p.ergoPenalty);
    put("speedPenalty", p.speedPenalty);
    put("turnPenalty", p.turnPenalty);
    // Контейнеры
    put("capacity", p.capacity);
  }
  return fp;
}

/**
 * Карта inGameId → снимок статов из tarkov.dev. Никогда не бросает: при ошибке/пустоте
 * отдаёт пустую Map (движок сам решит не диффать по пустому срезу, чтобы не занулить всё).
 */
export async function getEftItemStats(): Promise<Map<string, ItemStatSnapshot>> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`tarkov.dev → ${res.status}`);
    const json = (await res.json()) as RawResponse;
    if (json.errors) throw new Error(`tarkov.dev GraphQL errors: ${JSON.stringify(json.errors).slice(0, 200)}`);

    const items = json.data?.items ?? [];
    const out = new Map<string, ItemStatSnapshot>();
    for (const it of items) {
      if (!it.id || !it.name) continue;
      out.set(it.id, { name: it.name, shortName: it.shortName ?? null, fingerprint: buildFingerprint(it) });
    }
    return out;
  } catch (e) {
    console.warn("[eft-item-stats] срез недоступен:", e instanceof Error ? e.message : e);
    return new Map();
  }
}
