// Дифф-движок «что реально изменилось в игре». Развязан от синка предметов:
// читает ТЕКУЩЕЕ состояние items+item_properties, сравнивает с прошлым снимком-отпечатком
// (item_change_state) и пишет дельты в item_changes. Гоняется кроном /api/cron/sync-game-changes.
//
// Трекаем только ИГРОВЫЕ поля (меняются патчами): вес, базовая цена, сетка, статы
// оружия/аммо/брони/медицины/контейнеров. Флиа-цены НЕ трекаем — это рынок, не игра.
//
// Импорты относительные (не @/) — модуль может грузиться и под tsx-скриптом.
import { eq, desc, sql } from "drizzle-orm";
import { db } from "./index";
import { items, itemProperties, itemChangeState, itemChanges, type ItemProperties } from "./schema";
import { eftGameId } from "./eft";

type FpRow = {
  weight: number | null;
  basePrice: number | null;
  gridWidth: number | null;
  gridHeight: number | null;
  properties: ItemProperties | null;
};

// Плоский отпечаток: ключ → строковое значение. Диффать строки — просто и устойчиво.
function fingerprint(row: FpRow): Record<string, string> {
  const fp: Record<string, string> = {};
  const put = (k: string, v: number | string | null | undefined): void => {
    if (v !== null && v !== undefined) fp[k] = String(v);
  };
  put("weight", row.weight);
  put("basePrice", row.basePrice);
  put("gridWidth", row.gridWidth);
  put("gridHeight", row.gridHeight);

  const p = row.properties;
  if (p) {
    switch (p.type) {
      case "ammo":
        put("penetrationPower", p.penetrationPower);
        put("damage", p.damage);
        put("armorDamage", p.armorDamage);
        put("fragmentationChance", p.fragmentationChance);
        put("initialSpeed", p.initialSpeed);
        break;
      case "armor":
        put("armorClass", p.armorClass);
        put("durability", p.durability);
        put("bluntThroughput", p.bluntThroughput);
        put("ergoPenalty", p.ergoPenalty);
        put("speedPenalty", p.speedPenalty);
        put("turnPenalty", p.turnPenalty);
        break;
      case "weapon":
        put("ergonomics", p.ergonomics);
        put("recoilVertical", p.recoilVertical);
        put("recoilHorizontal", p.recoilHorizontal);
        put("fireRate", p.fireRate);
        break;
      case "container":
        put("capacity", p.capacity);
        break;
      case "medical":
        put("useTime", p.useTime);
        put("maxHpResource", p.maxHpResource);
        put("hpResourceRate", p.hpResourceRate);
        break;
    }
  }
  return fp;
}

export interface DetectResult {
  baseline: boolean;
  scanned: number;
  added: number;
  removed: number;
  fieldChanges: number;
}

/**
 * Снимает текущие игровые поля, диффает с прошлым снимком, пишет дельты.
 * Первый прогон = базлайн: дельты НЕ пишем (иначе весь каталог как «added»),
 * только сеем снимок. Со второго прогона — реальные изменения между патчами.
 */
