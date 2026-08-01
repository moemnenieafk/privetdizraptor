// Ингест loot-таблиц EFT из файлов SPT в зеркало (loot_spawns + loot_container_pools).
// Источник = ЛОКАЛЬНАЯ установка SPT (файлы на диске), не крон. Запуск: `npm run db:ingest-loot`.
// EV не хранится — считается на рендере (цена из `prices`). Решение: docs/decisions/heatmap-loot-ev-dataset.md.
//
// Относительные импорты — модуль должен идти под `tsx` (см. cta-backend gotcha).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { games, maps, lootSpawns, lootContainerPools, type LootPoolEntry } from "./schema";

// SPT location-ключ (папка) → наш slug (maps.normalizedName). Неизвестные/дубли-варианты скипаем.
// factory4_night = дубль факта day; sandbox_high = дубль GZ; develop/hideout/privatearea/terminal/town/suburbs — скип.
const SPT_KEY_TO_SLUG: Record<string, string> = {
  bigmap: "customs",
  factory4_day: "factory",
  interchange: "interchange",
  laboratory: "the-lab",
  lighthouse: "lighthouse",
  rezervbase: "reserve",
  sandbox: "ground-zero",
  shoreline: "shoreline",
  tarkovstreets: "streets-of-tarkov",
  woods: "woods",
  labyrinth: "the-labyrinth",
};

const DEFAULT_SPT = process.env.SPT_DB_PATH ?? "D:/Games/SPT/SPT/SPT_Data/database";

interface NormPoint { x: number; y: number | null; z: number; probability: number; pool: LootPoolEntry[] }
interface NormPool { containerTpl: string; eCount: number; pool: LootPoolEntry[] }

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

// looseLoot.json → точки. Пул из itemDistribution (composedKey→_tpl по Items), веса нормируем.
function normLoose(ll: any): NormPoint[] {
  const out: NormPoint[] = [];
  for (const s of ll.spawnpoints ?? []) {
    const items = s.template?.Items ?? [];
    const keyToTpl = new Map<string, string>();
    for (const it of items) {
      const k = it.composedKey != null ? String(it.composedKey) : null;
      if (k && !keyToTpl.has(k)) keyToTpl.set(k, it._tpl);
    }
    const dist = s.itemDistribution ?? [];
    const sum = dist.reduce((a: number, d: any) => a + (d.relativeProbability || 0), 0) || 1;
    const pool = dist
      .map((d: any) => ({ tpl: keyToTpl.get(String(d.composedKey?.key)) as string, prob: (d.relativeProbability || 0) / sum }))
      .filter((p: LootPoolEntry) => !!p.tpl);
    const pos = s.template?.Position ?? {};
    if (pos.x == null || pos.z == null || !pool.length) continue;
    out.push({ x: pos.x, y: pos.y ?? null, z: pos.z, probability: s.probability ?? 0, pool });
  }
  return out;
}

// staticLoot.json (per-тип) → пулы контейнеров. eCount из itemcountDistribution.
function normContainerPools(sl: any): NormPool[] {
  const out: NormPool[] = [];
  for (const [tpl, typ] of Object.entries<any>(sl ?? {})) {
    const dist = typ.itemDistribution ?? [];
    const sum = dist.reduce((a: number, d: any) => a + (d.relativeProbability || 0), 0) || 1;
    const pool = dist.map((d: any) => ({ tpl: d.tpl as string, prob: (d.relativeProbability || 0) / sum })).filter((p: LootPoolEntry) => !!p.tpl);
    const cd = typ.itemcountDistribution ?? typ.itemCountDistribution ?? [];
    const csum = cd.reduce((a: number, d: any) => a + (d.relativeProbability || 0), 0) || 1;
    const eCount = cd.reduce((a: number, d: any) => a + (d.count || 0) * (d.relativeProbability || 0), 0) / csum || 1;
    if (pool.length) out.push({ containerTpl: tpl, eCount, pool });
  }
  return out;
}

function sptVersion(dbRoot: string): string {
  try {
    const core = readJson(path.join(dbRoot, "../configs/core.json"));
    return core.akiVersion ?? core.sptVersion ?? "spt";
  } catch { return "spt"; }
}

async function insertChunked(table: any, rows: any[], size = 500) {
  for (let i = 0; i < rows.length; i += size) await db.insert(table).values(rows.slice(i, i + size));
}

export interface IngestOpts { sptPath?: string; dryRun?: boolean }
export interface IngestStats { map: string; slug: string; loose: number; containers: number; skipped?: string }

export async function ingestLootTables(opts: IngestOpts = {}): Promise<IngestStats[]> {
  const root = opts.sptPath ?? DEFAULT_SPT;
  const locations = path.join(root, "locations");
  if (!existsSync(locations)) throw new Error(`SPT locations не найдены: ${locations} (задай SPT_DB_PATH)`);
  const version = sptVersion(root);

  const [eft] = await db.select().from(games).where(eq(games.code, "eft"));
  if (!eft) throw new Error("игра eft не найдена в БД");
  const mapRows = await db.select().from(maps);
  const idBySlug = new Map(mapRows.map((m) => [m.normalizedName, m.id]));

  const stats: IngestStats[] = [];
  for (const [sptKey, slug] of Object.entries(SPT_KEY_TO_SLUG)) {
    const mapId = idBySlug.get(slug);
    const dir = path.join(locations, sptKey);
    if (!mapId) { stats.push({ map: sptKey, slug, loose: 0, containers: 0, skipped: "нет карты в БД" }); continue; }
    if (!existsSync(path.join(dir, "looseLoot.json"))) { stats.push({ map: sptKey, slug, loose: 0, containers: 0, skipped: "нет файлов SPT" }); continue; }

    const loose = normLoose(readJson(path.join(dir, "looseLoot.json")));
    const sl = existsSync(path.join(dir, "staticLoot.json")) ? readJson(path.join(dir, "staticLoot.json")) : {};
    const pools = normContainerPools(sl);

    if (!opts.dryRun) {
      // Замена зеркала карты: удалить старое → вставить свежее.
      await db.delete(lootSpawns).where(and(eq(lootSpawns.gameId, eft.id), eq(lootSpawns.mapId, mapId)));
      await db.delete(lootContainerPools).where(and(eq(lootContainerPools.gameId, eft.id), eq(lootContainerPools.mapId, mapId)));
      await insertChunked(lootSpawns, loose.map((p) => ({ gameId: eft.id, mapId, x: p.x, y: p.y, z: p.z, probability: p.probability, pool: p.pool, sourceVersion: version })));
      await insertChunked(lootContainerPools, pools.map((c) => ({ gameId: eft.id, mapId, containerTpl: c.containerTpl, eCount: c.eCount, pool: c.pool, sourceVersion: version })));
    }
    stats.push({ map: sptKey, slug, loose: loose.length, containers: pools.length });
  }
  return stats;
}
