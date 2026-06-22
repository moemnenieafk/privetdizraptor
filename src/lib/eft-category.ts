// Порт getCategoryItems на нашу БД (Заход 2 миграции категорий).
// Берём обогащённый каталог (items + item_properties.properties_raw + prices.types/
// bsgCategoryId/sellFor/buyFor) и применяем те же маппинги slug→types/bsgCategoryId
// и пост-фильтры, что и старая версия на tarkov.dev. Рантайм в tarkov.dev НЕ ходит.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { items, itemProperties } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { getEftPriceMapFromDb } from "@/db/prices";
import { mapProps } from "@/lib/eft-catalog";
import { itemIconUrl } from "@/lib/item-icon";
import type { CtaVendorOffer } from "@/lib/eft-prices";
import type { CategoryItem } from "@/app/eft/items/[...category]/ItemsCategoryClient";
import { EFT_QUESTS } from "@/data/quests";

interface EnrichedItem {
  id: string;
  name: string;
  shortName: string;
  weight?: number;
  width: number;
  height: number;
  basePrice: number;
  normalizedName: string;
  backgroundColor?: string;
  types: string[];
  bsgCategoryId?: string;
  propertiesRaw: Record<string, unknown> | null;
  sellFor: CtaVendorOffer[];
  buyFor: CtaVendorOffer[];
}

/* ───────────────── обогащённый каталог из нашей БД ───────────────── */
async function loadEnriched(): Promise<EnrichedItem[]> {
  const gameId = await eftGameId();
  const [rows, priceMap] = await Promise.all([
    db
      .select({
        id: items.inGameId,
        name: items.name,
        shortName: items.shortName,
        weight: items.weight,
        width: items.gridWidth,
        height: items.gridHeight,
        basePrice: items.basePrice,
        propertiesRaw: itemProperties.propertiesRaw,
      })
      .from(items)
      .leftJoin(itemProperties, eq(itemProperties.itemId, items.id))
      .where(eq(items.gameId, gameId)),
    getEftPriceMapFromDb(),
  ]);

  return rows.map((r) => {
    const px = priceMap.get(r.id);
    return {
      id: r.id,
      name: r.name,
      shortName: r.shortName ?? "",
      weight: r.weight ?? undefined,
      width: r.width ?? 1,
      height: r.height ?? 1,
      basePrice: r.basePrice ?? 0,
      normalizedName: px?.normalizedName ?? "",
      backgroundColor: px?.backgroundColor,
      types: px?.types ?? [],
      bsgCategoryId: px?.bsgCategoryId,
      propertiesRaw: r.propertiesRaw,
      sellFor: px?.sellFor ?? [],
      buyFor: px?.buyFor ?? [],
    };
  });
}

const toCategoryItem = (e: EnrichedItem): CategoryItem => ({
  id: e.id,
  normalizedName: e.normalizedName,
  name: e.name,
  shortName: e.shortName,
  width: e.width,
  height: e.height,
  weight: e.weight,
  backgroundColor: e.backgroundColor,
  basePrice: e.basePrice,
  image512pxLink: itemIconUrl(e.id),
  types: e.types,
  properties: mapProps(e.propertiesRaw),
  sellFor: e.sellFor,
  buyFor: e.buyFor,
});

/* ───────────────── helpers для чтения сырых свойств ───────────────── */
const praw = (e: EnrichedItem): Record<string, unknown> => e.propertiesRaw ?? {};
const ptype = (e: EnrichedItem): string => (typeof praw(e).__typename === "string" ? (praw(e).__typename as string) : "");
const has = (e: EnrichedItem, t: string): boolean => e.types.includes(t);

