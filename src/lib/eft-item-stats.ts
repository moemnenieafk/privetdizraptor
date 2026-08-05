// Живой срез ИГРОВЫХ статов предметов из tarkov.dev — источник для дифф-движка
// «что реально изменилось». Наши items/item_properties наполняются вручную (db:etl),
// поэтому для детекта берём живые значения отсюда. Ключи отпечатка совпадают с тем,
// что писал db/game-changes из нашей схемы.
//
// ИСТОЧНИК: JSON-плоскость json.tarkov.dev/regular/items (GraphQL ОТСТАВЛЕН, §4.12).
// Числовые поля properties берём как есть; имена — плейсхолдеры, поэтому в дайджест идёт
// normalizedName (isPlaceholderName). Отпечаток (числа) стабилен, детект не «дрейфит».
// Рынок (флиа-цены) не трогаем — он живёт в prices.
import { fetchMirrorRows, fetchTarkovJson } from "@/lib/tarkov-fallback";
import { isPlaceholderName } from "@/lib/tarkov-labels";

// Плоские properties JSON-плоскости: один объект со ВСЕМИ полями + `propertiesType`.
// buildFingerprint читает поля по имени и игнорирует дискриминатор.
interface RawProps {
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
  normalizedName?: string | null; // есть в JSON-плоскости; в GraphQL не запрашиваем
  weight?: number | null;
  basePrice?: number | null;
  width?: number | null;
  height?: number | null;
  properties?: RawProps | null;
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
    put("ergonomics", p.ergonomics);
    put("recoilVertical", p.recoilVertical);
    put("recoilHorizontal", p.recoilHorizontal);
    put("fireRate", p.fireRate);
    put("penetrationPower", p.penetrationPower);
    put("damage", p.damage);
    put("armorDamage", p.armorDamage);
    put("fragmentationChance", p.fragmentationChance);
    put("initialSpeed", p.initialSpeed);
    put("armorClass", p.class); // tarkov.dev: class → наш ключ armorClass
    put("durability", p.durability);
    put("bluntThroughput", p.bluntThroughput);
    put("ergoPenalty", p.ergoPenalty);
    put("speedPenalty", p.speedPenalty);
    put("turnPenalty", p.turnPenalty);
    put("capacity", p.capacity);
  }
  return fp;
}

/** JSON-плоскость: числа + имена (плейсхолдеры → normalizedName). */
async function statsFromJson(): Promise<[string, ItemStatSnapshot][]> {
  const data = await fetchTarkovJson<{ items?: Record<string, RawItem> }>("regular/items");
  const out: [string, ItemStatSnapshot][] = [];
  for (const it of Object.values(data.items ?? {})) {
    if (!it.id) continue;
    const name = isPlaceholderName(it.name, it.id) ? it.normalizedName ?? it.id : (it.name as string);
    const shortName = isPlaceholderName(it.shortName, it.id) ? null : it.shortName ?? null;
    out.push([it.id, { name, shortName, fingerprint: buildFingerprint(it) }]);
  }
  return out;
}

/**
 * Карта inGameId → снимок статов. Никогда не бросает (fetchMirrorRows глотает ошибки):
 * источник лёг → пустая Map (движок сам решит не диффать по пустому срезу).
 */
export async function getEftItemStats(): Promise<Map<string, ItemStatSnapshot>> {
  const rows = await fetchMirrorRows<[string, ItemStatSnapshot]>(() => statsFromJson(), "item-stats");
  return new Map(rows);
}
