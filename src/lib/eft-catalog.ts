// Каталог предметов EFT из нашей Supabase (слой 3, серверный).
//
// Источник истины для списка предметов и оффлайн-фолбэк: даже если внешний
// tarkov.dev недоступен, страница рендерится с именами и характеристиками.
// Цены/normalizedName/backgroundColor/types подмешиваются отдельно (eft-prices.ts).
//
// Только для сервера (использует прямой доступ к БД). Импортировать из RSC.
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, itemCategories, itemProperties } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import type { CategoryItemProperties } from "@/app/eft/items/[...category]/ItemsCategoryClient";
import { memoTTL } from "@/lib/server-cache";

export interface EftCatalogItem {
  id: string; // 24-символьный BSG inGameId
  name: string;
  shortName: string;
  category: string | null; // slug категории
  weight?: number;
  width: number;
  height: number;
  basePrice: number;
  properties: CategoryItemProperties;
}

/* ───────────────── безопасные коэрсеры (без any) ───────────────── */
const n = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const s = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;
const bln = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined;
const strArr = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
const num2d = (v: unknown): number[][] | undefined =>
  Array.isArray(v) && v.every((a) => Array.isArray(a)) ? (v as number[][]) : undefined;

/**
 * Наш дискриминированный union (схема БД) → форма свойств, которую ждёт UI
 * (tarkov.dev-имена). Главное расхождение: armor хранит `armorClass`, а UI ждёт
 * `class`. Generic-предметы хранят сырые tarkov.dev-поля, поэтому читаем по общим
 * ключам с коэрсингом. Грубый `type:"generic"` (наш дискриминатор) под тип гранаты
 * не подставляем.
 */
export function mapProps(p: unknown): CategoryItemProperties {
  const r = (p ?? {}) as Record<string, unknown>;
  const grenadeType = s(r.type);
  return {
    class: n(r.armorClass ?? r.class),
    armorType: s(r.armorType),
    durability: n(r.durability),
    ergoPenalty: n(r.ergoPenalty),
    speedPenalty: n(r.speedPenalty),
    turnPenalty: n(r.turnPenalty),
    capacity: n(r.capacity),
    deafening: s(r.deafening),
    blocksHeadset: bln(r.blocksHeadset),
    blindnessProtection: n(r.blindnessProtection),
    nvgIntensity: n(r.intensity ?? r.nvgIntensity),
    noiseIntensity: n(r.noiseIntensity),
    distanceModifier: n(r.distanceModifier),
    ambientVolume: n(r.ambientVolume),
    caliber: s(r.caliber),
    damage: n(r.damage),
    penetrationPower: n(r.penetrationPower),
    armorDamage: n(r.armorDamage),
    fragmentationChance: n(r.fragmentationChance),
    ergonomics: n(r.ergonomics),
    recoilVertical: n(r.recoilVertical),
    recoilHorizontal: n(r.recoilHorizontal),
    fireRate: n(r.fireRate),
    recoilModifier: n(r.recoilModifier),
    zoomLevels: num2d(r.zoomLevels),
    sightingRange: n(r.sightingRange),
    type: grenadeType && grenadeType !== "generic" ? grenadeType : null,
    fragments: n(r.fragments),
    fuse: n(r.fuse),
    maxExplosionDistance: n(r.maxExplosionDistance),
    cures: strArr(r.cures),
    hitpoints: n(r.hitpoints ?? r.maxHpResource),
    uses: n(r.uses),
    useTime: n(r.useTime),
  };
}

/** Весь каталог EFT (все предметы) из Supabase, отсортированный по имени. */
// 24ч — каталог меняется только через ETL (db:etl), не в рантайме.
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;

export async function getEftCatalog(): Promise<EftCatalogItem[]> {
  const rows = await memoTTL("eft-catalog-rows", CATALOG_TTL_MS, async () => {
    const gameId = await eftGameId();
    return db
    .select({
      id: items.inGameId,
      name: items.name,
      shortName: items.shortName,
      category: itemCategories.inGameId,
      weight: items.weight,
      width: items.gridWidth,
      height: items.gridHeight,
      basePrice: items.basePrice,
      properties: itemProperties.properties,
    })
    .from(items)
    .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
    .leftJoin(itemProperties, eq(itemProperties.itemId, items.id))
    .where(eq(items.gameId, gameId))
    .orderBy(asc(items.name));
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    shortName: r.shortName ?? "",
    category: r.category,
    weight: r.weight ?? undefined,
    width: r.width ?? 1,
    height: r.height ?? 1,
    basePrice: r.basePrice ?? 0,
    properties: mapProps(r.properties),
  }));
}
