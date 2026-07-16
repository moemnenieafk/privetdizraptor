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
import { items, itemChangeState, itemChanges, changeDigests, traderOfferState, craftState, questState } from "./schema";
import { eftGameId } from "./eft";
import { getEftItemStats } from "../lib/eft-item-stats";
import { getTraderOffers, traderNameById, type CostReq } from "../lib/spt-traders";
import { getHideoutRecipes, type HideoutRecipe, type CraftInput } from "../lib/spt-hideout";
import { getQuestSnapshots, type QuestRewardItem, type QuestStanding } from "../lib/spt-quests";

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
  /** 'stat' — статы предмета, 'trader' — оффер торговца. */
  category: 'stat' | 'trader' | 'craft' | 'quest';
  /** Для 'trader' — имя торговца. */
  scope: string | null;
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

function asCategory(v: string): 'stat' | 'trader' | 'craft' | 'quest' {
  return v === "trader" || v === "craft" || v === "quest" ? v : "stat";
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
        category: asCategory(r.category),
        scope: r.scope,
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

/* ───────────────── детект изменений офферов торговцев (SPT-дифф) ───────────────── */

// Валюты EFT: tpl → символ. Одиночное денежное требование → «цена», иначе → «бартер».
const CURRENCY: Record<string, string> = {
  "5449016a4bdc2d6f028b456f": "₽",
  "5696686a4bdc2da3298b456a": "$",
  "569668774bdc2da2298b4568": "€",
};

const normCost = (cost: CostReq[]): string =>
  [...cost].sort((a, b) => a.tpl.localeCompare(b.tpl)).map((c) => `${c.tpl}:${c.count}`).join(",");

const fpOf = (loyalty: number | null, cost: CostReq[]): string => `L${loyalty ?? "-"}|${normCost(cost)}`;

function parseFp(fp: string): { loyalty: string; cost: CostReq[] } {
  const [lPart, cPart = ""] = fp.split("|");
  const cost = cPart.length
    ? cPart.split(",").map((s) => {
        const [tpl, count] = s.split(":");
        return { tpl, count: Number(count) || 0 };
      })
    : [];
  return { loyalty: lPart.replace(/^L/, ""), cost };
}

type NameMap = Map<string, { name: string; short: string | null }>;

function humanCost(cost: CostReq[], names: NameMap): string {
  if (cost.length === 0) return "—";
  const first = cost[0];
  if (cost.length === 1 && CURRENCY[first.tpl]) {
    return `${first.count.toLocaleString("ru-RU")} ${CURRENCY[first.tpl]}`;
  }
  const parts = cost.map((c) => {
    const n = names.get(c.tpl);
    return `${c.count}× ${n?.short?.trim() || n?.name || "?"}`;
  });
  return `бартер: ${parts.join(", ")}`;
}

/**
 * Диффает офферы торговцев (SPT) со снимком trader_offer_state, пишет дельты в
 * item_changes (category='trader'). Первый прогон = базлайн. Пустой срез → бросаем.
 */
export async function detectTraderChanges(): Promise<DetectResult> {
  const gameId = await eftGameId();

  const assorts = await getTraderOffers();
  const totalOffers = [...assorts.values()].reduce((s, a) => s + a.offers.size, 0);
  if (totalOffers === 0) {
    throw new Error("SPT отдал пустые ассорты — детект торговцев отменён (снимок сохранён)");
  }

  const itemRows = await db
    .select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName })
    .from(items)
    .where(eq(items.gameId, gameId));
  const names: NameMap = new Map(itemRows.map((r) => [r.inGameId, { name: r.name, short: r.shortName }]));
  const nameOf = (tpl: string): string => names.get(tpl)?.name ?? tpl;
  const shortOf = (tpl: string): string | null => names.get(tpl)?.short ?? null;

  interface Cur {
    traderId: string;
    nameRu: string;
    tpl: string;
    loyalty: number | null;
    cost: CostReq[];
    fp: string;
  }
  const current = new Map<string, Cur>();
  for (const [traderId, a] of assorts) {
    for (const [tpl, off] of a.offers) {
      current.set(`${traderId}::${tpl}`, {
        traderId,
        nameRu: a.nameRu,
        tpl,
        loyalty: off.loyalty,
        cost: off.cost,
        fp: fpOf(off.loyalty, off.cost),
      });
    }
  }

  const priorRows = await db
    .select({ traderId: traderOfferState.traderId, tpl: traderOfferState.tpl, fingerprint: traderOfferState.fingerprint })
    .from(traderOfferState)
    .where(eq(traderOfferState.gameId, gameId));
  const prior = new Map(priorRows.map((p) => [`${p.traderId}::${p.tpl}`, p.fingerprint]));

  const baseline = prior.size === 0;
  let changeRows: (typeof itemChanges.$inferInsert)[] = [];

  if (!baseline) {
    for (const [key, cur] of current) {
      const prevFp = prior.get(key);
      if (prevFp === undefined) {
        changeRows.push({
          gameId, inGameId: cur.tpl, name: nameOf(cur.tpl), shortName: shortOf(cur.tpl),
          kind: "added", category: "trader", scope: cur.nameRu,
        });
        continue;
      }
      if (prevFp === cur.fp) continue;

      const prev = parseFp(prevFp);
      const newLoy = cur.loyalty === null ? "-" : String(cur.loyalty);
      if (prev.loyalty !== newLoy) {
        changeRows.push({
          gameId, inGameId: cur.tpl, name: nameOf(cur.tpl), shortName: shortOf(cur.tpl),
          kind: "field", category: "trader", scope: cur.nameRu, field: "Уровень лояльности",
          oldValue: prev.loyalty === "-" ? "—" : `ур. ${prev.loyalty}`,
          newValue: cur.loyalty === null ? "—" : `ур. ${cur.loyalty}`,
        });
      }
      if (normCost(prev.cost) !== normCost(cur.cost)) {
        const bothMoney = Boolean(
          prev.cost.length === 1 && CURRENCY[prev.cost[0].tpl] &&
          cur.cost.length === 1 && CURRENCY[cur.cost[0].tpl],
        );
        changeRows.push({
          gameId, inGameId: cur.tpl, name: nameOf(cur.tpl), shortName: shortOf(cur.tpl),
          kind: "field", category: "trader", scope: cur.nameRu, field: bothMoney ? "Цена" : "Бартер",
          oldValue: humanCost(prev.cost, names), newValue: humanCost(cur.cost, names),
        });
      }
    }
    for (const key of prior.keys()) {
      if (!current.has(key)) {
        const [traderId, tpl] = key.split("::");
        changeRows.push({
          gameId, inGameId: tpl, name: nameOf(tpl), shortName: shortOf(tpl),
          kind: "removed", category: "trader", scope: assorts.get(traderId)?.nameRu ?? traderId,
        });
      }
    }
  }

  const recalibrated =
    !baseline && (changeRows.length > RECAL_ABS || changeRows.length > current.size * RECAL_RATIO);
  if (recalibrated) changeRows = [];

  const CHUNK = 500;
  for (let i = 0; i < changeRows.length; i += CHUNK) {
    await db.insert(itemChanges).values(changeRows.slice(i, i + CHUNK));
  }

  const stateRows = [...current.values()].map((c) => ({
    gameId, traderId: c.traderId, tpl: c.tpl, fingerprint: c.fp,
  }));
  for (let i = 0; i < stateRows.length; i += CHUNK) {
    await db
      .insert(traderOfferState)
      .values(stateRows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [traderOfferState.gameId, traderOfferState.traderId, traderOfferState.tpl],
        set: { fingerprint: sql`excluded.fingerprint`, updatedAt: sql`now()` },
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

/* ───────────────── детект изменений крафтов убежища (SPT-дифф) ───────────────── */

// areaType (enum SPT/BSG) → русское имя зоны.
const AREA_NAMES: Record<number, string> = {
  0: "Вентиляция", 1: "Пункт охраны", 2: "Санузел", 3: "Тайник", 4: "Генератор",
  5: "Отопление", 6: "Сборник воды", 7: "Медблок", 8: "Кухня", 9: "Зона отдыха",
  10: "Верстак", 11: "Разведцентр", 12: "Тир", 13: "Библиотека", 14: "Скав-кейс",
  15: "Освещение", 16: "Зал славы", 17: "Очистка воздуха", 18: "Солнечная батарея",
  19: "Самогонный аппарат", 20: "Bitcoin-ферма", 21: "Ёлка", 22: "Аварийная стена",
  23: "Спортзал", 24: "Стойка оружия",
};
const areaName = (t: number): string => AREA_NAMES[t] ?? `Зона #${t}`;

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h && m) return `${h}ч ${m}м`;
  if (h) return `${h}ч`;
  return `${m}м`;
}

