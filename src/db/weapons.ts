// Оружейный слой: синк из tarkov.dev + читалки для конструктора сборок.
//
// Источник (tarkov.dev) трогают ТОЛЬКО syncEftWeapons() и syncEftGunsmith() — их
// дёргает /api/cron/sync-weapons. Рантайм читает наши таблицы weapon_* (правило автономии).
//
// Полная замена в транзакции, а не upsert: между патчами BSG режет и переименовывает
// слоты, и осиротевшая строка weapon_slots отравила бы пикер «фантомным» слотом.
// Таблицы маленькие (~170 стволов / ~2400 деталей / ~3200 слотов) — замена дешевле прюна.
//
// Импорты относительные (не @/), чтобы модуль грузился и под tsx-скриптом.
import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import {
  items,
  itemProperties,
  weaponBases,
  weaponParts,
  weaponPresets,
  weaponSlots,
} from "./schema";
import { gunsmithSpecs, type GunsmithSpecRow } from "./schema-gunsmith";
import { eftGameId } from "./eft";
import { getEftWeaponsDump, type EftSlot } from "../lib/eft-weapons";
import { getEftGunsmithSpecs } from "../lib/eft-gunsmith";
import { memoTTL } from "../lib/server-cache";
import type {
  BuildItemDef,
  BuildItemIndex,
  WeaponAmmoDef,
  WeaponBaseDef,
  WeaponModDef,
  WeaponSlotDef,
} from "../lib/weapon-build";
import type { PresetRef } from "../lib/build-media";

/* ───────────────────────── синк: оружейный слой ───────────────────────── */

export interface SyncWeaponsResult {
  bases: number;
  parts: number;
  presets: number;
  slots: number;
}

const CHUNK = 500;

async function insertChunked<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await insert(rows.slice(i, i + CHUNK));
  }
}

/** Тянет оружейный слой из tarkov.dev и полностью пересобирает таблицы weapon_*. */
export async function syncEftWeapons(): Promise<SyncWeaponsResult> {
  const dump = await getEftWeaponsDump(); // бросит сам, если ответ пустой/битый
  const gameId = await eftGameId();

  // Слоты собираем в один плоский список: и от стволов, и от самих модулей.
  const slotRows: (typeof weaponSlots.$inferInsert)[] = [];
  const pushSlots = (parentItemId: string, slots: EftSlot[]) => {
    for (const s of slots) {
      slotRows.push({
        gameId,
        parentItemId,
        slotId: s.slotId,
        nameId: s.nameId,
        name: s.name,
        required: s.required,
        ord: s.ord,
        allowedItemIds: s.allowedItemIds,
      });
    }
  };

  const baseRows = dump.bases.map((b) => {
    pushSlots(b.itemId, b.slots);
    return {
      gameId,
      itemId: b.itemId,
      caliber: b.caliber,
      ergonomics: b.ergonomics,
      recoilVertical: b.recoilVertical,
      recoilHorizontal: b.recoilHorizontal,
      fireRate: b.fireRate,
      fireModes: b.fireModes,
      sightingRange: b.sightingRange,
      centerOfImpact: b.centerOfImpact,
      deviationCurve: b.deviationCurve,
      deviationMax: b.deviationMax,
      defaultPresetId: b.defaultPresetId,
      defaultAmmoId: b.defaultAmmoId,
      allowedAmmoIds: b.allowedAmmoIds,
    } satisfies typeof weaponBases.$inferInsert;
  });

  const partRows = dump.parts.map((p) => {
    if (p.slots.length > 0) pushSlots(p.itemId, p.slots);
    return {
      gameId,
      itemId: p.itemId,
      kind: p.kind,
      ergonomics: p.ergonomics,
      recoilModifier: p.recoilModifier,
      accuracyModifier: p.accuracyModifier,
      velocity: p.velocity,
      loudness: p.loudness,
      capacity: p.capacity,
      initialSpeed: p.initialSpeed,
      conflictingItemIds: p.conflictingItemIds,
      conflictingSlotIds: p.conflictingSlotIds,
    } satisfies typeof weaponParts.$inferInsert;
  });

  const presetRows = dump.presets.map((p) => ({
    id: p.id,
    gameId,
    baseItemId: p.baseItemId,
    name: p.name,
    isDefault: p.isDefault,
    ergonomics: p.ergonomics,
    recoilVertical: p.recoilVertical,
    recoilHorizontal: p.recoilHorizontal,
    moa: p.moa,
    parts: p.parts,
  })) satisfies (typeof weaponPresets.$inferInsert)[];

  await db.transaction(async (tx) => {
    await tx.delete(weaponSlots).where(eq(weaponSlots.gameId, gameId));
    await tx.delete(weaponParts).where(eq(weaponParts.gameId, gameId));
    await tx.delete(weaponPresets).where(eq(weaponPresets.gameId, gameId));
    await tx.delete(weaponBases).where(eq(weaponBases.gameId, gameId));

    await insertChunked(baseRows, (b) => tx.insert(weaponBases).values(b));
    await insertChunked(partRows, (b) => tx.insert(weaponParts).values(b));
    await insertChunked(presetRows, (b) => tx.insert(weaponPresets).values(b));
    await insertChunked(slotRows, (b) => tx.insert(weaponSlots).values(b));
  });

  return {
    bases: baseRows.length,
    parts: partRows.length,
    presets: presetRows.length,
    slots: slotRows.length,
  };
}

