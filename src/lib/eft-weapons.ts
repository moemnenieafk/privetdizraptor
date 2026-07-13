// Фетч оружейного слоя EFT из tarkov.dev. ИСТОЧНИК для self-mirror'а: эту функцию
// вызывает ТОЛЬКО серверный синк (src/db/weapons.ts → /api/cron/sync-weapons).
// Рантайм-UI сюда не ходит — конструктор читает наши таблицы weapon_*.
//
// Берём три сущности одним запросом (items(types: [gun, mods, preset])):
//   • gun    → база: стоковые эрго/отдача/MOA + ДЕРЕВО СЛОТОВ + defaultPreset
//   • mods   → модуль: ergonomics (плоско), recoilModifier/accuracyModifier (ДОЛЯ!) + свои слоты
//   • preset → самостоятельный item со своей КАРТИНКОЙ собранного ствола + containsItems
//
// Патроны тянем отдельным запросом (types: [ammo]) — у них нет слотов, но есть
// initialSpeed/recoilModifier, без которых отдача считается неверно.
//
// Слоты источник отдаёт как allowedItems/excludedItems. Мы схлопываем их в ОДИН
// плоский allowedItemIds (allowed − excluded), чтобы пикер фильтровал IN-проверкой.
//
// ВАЖНО: containsItems у пресетов НЕ содержит слот детали (проверено на живом синке:
// 3789 из 3789 без slotNameId). Поэтому слот выводится постобработкой —
// resolvePresetSlots() по allowedItemIds. См. src/lib/preset-slots.ts.
//
// Запрос тяжёлый (весь оружейный слой), tarkov.dev под нагрузкой отдаёт 503 →
// ретраим с бэкоффом. 4xx не ретраим: это наша ошибка в запросе, повтор не поможет.
import { resolvePresetSlots } from "@/lib/preset-slots";

const ENDPOINT = "https://api.tarkov.dev/graphql";

const RETRIES = 3;
const BACKOFF_MS = [1000, 3000, 7000];

/* ───────────────── публичная форма (её пишет в БД src/db/weapons.ts) ───────────────── */

export interface EftSlot {
  slotId: string;
  nameId: string;
  name: string;
  required: boolean;
  ord: number;
  allowedItemIds: string[];
}

export interface EftWeaponBase {
  itemId: string;
  caliber: string | null;
  ergonomics: number;
  recoilVertical: number;
  recoilHorizontal: number;
  fireRate: number | null;
  fireModes: string[] | null;
  sightingRange: number | null;
  centerOfImpact: number | null;
  deviationCurve: number | null;
  deviationMax: number | null;
  defaultPresetId: string | null;
  defaultAmmoId: string | null;
  allowedAmmoIds: string[];
  slots: EftSlot[];
}

export interface EftWeaponPart {
  itemId: string;
  kind: "mod" | "ammo";
  ergonomics: number;
  recoilModifier: number;
  accuracyModifier: number;
  velocity: number;
  loudness: number;
  capacity: number | null;
  initialSpeed: number | null;
  conflictingItemIds: string[];
  conflictingSlotIds: string[];
  /** Слоты самого модуля (планка → крышка → прицел). У патронов пусто. */
  slots: EftSlot[];
}

export interface EftWeaponPreset {
  id: string;
  baseItemId: string;
  name: string;
  isDefault: boolean;
  ergonomics: number | null;
  recoilVertical: number | null;
  recoilHorizontal: number | null;
  moa: number | null;
  parts: { itemId: string; slotNameId: string; count: number }[];
}

export interface EftWeaponsDump {
  bases: EftWeaponBase[];
  parts: EftWeaponPart[];
  presets: EftWeaponPreset[];
}

/* ───────────────── сырой ответ API (без any) ───────────────── */

interface RawRef {
  id: string;
}
interface RawFilters {
  allowedItems?: RawRef[] | null;
  excludedItems?: RawRef[] | null;
}
interface RawSlot {
  id?: string;
  nameId?: string;
  name?: string;
  required?: boolean | null;
  filters?: RawFilters | null;
}
interface RawAttribute {
  type?: string;
  name?: string;
  value?: string | null;
}
interface RawContained {
  item?: RawRef | null;
  count?: number | null;
  attributes?: RawAttribute[] | null;
}
interface RawProps {
  __typename?: string;
  caliber?: string | null;
  ergonomics?: number | null;
  recoilVertical?: number | null;
  recoilHorizontal?: number | null;
  recoilModifier?: number | null;
  accuracyModifier?: number | null;
  fireRate?: number | null;
  fireModes?: string[] | null;
  sightingRange?: number | null;
  centerOfImpact?: number | null;
  deviationCurve?: number | null;
  deviationMax?: number | null;
  capacity?: number | null;
  initialSpeed?: number | null;
  moa?: number | null;
  default?: boolean | null;
  defaultPreset?: RawRef | null;
  defaultAmmo?: RawRef | null;
  allowedAmmo?: RawRef[] | null;
  baseItem?: RawRef | null;
  slots?: RawSlot[] | null;
}
interface RawItem {
  id: string;
  name?: string | null;
  types?: string[] | null;
  ergonomicsModifier?: number | null;
  recoilModifier?: number | null;
  accuracyModifier?: number | null;
  velocity?: number | null;
  loudness?: number | null;
  conflictingItems?: RawRef[] | null;
  conflictingSlotIds?: string[] | null;
  containsItems?: RawContained[] | null;
  properties?: RawProps | null;
}
interface RawResponse {
  data?: { items?: RawItem[] | null } | null;
  errors?: unknown;
}