/* ───────────────── маппинги категорий (как в [...category]/page.tsx) ───────────────── */
const SPECIALEQUIPMENT_BSG_IDS = new Set([
  "5a2c3a9486f774688b05e574",
  "5d21f59b6dbe99052b54ef83",
  "5b3f15d486f77432d0509248",
  "5f4fbaaca5573a5ac31db429",
]);
const CARBINE_BASE_AR = "5447b5f14bdc2d61278b4567";
const CARBINE_BASE_SEMI = "5447b5fc4bdc2d87278b4567";
const GEAR_TYPES = ["armor", "backpack", "container", "glasses", "headphones", "helmet", "wearable", "rig"];
const MASK_BSG = "5a341c4686f77469e155819e";
const GEAR_COMPONENTS_BSG = "57bef4c42459772e8d35a53b";

const typeMapping: Record<string, string> = {
  gear: "armor, backpack, container, glasses, headphones, helmet, wearable, rig",
  armor: "armor", backpacks: "backpack", glasses: "glasses", headphones: "headphones",
  helmets: "helmet, wearable", rigs: "rig", visors: "mods",
  containers: "container", cases: "container", secure: "noFlea", "secure-containers": "noFlea", "storage-containers": "container",
  weapons: "gun", ar: "gun", bolt: "gun", dmr: "gun", gl: "gun", grenades: "grenade", lmg: "gun",
  shotgun: "gun", sidearm: "gun", smg: "gun", special: "gun",
  mods: "mods", vitalparts: "mods", functional: "mods", elements: "mods", auxiliary: "mods", "auxiliary-parts": "mods",
  barrels: "mods", bipods: "mods", charginghandles: "mods", foregrips: "mods", gasblocks: "mods", handguards: "mods",
  laser: "mods", launchers: "mods", "light-laser-devices": "mods", magazines: "mods", mounts: "mods", muzzle: "mods",
  pistolgrips: "mods", receivers: "mods", "receivers-slides": "mods", sights: "mods", stocks: "mods",
  ammo: "ammo, ammoBox", rounds: "ammo", "ammo-boxes": "ammoBox",
  barter: "barter", valuables: "barter", electronics: "barter", tools: "barter", "flammable-materials": "barter",
  "building-materials": "barter", "household-materials": "barter", "medical-supplies": "barter", "energy-elements": "barter",
  others: "barter", specialequipment: "mods, wearable",
  meds: "meds", injury: "meds", injectors: "injectors", medkits: "meds", pills: "meds",
  keys: "keys", mechanical: "keys", keycards: "keys",
  provisions: "provisions", drinks: "provisions", food: "provisions",
  eyewear: "glasses, mods",
  guns: "gun, ammo, grenade, mods", firearms: "gun", equipment: "meds, keys, container, provisions", marked: "keys", quest: "keys",
};

const bsgCategoryMapping: Record<string, string> = {
  info: "5448ecbe4bdc2d60728b4568", "info-items": "5448ecbe4bdc2d60728b4568",
  ar: "5447b5f14bdc2d61278b4567", smg: "5447b5e04bdc2d62278b4567", sidearm: "5447b5cf4bdc2d65278b4567",
  lmg: "5447bed64bdc2d97278b4568", shotgun: "5447b6094bdc2dc3278b4567", bolt: "5447b6254bdc2dc3278b4568",
  dmr: "5447b6194bdc2d67278b4567", melee: "5447e1d04bdc2dff2f8b4567", gl: "67446d4f04141c10630604e7",
  masks: "5a341c4686f77469e155819e", facecovers: "5a341c4686f77469e155819e", components: "57bef4c42459772e8d35a53b",
  food: "5448e8d04bdc2ddf718b4569", drinks: "5448e8d64bdc2dce718b4568",
  others: "590c745b86f7743cc433c5f2", valuables: "57864a3d24597754843f8721", electronics: "57864a66245977548f04a81f",
  tools: "57864bb7245977548b3b66c2", "household-materials": "57864c322459775490116fbf",
  "building-materials": "57864ada245977548638de91", "medical-supplies": "57864c8c245977548867e7f1",
  "energy-elements": "57864ee62459775490116fc1",
  mechanical: "5c99f98d86f7745c314214b3", marked: "5c99f98d86f7745c314214b3", quest: "5c99f98d86f7745c314214b3",
  keycards: "5c164d2286f774194c5e69fa",
  gasblocks: "56ea9461d2720b67698b456f", receivers: "55818a304bdc2db5418b457d", "receivers-slides": "55818a304bdc2db5418b457d",
  pistolgrips: "55818a684bdc2ddd698b456d", barrels: "555ef6e44bdc2de9068b457e", handguards: "55818a104bdc2db9688b4569",
  auxiliary: "5a74651486f7744e73386dd1", "auxiliary-parts": "5a74651486f7744e73386dd1", bipods: "55818afb4bdc2dde698b456d",
  foregrips: "55818af64bdc2d5b648b4570", mounts: "55818b224bdc2dde698b456f", magazines: "5448bc234bdc2d3c308b4569",
  stocks: "55818a594bdc2db9688b456a", charginghandles: "55818a6f4bdc2db9688b456b", launchers: "55818b014bdc2ddc698b456b",
};