/* ───────────────────────── синк: спеки «Оружейника» ───────────────────────── */

export interface SyncGunsmithResult {
  specs: number;
  /** Спеки без единого порога — источник что-то не отдал, солвер по ним не поедет. */
  specsWithoutThresholds: number;
}

/** Тянет пороги квестовых сборок и полностью пересобирает gunsmith_specs. */
export async function syncEftGunsmith(): Promise<SyncGunsmithResult> {
  const specs = await getEftGunsmithSpecs(); // бросит сам при пустом ответе
  const gameId = await eftGameId();

  const rows = specs.map((s) => ({
    objectiveId: s.objectiveId,
    gameId,
    taskId: s.taskId,
    taskName: s.taskName,
    traderName: s.traderName,
    minPlayerLevel: s.minPlayerLevel,
    part: s.part,
    baseItemId: s.baseItemId,
    requiredItemIds: s.requiredItemIds,
    requiredCategoryIds: s.requiredCategoryIds,
    thresholds: s.thresholds,
  })) satisfies (typeof gunsmithSpecs.$inferInsert)[];

  await db.transaction(async (tx) => {
    await tx.delete(gunsmithSpecs).where(eq(gunsmithSpecs.gameId, gameId));
    await insertChunked(rows, (b) => tx.insert(gunsmithSpecs).values(b));
  });

  return {
    specs: rows.length,
    specsWithoutThresholds: rows.filter((r) => r.thresholds.length === 0).length,
  };
}

/* ───────────────────────── чтение (рантайм) ───────────────────────── */

// 24ч: оружейный слой меняется только патчем игры + синком, не в рантайме.
const WEAPONS_TTL_MS = 24 * 60 * 60 * 1000;

interface WeaponCatalog {
  bases: (typeof weaponBases.$inferSelect)[];
  parts: (typeof weaponParts.$inferSelect)[];
  presets: (typeof weaponPresets.$inferSelect)[];
  /** parentItemId → его слоты (отсортированы по ord). */
  slotsByParent: Map<string, WeaponSlotDef[]>;
  /** id → имя/шорт/вес из общей таблицы items. */
  meta: Map<string, { name: string; shortName: string; weight: number }>;
  /** id → свойства патрона (калибр/урон/пробитие) из item_properties. */
  ammoProps: Map<string, { caliber: string | null; damage: number; penetrationPower: number }>;
}

/** Весь оружейный слой одним чтением. Кэш на процесс — конструктор дёргает его на каждый рендер. */
async function loadWeaponCatalog(): Promise<WeaponCatalog> {
  return memoTTL("eft-weapon-catalog", WEAPONS_TTL_MS, async () => {
    const gameId = await eftGameId();

    const [baseRows, partRows, presetRows, slotRows, itemRows] = await Promise.all([
      db.select().from(weaponBases).where(eq(weaponBases.gameId, gameId)),
      db.select().from(weaponParts).where(eq(weaponParts.gameId, gameId)),
      db.select().from(weaponPresets).where(eq(weaponPresets.gameId, gameId)),
      db
        .select()
        .from(weaponSlots)
        .where(eq(weaponSlots.gameId, gameId))
        .orderBy(asc(weaponSlots.ord)),
      db
        .select({
          id: items.inGameId,
          name: items.name,
          shortName: items.shortName,
          weight: items.weight,
          properties: itemProperties.properties,
        })
        .from(items)
        .leftJoin(itemProperties, eq(itemProperties.itemId, items.id))
        .where(eq(items.gameId, gameId)),
    ]);

    const slotsByParent = new Map<string, WeaponSlotDef[]>();
    for (const s of slotRows) {
      const list = slotsByParent.get(s.parentItemId) ?? [];
      list.push({
        slotId: s.slotId,
        nameId: s.nameId,
        name: s.name,
        required: s.required,
        allowedItemIds: s.allowedItemIds,
      });
      slotsByParent.set(s.parentItemId, list);
    }

    const meta = new Map<string, { name: string; shortName: string; weight: number }>();
    const ammoProps = new Map<
      string,
      { caliber: string | null; damage: number; penetrationPower: number }
    >();

    for (const r of itemRows) {
      meta.set(r.id, {
        name: r.name,
        shortName: r.shortName ?? "",
        weight: r.weight ?? 0,
      });
      const p = r.properties;
      if (p && p.type === "ammo") {
        ammoProps.set(r.id, {
          caliber: p.caliber ?? null,
          damage: p.damage ?? 0,
          penetrationPower: p.penetrationPower ?? 0,
        });
      }
    }

    return { bases: baseRows, parts: partRows, presets: presetRows, slotsByParent, meta, ammoProps };
  });
}