/* ───────────────── запросы ───────────────── */

const SLOT_FRAGMENT = `
  slots {
    id
    nameId
    name
    required
    filters { allowedItems { id } excludedItems { id } }
  }
`;

const MAIN_QUERY = `
  query {
    items(lang: ru, types: [gun, mods, preset]) {
      id
      name
      types
      ergonomicsModifier
      recoilModifier
      accuracyModifier
      velocity
      loudness
      conflictingItems { id }
      conflictingSlotIds
      containsItems { item { id } count attributes { type name value } }
      properties {
        __typename
        ... on ItemPropertiesWeapon {
          caliber
          ergonomics
          recoilVertical
          recoilHorizontal
          fireRate
          fireModes
          sightingRange
          centerOfImpact
          deviationCurve
          deviationMax
          defaultPreset { id }
          defaultAmmo { id }
          allowedAmmo { id }
          ${SLOT_FRAGMENT}
        }
        ... on ItemPropertiesWeaponMod { ergonomics recoilModifier accuracyModifier ${SLOT_FRAGMENT} }
        ... on ItemPropertiesMagazine  { ergonomics recoilModifier capacity ${SLOT_FRAGMENT} }
        ... on ItemPropertiesScope     { ergonomics recoilModifier sightingRange ${SLOT_FRAGMENT} }
        ... on ItemPropertiesBarrel    { ergonomics recoilModifier centerOfImpact deviationCurve ${SLOT_FRAGMENT} }
        ... on ItemPropertiesPreset    { baseItem { id } ergonomics recoilVertical recoilHorizontal moa default }
      }
    }
  }
`;

const AMMO_QUERY = `
  query {
    items(lang: ru, types: [ammo]) {
      id
      properties {
        __typename
        ... on ItemPropertiesAmmo { initialSpeed recoilModifier accuracyModifier }
      }
    }
  }
`;

/* ───────────────── коэрсеры ───────────────── */

const num = (v: number | null | undefined, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const numOrNull = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const ids = (v: RawRef[] | null | undefined): string[] =>
  (v ?? []).map((r) => r?.id).filter((id): id is string => typeof id === "string");

function mapSlots(raw: RawSlot[] | null | undefined): EftSlot[] {
  return (raw ?? []).map((s, i) => {
    const allowed = ids(s.filters?.allowedItems);
    const excluded = new Set(ids(s.filters?.excludedItems));
    return {
      slotId: s.id ?? `slot_${i}`,
      nameId: s.nameId ?? s.id ?? `slot_${i}`,
      name: s.name ?? s.nameId ?? "Слот",
      required: s.required === true,
      ord: i,
      allowedItemIds: allowed.filter((id) => !excluded.has(id)),
    };
  });
}

/**
 * Слот детали пресета из attributes — если источник его вдруг начнёт отдавать.
 * Сейчас всегда пусто → слот выводит resolvePresetSlots() по allowedItemIds.
 */
function slotNameFromAttributes(attrs: RawAttribute[] | null | undefined): string {
  const hit = (attrs ?? []).find(
    (a) => a?.name === "slotNameId" || a?.name === "slotId" || a?.type === "slot",
  );
  return typeof hit?.value === "string" && hit.value.length > 0 ? hit.value : "";
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * GraphQL-запрос с ретраями. Ретраим 5xx и сетевые обрывы (tarkov.dev под нагрузкой
 * отдаёт 503), не ретраим 4xx — это ошибка в самом запросе, повтор не поможет.
 */
async function gql(query: string, label: string): Promise<RawItem[]> {
  let lastError = "";

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1] ?? 7000);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query }),
        cache: "no-store",
      });

      if (res.status >= 400 && res.status < 500) {
        throw new Error(`tarkov.dev [${label}] → ${res.status} (запрос битый, ретрай не поможет)`);
      }
      if (!res.ok) {
        lastError = `tarkov.dev [${label}] → ${res.status}`;
        continue; // 5xx — ретраим
      }

      const json = (await res.json()) as RawResponse;
      if (json.errors) {
        throw new Error(`tarkov.dev [${label}] вернул errors: ${JSON.stringify(json.errors)}`);
      }
      return json.data?.items ?? [];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Битый запрос — сразу наружу, ретраить нечего.
      if (msg.includes("ретрай не поможет") || msg.includes("вернул errors")) throw e;
      lastError = msg; // сетевой обрыв / таймаут — ретраим
    }
  }

  throw new Error(`${lastError} — исчерпаны ${RETRIES} ретрая, синк отменён`);
}

