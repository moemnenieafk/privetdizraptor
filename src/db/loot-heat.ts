// Ридер точек heatmap плотности ДЕНЕГ (EV) для карты. EV считается ЗДЕСЬ (сервер),
// клиенту летят лишь {x,z,ev} — без тяжёлых пулов. Данные: loot_spawns (SPT loose) × цена (prices).
// Решение: docs/decisions/heatmap-loot-ev-dataset.md (фаза 2).
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { lootSpawns, lootContainerPools, type LootPoolEntry } from "./schema";
import { eftGameId } from "./eft";

export interface HeatPoint {
  x: number;
  z: number;
  /** Матожидание ₽ точки = probability × Σ prob·price(tpl). */
  ev: number;
}

type PriceLike = Map<string, { lastLowPrice?: number | null; avg24hPrice?: number | null }>;

/** Loose-точки карты с посчитанным EV (>0). Контейнеры — отдельным инкрементом (джойн к маркерам). */
export async function getLootHeatPoints(mapId: string, priceIndex: PriceLike): Promise<HeatPoint[]> {
  const gameId = await eftGameId();
  const rows = await db
    .select({ x: lootSpawns.x, z: lootSpawns.z, probability: lootSpawns.probability, pool: lootSpawns.pool })
    .from(lootSpawns)
    .where(and(eq(lootSpawns.gameId, gameId), eq(lootSpawns.mapId, mapId)));

  const price = (tpl: string) => {
    const p = priceIndex.get(tpl);
    return p?.lastLowPrice ?? p?.avg24hPrice ?? 0;
  };

  const out: HeatPoint[] = [];
  for (const r of rows) {
    const pool = (r.pool ?? []) as LootPoolEntry[];
    let sum = 0;
    for (const it of pool) sum += it.prob * price(it.tpl);
    const ev = (r.probability ?? 0) * sum;
    if (ev > 0) out.push({ x: r.x, z: r.z, ev });
  }
  return out;
}

/** Пулы контейнеров per-ТИП карты: containerTpl → {eCount, pool}. Позиции — из наших маркеров (см. ниже). */
export async function getLootContainerPools(mapId: string): Promise<Map<string, { eCount: number; pool: LootPoolEntry[] }>> {
  const gameId = await eftGameId();
  const rows = await db
    .select({ containerTpl: lootContainerPools.containerTpl, eCount: lootContainerPools.eCount, pool: lootContainerPools.pool })
    .from(lootContainerPools)
    .where(and(eq(lootContainerPools.gameId, gameId), eq(lootContainerPools.mapId, mapId)));
  const m = new Map<string, { eCount: number; pool: LootPoolEntry[] }>();
  for (const r of rows) m.set(r.containerTpl, { eCount: r.eCount, pool: (r.pool ?? []) as LootPoolEntry[] });
  return m;
}

// Container-маркер: позиция из tarkov.dev + linkedItemId (== containerTpl). Тип структурный (без связи с UI-типом).
type ContainerMarkerLike = { type: string; position: { x: number; y: number; z: number } | null; linkedItemId?: string | null };

/** EV-точки контейнеров: позиция из НАШИХ маркеров × пул типа (SPT). Джойн по linkedItemId == containerTpl. */
export function containerHeatPoints(
  markers: ContainerMarkerLike[],
  pools: Map<string, { eCount: number; pool: LootPoolEntry[] }>,
  priceIndex: PriceLike,
): HeatPoint[] {
  const price = (tpl: string) => {
    const p = priceIndex.get(tpl);
    return p?.lastLowPrice ?? p?.avg24hPrice ?? 0;
  };
  const out: HeatPoint[] = [];
  for (const m of markers) {
    if (!m.position || !m.linkedItemId) continue;
    if (m.type !== "container" && m.type !== "loot_container") continue;
    const cp = pools.get(m.linkedItemId);
    if (!cp) continue;
    let sum = 0;
    for (const it of cp.pool) sum += it.prob * price(it.tpl);
    const ev = cp.eCount * sum; // ожидаемое число предметов × ожидаемая ценность предмета
    if (ev > 0) out.push({ x: m.position.x, z: m.position.z, ev });
  }
  return out;
}