const inputsNorm = (inp: CraftInput[]): string =>
  [...inp].sort((a, b) => a.tpl.localeCompare(b.tpl)).map((i) => `${i.tpl}:${i.count}`).join(",");

function humanItems(inp: CraftInput[], names: NameMap): string {
  if (inp.length === 0) return "—";
  return inp
    .map((i) => {
      const n = names.get(i.tpl);
      return `${i.count}× ${n?.short?.trim() || n?.name || "?"}`;
    })
    .join(", ");
}

const craftFp = (r: HideoutRecipe): string =>
  `p${r.endProduct}|c${r.count}|t${r.productionTime}|a${r.areaLevel ?? "-"}|${inputsNorm(r.inputs)}`;

interface ParsedCraftFp {
  endProduct: string;
  count: string;
  time: string;
  area: string;
  inputs: CraftInput[];
}
function parseCraftFp(fp: string): ParsedCraftFp {
  const parts = fp.split("|");
  const get = (pfx: string, i: number): string => (parts[i] ?? "").replace(new RegExp(`^${pfx}`), "");
  const inpStr = parts[4] ?? "";
  const inputs: CraftInput[] = inpStr.length
    ? inpStr.split(",").map((s) => {
        const [tpl, count] = s.split(":");
        return { tpl, count: Number(count) || 0 };
      })
    : [];
  return { endProduct: get("p", 0), count: get("c", 1), time: get("t", 2), area: get("a", 3), inputs };
}