const bsgMultiCategoryFilter: Record<string, Set<string>> = {
  vitalparts: new Set(["56ea9461d2720b67698b456f", "55818a304bdc2db5418b457d", "55818a684bdc2ddd698b456d", "555ef6e44bdc2de9068b457e", "55818a104bdc2db9688b4569"]),
  functional: new Set(["5a74651486f7744e73386dd1", "550aa4bf4bdc2dd6348b456b", "550aa4cd4bdc2dd8348b456c", "550aa4dd4bdc2dc9348b4569", "55818ad54bdc2ddc698b4569", "55818add4bdc2d5b648b456f", "55818ac54bdc2d5b648b456e", "55818ae44bdc2dde698b456c", "55818acf4bdc2dde698b456b", "55818aeb4bdc2ddc698b456a", "55818b164bdc2ddc698b456c", "55818b084bdc2d5b648b4571", "55818afb4bdc2dde698b456d", "55818af64bdc2d5b648b4570"]),
  elements: new Set(["55818b224bdc2dde698b456f", "5448bc234bdc2d3c308b4569", "55818a594bdc2db9688b456a", "55818a6f4bdc2db9688b456b", "55818b014bdc2ddc698b456b"]),
  "flammable-materials": new Set(["57864e4c24597754843f8723", "5d650c3e815116009f6201d2"]),
  muzzle: new Set(["550aa4bf4bdc2dd6348b456b", "550aa4cd4bdc2dd8348b456c", "550aa4dd4bdc2dc9348b4569"]),
  sights: new Set(["55818ad54bdc2ddc698b4569", "55818add4bdc2d5b648b456f", "55818ac54bdc2d5b648b456e", "55818ae44bdc2dde698b456c", "55818acf4bdc2dde698b456b", "55818aeb4bdc2ddc698b456a"]),
  laser: new Set(["55818b164bdc2ddc698b456c", "55818b084bdc2d5b648b4571"]),
  "light-laser-devices": new Set(["55818b164bdc2ddc698b456c", "55818b084bdc2d5b648b4571"]),
  provisions: new Set(["5448e8d04bdc2ddf718b4569", "5448e8d64bdc2dce718b4568"]),
  special: new Set(["617f1ef5e8b54b0998387733", "5447bedf4bdc2d87278b4568"]),
  specialequipment: new Set(["5a2c3a9486f774688b05e574", "5d21f59b6dbe99052b54ef83", "5b3f15d486f77432d0509248", "5f4fbaaca5573a5ac31db429"]),
};