/* ───────────────── список баз (экран «выбери ствол») ───────────────── */

export interface WeaponBaseListItem {
  id: string;
  name: string;
  shortName: string;
  caliber: string | null;
  ergonomics: number;
  recoilSum: number;
  /** id пресета для hero-картинки (у пресета своя, с обвесом), иначе — id самого ствола. */
  imageItemId: string;
}

export async function getWeaponBaseList(): Promise<WeaponBaseListItem[]> {
  const cat = await loadWeaponCatalog();

  return cat.bases
    .map((b) => {
      const m = cat.meta.get(b.itemId);
      return {
        id: b.itemId,
        name: m?.name ?? b.itemId,
        shortName: m?.shortName ?? "",
        caliber: b.caliber,
        ergonomics: b.ergonomics,
        recoilSum: b.recoilVertical + b.recoilHorizontal,
        imageItemId: b.defaultPresetId ?? b.itemId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

/* ───────────────── контекст конструктора для одной базы ───────────────── */

export interface BuildContext {
  base: WeaponBaseDef;
  /** Справочник для движка: база + все транзитивно достижимые модули + допустимые патроны. */
  index: BuildItemIndex;
  presets: PresetRef[];
  /** id → имя (для alt/подписей в BuildMedia и пикере). */
  names: Record<string, string>;
}

/**
 * Собирает BuildItemIndex обходом дерева слотов от базы вширь: слот базы → допустимые
 * модули → их собственные слоты → и так далее. В индекс попадает только то, что реально
 * можно поставить на ЭТОТ ствол — пикер не тащит все 2400 модулей игры.
 */
export async function getBuildContext(baseItemId: string): Promise<BuildContext | null> {
  const cat = await loadWeaponCatalog();

  const baseRow = cat.bases.find((b) => b.itemId === baseItemId);
  if (!baseRow) return null;

  const partById = new Map(cat.parts.map((p) => [p.itemId, p]));
  const index = new Map<string, BuildItemDef>();
  const names: Record<string, string> = {};

  const slotsOf = (itemId: string): WeaponSlotDef[] => cat.slotsByParent.get(itemId) ?? [];

  const base: WeaponBaseDef = {
    kind: "weapon",
    id: baseRow.itemId,
    name: cat.meta.get(baseRow.itemId)?.name ?? baseRow.itemId,
    shortName: cat.meta.get(baseRow.itemId)?.shortName ?? "",
    caliber: baseRow.caliber,
    weight: cat.meta.get(baseRow.itemId)?.weight ?? 0,
    ergonomics: baseRow.ergonomics,
    recoilVertical: baseRow.recoilVertical,
    recoilHorizontal: baseRow.recoilHorizontal,
    fireRate: baseRow.fireRate,
    sightingRange: baseRow.sightingRange,
    moa: baseRow.centerOfImpact,
    slots: slotsOf(baseRow.itemId),
    defaultPresetId: baseRow.defaultPresetId,
  };

  index.set(base.id, base);
  names[base.id] = base.name;

  // BFS по дереву слотов.
  const queue: string[] = base.slots.flatMap((s) => s.allowedItemIds);
  const seen = new Set<string>([base.id]);

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const row = partById.get(id);
    if (!row || row.kind !== "mod") continue;

    const m = cat.meta.get(id);
    const slots = slotsOf(id);

    const mod: WeaponModDef = {
      kind: "mod",
      id,
      name: m?.name ?? id,
      shortName: m?.shortName ?? "",
      weight: m?.weight ?? 0,
      ergonomics: row.ergonomics,
      recoilModifier: row.recoilModifier,
      accuracyModifier: row.accuracyModifier,
      velocity: row.velocity,
      loudness: row.loudness,
      capacity: row.capacity,
      conflictingItemIds: row.conflictingItemIds,
      conflictingSlotIds: row.conflictingSlotIds,
      slots,
    };

    index.set(id, mod);
    names[id] = mod.name;

    for (const s of slots) {
      for (const allowed of s.allowedItemIds) {
        if (!seen.has(allowed)) queue.push(allowed);
      }
    }
  }

  // Патроны: только допустимые для калибра этого ствола.
  for (const ammoId of baseRow.allowedAmmoIds) {
    const row = partById.get(ammoId);
    if (!row || row.kind !== "ammo") continue;
    const m = cat.meta.get(ammoId);
    const ap = cat.ammoProps.get(ammoId);

    const ammo: WeaponAmmoDef = {
      kind: "ammo",
      id: ammoId,
      name: m?.name ?? ammoId,
      shortName: m?.shortName ?? "",
      weight: m?.weight ?? 0,
      caliber: ap?.caliber ?? baseRow.caliber,
      damage: ap?.damage ?? 0,
      penetrationPower: ap?.penetrationPower ?? 0,
      initialSpeed: row.initialSpeed ?? 0,
      recoilModifier: row.recoilModifier,
      accuracyModifier: row.accuracyModifier,
    };

    index.set(ammoId, ammo);
    names[ammoId] = ammo.name;
  }

  const presets: PresetRef[] = cat.presets
    .filter((p) => p.baseItemId === baseItemId)
    .map((p) => ({
      id: p.id,
      baseItemId: p.baseItemId,
      isDefault: p.isDefault,
      partIds: p.parts.map((x) => x.itemId),
    }));

  return { base, index, presets, names };
}

/** Пресеты одной базы — для витрины «Готовые сборки от торговцев» (без индекса модулей). */
export async function getWeaponPresets(baseItemId: string): Promise<PresetRef[]> {
  const cat = await loadWeaponCatalog();
  return cat.presets
    .filter((p) => p.baseItemId === baseItemId)
    .map((p) => ({
      id: p.id,
      baseItemId: p.baseItemId,
      isDefault: p.isDefault,
      partIds: p.parts.map((x) => x.itemId),
    }));
}

/* ───────────────── совместимость мод↔оружие (фильтр каталога) ───────────────── */

export interface ModCompatibility {
  /** Список стволов для пикера (отсортирован по имени). */
  weapons: { id: string; name: string; shortName: string }[];
  /** modId → id стволов, на которые он транзитивно ставится. */
  modToWeapons: Record<string, string[]>;
}

/**
 * Обратный индекс совместимости: для каждого мода — на какие стволы он подходит.
 * Строится инверсией `getBuildContext` (BFS дерева слотов) по всем базам — та же
 * логика, что питает конструктор, поэтому «подходит» = 1:1 с пикером сборки.
 * Данные из наших weapon_* таблиц (правило автономии), кэш на процесс.
 */
export async function getModCompatibilityMap(): Promise<ModCompatibility> {
  return memoTTL("eft-mod-compat", WEAPONS_TTL_MS, async () => {
    const bases = await getWeaponBaseList();
    const modToWeapons: Record<string, string[]> = {};
    for (const b of bases) {
      const ctx = await getBuildContext(b.id);
      if (!ctx) continue;
      for (const [id, def] of ctx.index) {
        if (def.kind !== "mod") continue;
        (modToWeapons[id] ??= []).push(b.id);
      }
    }
    const weapons = bases.map((b) => ({ id: b.id, name: b.name, shortName: b.shortName }));
    return { weapons, modToWeapons };
  });
}

/* ───────────────── спеки «Оружейника» (рантайм) ───────────────── */

const GUNSMITH_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Все квестовые спеки, отсортированные по номеру части (именные — в конец).
 * Питают вкладку «Оружейник» и солвер.
 */
export async function getGunsmithSpecs(): Promise<GunsmithSpecRow[]> {
  return memoTTL("eft-gunsmith-specs", GUNSMITH_TTL_MS, async () => {
    const gameId = await eftGameId();
    const rows = await db
      .select()
      .from(gunsmithSpecs)
      .where(eq(gunsmithSpecs.gameId, gameId));

    return rows.sort((a, b) => {
      if (a.part != null && b.part != null) return a.part - b.part;
      if (a.part != null) return -1; // нумерованные выше именных
      if (b.part != null) return 1;
      return a.taskName.localeCompare(b.taskName, "ru");
    });
  });
}

/** Спека по id цели — для страницы одного квеста. */
export async function getGunsmithSpec(objectiveId: string): Promise<GunsmithSpecRow | null> {
  const gameId = await eftGameId();
  const [row] = await db
    .select()
    .from(gunsmithSpecs)
    .where(and(eq(gunsmithSpecs.gameId, gameId), eq(gunsmithSpecs.objectiveId, objectiveId)))
    .limit(1);
  return row ?? null;
}