/* ───────────────── публичный фетч ───────────────── */

/**
 * Полный дамп оружейного слоя. Бросает при пустом/битом ответе — синк обязан
 * упасть, а не затереть рабочие таблицы пустотой (паттерн syncEftPrices).
 */
export async function getEftWeaponsDump(): Promise<EftWeaponsDump> {
  // Последовательно, а не Promise.all: два тяжёлых запроса параллельно — верный способ
  // выбить у tarkov.dev 503. Ammo-запрос лёгкий, лишние 2 секунды не жалко.
  const main = await gql(MAIN_QUERY, "gun+mods+preset");
  const ammoRaw = await gql(AMMO_QUERY, "ammo");

  if (main.length === 0) throw new Error("tarkov.dev отдал пустой список оружия — синк отменён");

  const bases: EftWeaponBase[] = [];
  const parts: EftWeaponPart[] = [];
  const presets: EftWeaponPreset[] = [];

  for (const it of main) {
    const p = it.properties;
    const tn = p?.__typename;

    if (tn === "ItemPropertiesWeapon") {
      bases.push({
        itemId: it.id,
        caliber: p?.caliber ?? null,
        ergonomics: num(p?.ergonomics),
        recoilVertical: Math.round(num(p?.recoilVertical)),
        recoilHorizontal: Math.round(num(p?.recoilHorizontal)),
        fireRate: numOrNull(p?.fireRate),
        fireModes: p?.fireModes ?? null,
        sightingRange: numOrNull(p?.sightingRange),
        centerOfImpact: numOrNull(p?.centerOfImpact),
        deviationCurve: numOrNull(p?.deviationCurve),
        deviationMax: numOrNull(p?.deviationMax),
        defaultPresetId: p?.defaultPreset?.id ?? null,
        defaultAmmoId: p?.defaultAmmo?.id ?? null,
        allowedAmmoIds: ids(p?.allowedAmmo),
        slots: mapSlots(p?.slots),
      });
      continue;
    }

    if (tn === "ItemPropertiesPreset") {
      const base = p?.baseItem?.id;
      if (!base) continue;
      presets.push({
        id: it.id,
        baseItemId: base,
        name: it.name ?? it.id,
        isDefault: p?.default === true,
        ergonomics: numOrNull(p?.ergonomics),
        recoilVertical: numOrNull(p?.recoilVertical),
        recoilHorizontal: numOrNull(p?.recoilHorizontal),
        moa: numOrNull(p?.moa),
        parts: (it.containsItems ?? [])
          .map((c) => ({
            itemId: c?.item?.id ?? "",
            slotNameId: slotNameFromAttributes(c?.attributes),
            count: num(c?.count, 1),
          }))
          // База пресета лежит внутри containsItems — в детали её не пишем.
          .filter((c) => c.itemId.length > 0 && c.itemId !== base),
      });
      continue;
    }

    // Всё остальное из types:[mods] — модуль. Модификаторы берём с УРОВНЯ ITEM
    // (ergonomicsModifier/recoilModifier/accuracyModifier есть у любого мода),
    // а не из properties: у части типов (foregrip, pistolGrip…) своего typename нет.
    if (it.types?.includes("mods")) {
      parts.push({
        itemId: it.id,
        kind: "mod",
        ergonomics: num(it.ergonomicsModifier ?? p?.ergonomics),
        recoilModifier: num(it.recoilModifier ?? p?.recoilModifier),
        accuracyModifier: num(it.accuracyModifier ?? p?.accuracyModifier),
        velocity: num(it.velocity),
        loudness: Math.round(num(it.loudness)),
        capacity: numOrNull(p?.capacity),
        initialSpeed: null,
        conflictingItemIds: ids(it.conflictingItems),
        conflictingSlotIds: (it.conflictingSlotIds ?? []).filter(
          (s): s is string => typeof s === "string",
        ),
        slots: mapSlots(p?.slots),
      });
    }
  }

  for (const it of ammoRaw) {
    const p = it.properties;
    if (p?.__typename !== "ItemPropertiesAmmo") continue;
    parts.push({
      itemId: it.id,
      kind: "ammo",
      ergonomics: 0,
      // У патрона модификатор отдачи ПЛОСКИЙ: движок добавляет его к базе ДО процентов.
      recoilModifier: num(p.recoilModifier),
      accuracyModifier: num(p.accuracyModifier),
      velocity: 0,
      loudness: 0,
      capacity: null,
      initialSpeed: numOrNull(p.initialSpeed),
      conflictingItemIds: [],
      conflictingSlotIds: [],
      slots: [],
    });
  }

  if (bases.length === 0) throw new Error("не распознано ни одного оружия — синк отменён");

  const dump: EftWeaponsDump = { bases, parts, presets };

  // tarkov.dev не отдаёт слот в containsItems — выводим его сами по allowedItemIds.
  resolvePresetSlots(dump);

  return dump;
}