// Дифф-движок «что реально изменилось в игре». Источник ТЕКУЩЕГО среза — живой
// tarkov.dev (getEftItemStats), т.к. наши items/item_properties наполняются вручную
// (db:etl) и не двигаются. Сравниваем свежий срез с прошлым снимком (item_change_state)
// и пишем дельты в item_changes. Гоняется кроном /api/cron/sync-game-changes.
//
// Трекаем только ИГРОВЫЕ поля (меняются патчами): вес, базовая цена, сетка, статы
// оружия/аммо/брони/контейнеров. Флиа-цены НЕ трекаем — это рынок, не игра.
//
// Диффим ТОЛЬКО по полям, присутствующим в ОБОИХ срезах: разница «поле появилось/
// пропало» — это чаще шум источника, а не изменение игры. Так первый прогон после
// смены источника даёт реальные правки статов, а не стену «field added».
//
// Импорты относительные (не @/) — модуль может грузиться и под tsx-скриптом.
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./index";
import { itemChangeState, itemChanges, changeDigests } from "./schema";
import { eftGameId } from "./eft";
import { getEftItemStats } from "../lib/eft-item-stats";

// Массовый сдвиг = рекалибровка (смена/пересбор источника), не патч. Тогда дельты не
// пишем, только освежаем снимок. Реальный патч трогает статы десятков–сотен предметов.
const RECAL_ABS = 800;
const RECAL_RATIO = 0.25;

export interface DetectResult {
  baseline: boolean;
  recalibrated: boolean;
  scanned: number;
  added: number;
  removed: number;
  fieldChanges: number;
}

/**
 * Снимает живой срез статов, диффает с прошлым снимком, пишет дельты.
 * Первый прогон / пустой снимок = базлайн: дельты не пишем, только сеем снимок.
 * Пустой срез из tarkov.dev → бросаем (нельзя занулять снимок и городить «removed» на всё).
 */
export async function detectGameChanges(): Promise<DetectResult> {
  const gameId = await eftGameId();

  const current = await getEftItemStats();
  if (current.size === 0) {
    throw new Error("tarkov.dev отдал пустой срез статов — детект отменён (снимок сохранён)");
  }

  const priorRows = await db
    .select({
      inGameId: itemChangeState.inGameId,
      name: itemChangeState.name,
      fingerprint: itemChangeState.fingerprint,
    })
    .from(itemChangeState)
    .where(eq(itemChangeState.gameId, gameId));
  const prior = new Map(priorRows.map((p) => [p.inGameId, { name: p.name, fp: p.fingerprint }]));

  const baseline = prior.size === 0;
  let changeRows: (typeof itemChanges.$inferInsert)[] = [];

  if (!baseline) {
    for (const [id, cur] of current) {
      const prev = prior.get(id);
      if (!prev) {
        changeRows.push({ gameId, inGameId: id, name: cur.name, shortName: cur.shortName, kind: "added" });
        continue;
      }
      // только по полям, что есть в ОБОИХ срезах, и только при реальном изменении значения
      const keys = new Set([...Object.keys(prev.fp), ...Object.keys(cur.fingerprint)]);
      for (const k of keys) {
        const oldV = prev.fp[k];
        const newV = cur.fingerprint[k];
        if (oldV !== undefined && newV !== undefined && oldV !== newV) {
          changeRows.push({
            gameId,
            inGameId: id,
            name: cur.name,
            shortName: cur.shortName,
            kind: "field",
            field: k,
            oldValue: oldV,
            newValue: newV,
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

  // Страховка: массовый сдвиг → рекалибровка (снимок освежаем, дельты не пишем).
  const recalibrated =
    !baseline && (changeRows.length > RECAL_ABS || changeRows.length > current.size * RECAL_RATIO);
  if (recalibrated) changeRows = [];

  const CHUNK = 500;
  for (let i = 0; i < changeRows.length; i += CHUNK) {
    await db.insert(itemChanges).values(changeRows.slice(i, i + CHUNK));
  }

  const stateRows = [...current.entries()].map(([inGameId, c]) => ({
    gameId,
    inGameId,
    name: c.name,
    shortName: c.shortName,
    fingerprint: c.fingerprint,
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
    recalibrated,
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


/* ───────────────── редакторские разборы срезов (change_digests) ───────────────── */

export interface ChangeDigest {
  date: string;
  noteRu: string;
  published: boolean;
}

/**
 * Разборы по дням. includeDrafts=true (админ в Draft Mode) — все, иначе только published.
 * НЕ бросает: до миграции/при сбое → пустая Map.
 */
export async function getChangeDigests(includeDrafts = false): Promise<Map<string, ChangeDigest>> {
  try {
    const gameId = await eftGameId();
    const where = includeDrafts
      ? eq(changeDigests.gameId, gameId)
      : and(eq(changeDigests.gameId, gameId), eq(changeDigests.published, true));
    const rows = await db.select().from(changeDigests).where(where);
    return new Map(rows.map((r) => [r.date, { date: r.date, noteRu: r.noteRu, published: r.published }]));
  } catch (e) {
    console.warn("[game-changes] разборы недоступны:", e instanceof Error ? e.message : e);
    return new Map();
  }
}

/** Создать/обновить разбор на день. Пишет только серверный admin-роут. */
export async function upsertChangeDigest(
  userId: string,
  date: string,
  noteRu: string,
  published: boolean,
): Promise<void> {
  const gameId = await eftGameId();
  await db
    .insert(changeDigests)
    .values({ gameId, date, noteRu, published, authorId: userId })
    .onConflictDoUpdate({
      target: [changeDigests.gameId, changeDigests.date],
      set: {
        noteRu: sql`excluded.note_ru`,
        published: sql`excluded.published`,
        authorId: sql`excluded.author_id`,
        updatedAt: sql`now()`,
      },
    });
}
