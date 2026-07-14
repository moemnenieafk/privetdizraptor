// Определения предметов для СОХРАНЁННЫХ сборок (/eft/progress/loadouts/my).
//
// Сборки лежат в localStorage (useBuildStore, ключ `cta-weapon-builds`) — сервер о них
// не знает. Клиент присылает плоский список id (база + установленные модули + патрон),
// сервер отдаёт их определения и пресеты баз. Полный BuildItemIndex ствола (все
// совместимые модули, сотни позиций) для списка избыточен: считать надо уже собранное
// дерево, а не показывать пикер.
//
// Точечные выборки по inArray, без общего кэша каталога: запрос редкий (открытие /my),
// а объём — десятки строк.
//
// Только для сервера. Импортировать из RSC или route handler.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  items,
  itemProperties,
  weaponBases,
  weaponParts,
  weaponPresets,
  weaponSlots,
} from "@/db/schema";
import { eftGameId } from "@/db/eft";
import type {
  BuildItemDef,
  WeaponAmmoDef,
  WeaponBaseDef,
  WeaponModDef,
  WeaponSlotDef,
} from "@/lib/weapon-build";
import type { BuildDefsBundle, PresetRef } from "@/lib/build-media";

/**
 * Определения по точечному списку id + пресеты их баз.
 * Неизвестные id молча пропускаются: движок пометит их как issue `unknown_item`,
 * и сборка со снятым из игры модулем всё равно откроется.
 */
export async function getBuildDefs(itemIds: string[]): Promise<BuildDefsBundle> {
  const empty: BuildDefsBundle = { defs: [], presets: [], names: {} };
  if (itemIds.length === 0) return empty;

  const gameId = await eftGameId();

  const [baseRows, partRows, metaRows] = await Promise.all([
    db
      .select()
      .from(weaponBases)
      .where(and(eq(weaponBases.gameId, gameId), inArray(weaponBases.itemId, itemIds))),
    db
      .select()
      .from(weaponParts)
      .where(and(eq(weaponParts.gameId, gameId), inArray(weaponParts.itemId, itemIds))),
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
      .where(and(eq(items.gameId, gameId), inArray(items.inGameId, itemIds))),
  ]);

  if (baseRows.length === 0) return empty;

  // Слоты нужны и базам, и модулям: движок по ним валидирует дерево и находит
  // обязательные пустые слоты.
  const slotRows = await db
    .select()
    .from(weaponSlots)
    .where(and(eq(weaponSlots.gameId, gameId), inArray(weaponSlots.parentItemId, itemIds)));

  const slotsByParent = new Map<string, WeaponSlotDef[]>();
  for (const s of [...slotRows].sort((a, b) => a.ord - b.ord)) {
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
  const slotsOf = (id: string): WeaponSlotDef[] => slotsByParent.get(id) ?? [];

  const meta = new Map<string, { name: string; shortName: string; weight: number }>();
  const ammoProps = new Map<
    string,
    { caliber: string | null; damage: number; penetrationPower: number }
  >();

  for (const r of metaRows) {
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

  const defs: BuildItemDef[] = [];
  const names: Record<string, string> = {};
  const baseIds = new Set<string>();

  for (const b of baseRows) {
    const m = meta.get(b.itemId);
    baseIds.add(b.itemId);

    const base: WeaponBaseDef = {
      kind: "weapon",
      id: b.itemId,
      name: m?.name ?? b.itemId,
      shortName: m?.shortName ?? "",
      caliber: b.caliber,
      weight: m?.weight ?? 0,
      ergonomics: b.ergonomics,
      recoilVertical: b.recoilVertical,
      recoilHorizontal: b.recoilHorizontal,
      fireRate: b.fireRate,
      sightingRange: b.sightingRange,
      moa: b.centerOfImpact,
      slots: slotsOf(b.itemId),
      defaultPresetId: b.defaultPresetId,
    };

    defs.push(base);
    names[base.id] = base.name;
  }

  for (const p of partRows) {
    const m = meta.get(p.itemId);

    if (p.kind === "mod") {
      const mod: WeaponModDef = {
        kind: "mod",
        id: p.itemId,
        name: m?.name ?? p.itemId,
        shortName: m?.shortName ?? "",
        weight: m?.weight ?? 0,
        ergonomics: p.ergonomics,
        recoilModifier: p.recoilModifier,
        accuracyModifier: p.accuracyModifier,
        velocity: p.velocity,
        loudness: p.loudness,
        capacity: p.capacity,
        conflictingItemIds: p.conflictingItemIds,
        conflictingSlotIds: p.conflictingSlotIds,
        slots: slotsOf(p.itemId),
      };
      defs.push(mod);
      names[mod.id] = mod.name;
      continue;
    }

    const ap = ammoProps.get(p.itemId);
    const ammo: WeaponAmmoDef = {
      kind: "ammo",
      id: p.itemId,
      name: m?.name ?? p.itemId,
      shortName: m?.shortName ?? "",
      weight: m?.weight ?? 0,
      caliber: ap?.caliber ?? null,
      damage: ap?.damage ?? 0,
      penetrationPower: ap?.penetrationPower ?? 0,
      initialSpeed: p.initialSpeed ?? 0,
      recoilModifier: p.recoilModifier,
      accuracyModifier: p.accuracyModifier,
    };
    defs.push(ammo);
    names[ammo.id] = ammo.name;
  }

  // Пресеты баз — для hero-картинки: если дерево совпало с пресетом, показываем
  // его отрендеренную картинку вместо «база + планка иконок».
  const presetRows = await db
    .select()
    .from(weaponPresets)
    .where(
      and(eq(weaponPresets.gameId, gameId), inArray(weaponPresets.baseItemId, [...baseIds])),
    );

  const presets: PresetRef[] = presetRows.map((p) => ({
    id: p.id,
    baseItemId: p.baseItemId,
    isDefault: p.isDefault,
    partIds: p.parts.map((x) => x.itemId),
  }));

  return { defs, presets, names };
}