export async function detectGameChanges(): Promise<DetectResult> {
  const gameId = await eftGameId();

  const rows = await db
    .select({
      inGameId: items.inGameId,
      name: items.name,
      shortName: items.shortName,
      weight: items.weight,
      basePrice: items.basePrice,
      gridWidth: items.gridWidth,
      gridHeight: items.gridHeight,
      properties: itemProperties.properties,
    })
    .from(items)
    .leftJoin(itemProperties, eq(itemProperties.itemId, items.id))
    .where(eq(items.gameId, gameId));

  const current = new Map<string, { name: string; shortName: string | null; fp: Record<string, string> }>();
  for (const r of rows) current.set(r.inGameId, { name: r.name, shortName: r.shortName, fp: fingerprint(r) });

  const priorRows = await db
    .select({ inGameId: itemChangeState.inGameId, name: itemChangeState.name, fingerprint: itemChangeState.fingerprint })
    .from(itemChangeState)
    .where(eq(itemChangeState.gameId, gameId));
  const prior = new Map(priorRows.map((p) => [p.inGameId, { name: p.name, fp: p.fingerprint }]));

  const baseline = prior.size === 0;
  const changeRows: (typeof itemChanges.$inferInsert)[] = [];

  if (!baseline) {
    for (const [id, cur] of current) {
      const prev = prior.get(id);
      if (!prev) {
        changeRows.push({ gameId, inGameId: id, name: cur.name, shortName: cur.shortName, kind: "added" });
        continue;
      }
      const keys = new Set([...Object.keys(prev.fp), ...Object.keys(cur.fp)]);
      for (const k of keys) {
        const oldV = prev.fp[k];
        const newV = cur.fp[k];
        if (oldV !== newV) {
          changeRows.push({
            gameId,
            inGameId: id,
            name: cur.name,
            shortName: cur.shortName,
            kind: "field",
            field: k,
            oldValue: oldV ?? null,
            newValue: newV ?? null,
          });
        }
      }
    }
    for (const [id, prev] of prior) {
      if (!current.has(id)) {
        changeRows.push({ gameId, inGameId: id, name: prev.name, shortName: null, kind: "removed" });
      }
    }
  }

  const CHUNK = 500;
  for (let i = 0; i < changeRows.length; i += CHUNK) {
    await db.insert(itemChanges).values(changeRows.slice(i, i + CHUNK));
  }

  const stateRows = [...current.entries()].map(([inGameId, c]) => ({
    gameId,
    inGameId,
    name: c.name,
    shortName: c.shortName,
    fingerprint: c.fp,
  }));
  for (let i = 0; i < stateRows.length; i += CHUNK) {
    await db
      .insert(itemChangeState)
      .values(stateRows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [itemChangeState.gameId, itemChangeState.inGameId],
        set: {
          name: sql`excluded.name`,
          shortName: sql`excluded.short_name`,
          fingerprint: sql`excluded.fingerprint`,
          updatedAt: sql`now()`,
        },
      });
  }

  return {
    baseline,
    scanned: current.size,
    added: changeRows.filter((c) => c.kind === "added").length,
    removed: changeRows.filter((c) => c.kind === "removed").length,
    fieldChanges: changeRows.filter((c) => c.kind === "field").length,
  };
}

/* ───────────────── чтение для UI ───────────────── */

export type ChangeKind = "added" | "removed" | "field";

export interface GameChange {
  name: string;
  shortName: string | null;
  kind: ChangeKind;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
}

export interface Changeset {
  /** День обнаружения, ISO (YYYY-MM-DD) — ключ группировки. */
  date: string;
  /** Всего изменений в этот день (до обрезки списка). */
  total: number;
  changes: GameChange[];
}

function asKind(v: string): ChangeKind {
  return v === "added" || v === "removed" ? v : "field";
}

/**
 * Последние чейнджсеты, сгруппированные по дню обнаружения (свежие сверху).
 * НЕ бросает: до миграции/при сбое → []. Страница game-updates остаётся живой.
 */
export async function getRecentChangesets(maxChangesets = 6, perSet = 80): Promise<Changeset[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db
      .select()
      .from(itemChanges)
      .where(eq(itemChanges.gameId, gameId))
      .orderBy(desc(itemChanges.detectedAt))
      .limit(3000);

    const byDay = new Map<string, GameChange[]>();
    const order: string[] = [];
    for (const r of rows) {
      const day = r.detectedAt.toISOString().slice(0, 10);
      let arr = byDay.get(day);
      if (!arr) {
        arr = [];
        byDay.set(day, arr);
        order.push(day);
      }
      arr.push({
        name: r.name,
        shortName: r.shortName,
        kind: asKind(r.kind),
        field: r.field,
        oldValue: r.oldValue,
        newValue: r.newValue,
      });
    }

    return order.slice(0, maxChangesets).map((day) => {
      const all = byDay.get(day) ?? [];
      return { date: day, total: all.length, changes: all.slice(0, perSet) };
    });
  } catch (e) {
    console.warn("[game-changes] журнал недоступен:", e instanceof Error ? e.message : e);
    return [];
  }
}