/* ───────────────── отбор предметов по slug ───────────────── */
function selectForSlug(slug: string, all: EnrichedItem[]): EnrichedItem[] {
  // Спец-категории
  if (slug === "quest-items") {
    const ids = new Set<string>();
    for (const t of EFT_QUESTS) {
      for (const o of t.objectives ?? []) {
        if (o.__typename === "TaskObjectiveItem" && o.item?.id) ids.add(o.item.id);
      }
    }
    return all.filter((e) => ids.has(e.id));
  }

  if (slug === "carbine") {
    // Пресет-сборки недоступны в нашем источнике (items_database.json не несёт
    // preset default/baseItem — только __typename). Автономный фолбэк: базовые
    // карабины (оружие по BSG-категориям) с их характеристиками.
    return all.filter(
      (e) =>
        (e.bsgCategoryId === CARBINE_BASE_AR && /^Карабин/i.test(e.name)) ||
        e.bsgCategoryId === CARBINE_BASE_SEMI,
    );
  }

  if (slug === "gear") {
    return all.filter(
      (e) =>
        !SPECIALEQUIPMENT_BSG_IDS.has(e.bsgCategoryId ?? "") &&
        (GEAR_TYPES.some((t) => has(e, t)) || e.bsgCategoryId === MASK_BSG || e.bsgCategoryId === GEAR_COMPONENTS_BSG),
    );
  }

  // Базовый отбор: bsgCategoryId имеет приоритет над types (как activeFilter = bsg || type)
  const bsgId = bsgCategoryMapping[slug];
  const gqlType = typeMapping[slug];
  let result: EnrichedItem[];
  if (bsgId) {
    result = all.filter((e) => e.bsgCategoryId === bsgId);
  } else if (gqlType) {
    const wanted = gqlType.split(",").map((t) => t.trim());
    result = all.filter((e) => wanted.some((t) => has(e, t)));
  } else {
    return [];
  }

  // Пост-фильтры по slug (как в оригинале)
  const helmetAttach = /бронезабрало|мандибул|дополнительное бронирование/i;
  if (slug === "secure" || slug === "secure-containers") {
    result = result.filter((e) => ptype(e) === "ItemPropertiesContainer" && !has(e, "container"));
  } else if (slug === "storage-containers") {
    result = result.filter((e) => !has(e, "markedOnly"));
  } else if (slug === "cases") {
    result = result.filter((e) => /кейс/i.test(e.name));
  } else if (slug === "medkits") {
    result = result.filter((e) => ptype(e) === "ItemPropertiesMedKit");
  } else if (slug === "injury") {
    result = result.filter((e) => ptype(e) === "ItemPropertiesMedicalItem" || ptype(e) === "ItemPropertiesSurgicalKit");
  } else if (slug === "pills") {
    result = result.filter((e) => ptype(e) === "ItemPropertiesPainkiller" && /^таблетки/i.test(e.name));
  } else if (slug === "ar") {
    result = result.filter((e) => !/^Карабин/i.test(e.name));
  } else if (slug === "rounds") {
    result = result.filter((e) => !has(e, "ammoBox") && !has(e, "grenade"));
  } else if (slug === "helmets") {
    result = result.filter((e) => has(e, "helmet") || (e.bsgCategoryId === GEAR_COMPONENTS_BSG && helmetAttach.test(e.name)));
  } else if (slug === "components") {
    result = result.filter((e) => !helmetAttach.test(e.name));
  } else if (slug === "eyewear") {
    result = result.filter(
      (e) =>
        !/бронезабрало/i.test(e.name) &&
        (!has(e, "mods") ||
          praw(e).armorType != null ||
          praw(e).intensity != null ||
          praw(e).nvgIntensity != null ||
          /прибор ночного видения/i.test(e.name)),
    );
  } else if (slug === "marked") {
    result = result.filter((e) => e.normalizedName.includes("marked"));
  } else if (slug === "quest") {
    result = result.filter((e) => has(e, "noFlea"));
  }

  // Мульти-BSG сужение (запрос по types → фильтр по bsgCategoryId в наборе)
  const multi = bsgMultiCategoryFilter[slug];
  if (multi) result = result.filter((e) => multi.has(e.bsgCategoryId ?? ""));

  return result;
}

/** Предметы категории `slug` — из НАШЕЙ БД (замена getCategoryItems на tarkov.dev). */
export async function getEftCategoryItems(slug: string): Promise<CategoryItem[]> {
  const all = await loadEnriched();
  return selectForSlug(slug, all).map(toCategoryItem);
}