/**
 * Диффает крафты убежища (SPT) со снимком craft_state, пишет дельты в item_changes
 * (category='craft'). Первый прогон = базлайн. Пустой срез → бросаем.
 */
export async function detectCraftChanges(): Promise<DetectResult> {
  const gameId = await eftGameId();

  const recipes = await getHideoutRecipes();
  if (recipes.length === 0) {
    throw new Error("SPT отдал пустые крафты — детект убежища отменён (снимок сохранён)");
  }

  const itemRows = await db
    .select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName })
    .from(items)
    .where(eq(items.gameId, gameId));
  const names: NameMap = new Map(itemRows.map((r) => [r.inGameId, { name: r.name, short: r.shortName }]));
  const nameOf = (tpl: string): string => names.get(tpl)?.name ?? tpl;
  const shortOf = (tpl: string): string | null => names.get(tpl)?.short ?? null;

  const current = new Map<string, HideoutRecipe & { fp: string }>();
  for (const r of recipes) current.set(r.recipeId, { ...r, fp: craftFp(r) });

  const priorRows = await db
    .select({ recipeId: craftState.recipeId, fingerprint: craftState.fingerprint })
    .from(craftState)
    .where(eq(craftState.gameId, gameId));
  const prior = new Map(priorRows.map((p) => [p.recipeId, p.fingerprint]));

  const baseline = prior.size === 0;
  let changeRows: (typeof itemChanges.$inferInsert)[] = [];

  if (!baseline) {
    for (const [id, cur] of current) {
      const prevFp = prior.get(id);
      const scope = areaName(cur.areaType);
      const name = nameOf(cur.endProduct);
      const short = shortOf(cur.endProduct);
      const base = { gameId, inGameId: cur.endProduct, name, shortName: short, category: "craft" as const, scope };

      if (prevFp === undefined) {
        changeRows.push({ ...base, kind: "added" });
        continue;
      }
      if (prevFp === cur.fp) continue;

      const prev = parseCraftFp(prevFp);
      if (prev.count !== String(cur.count)) {
        changeRows.push({ ...base, kind: "field", field: "Выход", oldValue: prev.count, newValue: String(cur.count) });
      }
      if (prev.time !== String(cur.productionTime)) {
        changeRows.push({ ...base, kind: "field", field: "Время", oldValue: fmtTime(Number(prev.time) || 0), newValue: fmtTime(cur.productionTime) });
      }
      const curArea = cur.areaLevel === null ? "-" : String(cur.areaLevel);
      if (prev.area !== curArea) {
        changeRows.push({ ...base, kind: "field", field: "Уровень зоны", oldValue: prev.area === "-" ? "—" : `ур. ${prev.area}`, newValue: cur.areaLevel === null ? "—" : `ур. ${cur.areaLevel}` });
      }
      if (inputsNorm(prev.inputs) !== inputsNorm(cur.inputs)) {
        changeRows.push({ ...base, kind: "field", field: "Требования", oldValue: humanItems(prev.inputs, names), newValue: humanItems(cur.inputs, names) });
      }
    }
    for (const id of prior.keys()) {
      if (!current.has(id)) {
        const prev = parseCraftFp(prior.get(id) ?? "");
        changeRows.push({
          gameId, inGameId: prev.endProduct, name: nameOf(prev.endProduct), shortName: shortOf(prev.endProduct),
          kind: "removed", category: "craft", scope: "Убежище",
        });
      }
    }
  }

  const recalibrated =
    !baseline && (changeRows.length > RECAL_ABS || changeRows.length > current.size * RECAL_RATIO);
  if (recalibrated) changeRows = [];

  const CHUNK = 500;
  for (let i = 0; i < changeRows.length; i += CHUNK) {
    await db.insert(itemChanges).values(changeRows.slice(i, i + CHUNK));
  }

  const stateRows = [...current.values()].map((c) => ({ gameId, recipeId: c.recipeId, fingerprint: c.fp }));
  for (let i = 0; i < stateRows.length; i += CHUNK) {
    await db
      .insert(craftState)
      .values(stateRows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [craftState.gameId, craftState.recipeId],
        set: { fingerprint: sql`excluded.fingerprint`, updatedAt: sql`now()` },
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

/* ───────────────── детект изменений квестов (SPT + tarkov.dev) ───────────────── */

const questItemsNorm = (it: QuestRewardItem[]): string =>
  [...it].sort((a, b) => a.tpl.localeCompare(b.tpl)).map((i) => `${i.tpl}:${i.count}`).join(",");
const standingNorm = (st: QuestStanding[]): string =>
  [...st].sort((a, b) => a.traderId.localeCompare(b.traderId)).map((s) => `${s.traderId}:${s.value.toFixed(2)}`).join(",");

function humanStanding(st: QuestStanding[]): string {
  if (st.length === 0) return "—";
  return st.map((s) => `${traderNameById(s.traderId)} ${s.value >= 0 ? "+" : ""}${s.value.toFixed(2)}`).join(", ");
}

interface ParsedQuestFp {
  xp: number;
  items: QuestRewardItem[];
  standing: QuestStanding[];
  obj: number;
  objHash: string;
  prereqs: number;
}
function parseQuestFp(fp: string): ParsedQuestFp {
  const parts = fp.split("|");
  const strip = (pfx: string, i: number): string => (parts[i] ?? "").replace(new RegExp(`^${pfx}`), "");
  const itStr = strip("it", 1);
  const stStr = strip("st", 2);
  const obStr = strip("ob", 3);
  const [obCount, objHash = ""] = obStr.split("#");
  return {
    xp: Number(strip("xp", 0)) || 0,
    items: itStr.length ? itStr.split(",").map((x) => { const [tpl, c] = x.split(":"); return { tpl, count: Number(c) || 0 }; }) : [],
    standing: stStr.length ? stStr.split(",").map((x) => { const [tid, v] = x.split(":"); return { traderId: tid, value: Number(v) || 0 }; }) : [],
    obj: Number(obCount) || 0,
    objHash,
    prereqs: Number(strip("pr", 4)) || 0,
  };
}

/**
 * Диффает квесты (SPT + RU-имена tarkov.dev) со снимком quest_state, пишет дельты в
 * item_changes (category='quest'). Первый прогон = базлайн. Пустой срез → бросаем.
 */
export async function detectQuestChanges(): Promise<DetectResult> {
  const gameId = await eftGameId();

  const quests = await getQuestSnapshots();
  if (quests.length === 0) {
    throw new Error("Пустой срез квестов — детект отменён (снимок сохранён)");
  }

  const itemRows = await db
    .select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName })
    .from(items)
    .where(eq(items.gameId, gameId));
  const names: NameMap = new Map(itemRows.map((r) => [r.inGameId, { name: r.name, short: r.shortName }]));

  const fpOfQuest = (q: (typeof quests)[number]): string =>
    `xp${q.xp}|it${questItemsNorm(q.items)}|st${standingNorm(q.standing)}|ob${q.objectives}#${q.objHash}|pr${q.prereqs}`;

  const current = new Map<string, (typeof quests)[number] & { fp: string }>();
  for (const q of quests) current.set(q.questId, { ...q, fp: fpOfQuest(q) });

  const priorRows = await db
    .select({ questId: questState.questId, name: questState.name, fingerprint: questState.fingerprint })
    .from(questState)
    .where(eq(questState.gameId, gameId));
  const prior = new Map(priorRows.map((p) => [p.questId, { name: p.name, fp: p.fingerprint }]));

  const baseline = prior.size === 0;
  let changeRows: (typeof itemChanges.$inferInsert)[] = [];

  if (!baseline) {
    for (const [id, cur] of current) {
      const prev = prior.get(id);
      const scope = traderNameById(cur.traderId);
      const base = { gameId, inGameId: id, name: cur.name, shortName: null, category: "quest" as const, scope };
      if (!prev) {
        changeRows.push({ ...base, kind: "added" });
        continue;
      }
      if (prev.fp === cur.fp) continue;
      const p = parseQuestFp(prev.fp);
      if (p.xp !== cur.xp) {
        changeRows.push({ ...base, kind: "field", field: "Опыт", oldValue: p.xp.toLocaleString("ru-RU"), newValue: cur.xp.toLocaleString("ru-RU") });
      }
      if (questItemsNorm(p.items) !== questItemsNorm(cur.items)) {
        changeRows.push({ ...base, kind: "field", field: "Награда-предметы", oldValue: humanItems(p.items, names), newValue: humanItems(cur.items, names) });
      }
      if (standingNorm(p.standing) !== standingNorm(cur.standing)) {
        changeRows.push({ ...base, kind: "field", field: "Репутация", oldValue: humanStanding(p.standing), newValue: humanStanding(cur.standing) });
      }
      if (p.obj !== cur.objectives) {
        changeRows.push({ ...base, kind: "field", field: "Цели", oldValue: `${p.obj} усл.`, newValue: `${cur.objectives} усл.` });
      } else if (p.objHash !== cur.objHash) {
        changeRows.push({ ...base, kind: "field", field: "Цели", oldValue: "прежние", newValue: "условия изменены" });
      }
      if (p.prereqs !== cur.prereqs) {
        changeRows.push({ ...base, kind: "field", field: "Требования к старту", oldValue: `${p.prereqs} усл.`, newValue: `${cur.prereqs} усл.` });
      }
    }
    for (const [id, prev] of prior) {
      if (!current.has(id)) {
        changeRows.push({ gameId, inGameId: id, name: prev.name, shortName: null, kind: "removed", category: "quest", scope: "Квесты" });
      }
    }
  }

  const recalibrated =
    !baseline && (changeRows.length > RECAL_ABS || changeRows.length > current.size * RECAL_RATIO);
  if (recalibrated) changeRows = [];

  const CHUNK = 500;
  for (let i = 0; i < changeRows.length; i += CHUNK) {
    await db.insert(itemChanges).values(changeRows.slice(i, i + CHUNK));
  }

  const stateRows = [...current.values()].map((c) => ({ gameId, questId: c.questId, name: c.name, fingerprint: c.fp }));
  for (let i = 0; i < stateRows.length; i += CHUNK) {
    await db
      .insert(questState)
      .values(stateRows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [questState.gameId, questState.questId],
        set: { name: sql`excluded.name`, fingerprint: sql`excluded.fingerprint`, updatedAt: sql`now()` },
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

/* ───────────────── чтение изменений по предмету (для плашек в разделах) ───────────────── */

export interface ItemChangeEntry {
  date: string; // ISO день
  category: 'stat' | 'trader' | 'craft';
  scope: string | null;
  kind: ChangeKind;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
}

/**
 * Недавние изменения конкретного предмета (по inGameId): статы + офферы торговцев +
 * крафты, где он фигурирует. Квесты не item-keyed → сюда не попадают. НЕ бросает → [].
 */
export async function getItemChanges(inGameId: string, limit = 8): Promise<ItemChangeEntry[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db
      .select()
      .from(itemChanges)
      .where(and(eq(itemChanges.gameId, gameId), eq(itemChanges.inGameId, inGameId)))
      .orderBy(desc(itemChanges.detectedAt))
      .limit(limit);
    return rows
      .filter((r) => r.category !== 'quest')
      .map((r) => ({
        date: r.detectedAt.toISOString().slice(0, 10),
        category: (r.category === 'trader' ? 'trader' : r.category === 'craft' ? 'craft' : 'stat') as 'stat' | 'trader' | 'craft',
        scope: r.scope,
        kind: asKind(r.kind),
        field: r.field,
        oldValue: r.oldValue,
        newValue: r.newValue,
      }));
  } catch (e) {
    console.warn('[game-changes] изменения предмета недоступны:', e instanceof Error ? e.message : e);
    return [];
  }
}
