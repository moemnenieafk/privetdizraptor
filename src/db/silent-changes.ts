// Self-mirror «Tarkov Silent Changes» (changes.tarkov-changes.com) — тихие изменения
// серверного/клиентского конфига BSG между версиями. Источник отдаёт ТОЛЬКО HTML
// (openapi: /latest, /list, /view/{id} → text/html; JSON-API нет), поэтому парсим HTML.
// Изолируем парсер: при смене их вёрстки чиним здесь и нигде больше.
//
// §4.11: контакт с внешним источником только тут (крон/CLI), UI читает нашу БД.
// Устойчивость: пустой парс НЕ затирает last-known-good (onConflictDoNothing, пулы
// иммутабельны). Импорты относительные — модуль гоняется и под `tsx` (бэкфил-скрипт).
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { eftGameId } from "./eft";
import { items, silentChanges } from "./schema";
import { classify, extractItemId } from "../lib/silent-changes-format";

const BASE = "https://changes.tarkov-changes.com";
const UA = "CTA-portal silent-changes sync (+https://privetdizraptor.vercel.app)";

/* ───────────────────────── HTTP ───────────────────────── */

async function fetchHtml(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} от ${path}`);
  return res.text();
}

/* ───────────────────────── парсинг ───────────────────────── */

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** "Sunday, 19 July 2026 - 09:19 AM EDT" → ISO (UTC). EDT=-4, EST=-5. */
function parseEdtDate(s: string): Date | null {
  const m = s.match(
    /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*(E[DS]T)/i,
  );
  if (!m) return null;
  const [, dd, monName, yyyy, hh, mm, ap, tz] = m;
  const mon = MONTHS[monName.toLowerCase()];
  if (mon === undefined) return null;
  let hour = Number(hh) % 12;
  if (ap.toUpperCase() === "PM") hour += 12;
  const offset = tz.toUpperCase() === "EST" ? 5 : 4; // локальное → UTC (+offset часов)
  return new Date(Date.UTC(Number(yyyy), mon, Number(dd), hour + offset, Number(mm)));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}

export interface PullMeta {
  pullId: number;
  eftVersion: string;
  pulledAt: Date;
}

/** Парсит /list → метаданные пулов (свежие сверху, как на странице). */
export function parseList(html: string): PullMeta[] {
  const out: PullMeta[] = [];
  const re =
    /<a href="\/view\/(\d+)">\s*<strong>([^<]+)<\/strong>\s*-\s*([^<]+?)\s*<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const pullId = Number(m[1]);
    const eftVersion = decodeEntities(m[2]).trim();
    const pulledAt = parseEdtDate(decodeEntities(m[3]));
    if (Number.isInteger(pullId) && pulledAt) out.push({ pullId, eftVersion, pulledAt });
  }
  return out;
}

export interface ParsedDiff {
  filePath: string;
  keyPath: string;
  kind: "added" | "removed" | "field";
  oldValue: string | null;
  newValue: string | null;
}

const leadingSpaces = (s: string): number => (s.match(/^ */)?.[0].length ?? 0);
const segOf = (s: string): string => s.trim().replace(/^\[['"]?/, "").replace(/['"]?\]$/, "").trim();
const stripTags = (s: string): string => decodeEntities(s.replace(/<[^>]*>/g, ""));

/** Парсит /view/{id} → плоский список изменённых leaf-ключей по всем файлам. */
export function parseView(html: string): ParsedDiff[] {
  const out: ParsedDiff[] = [];
  // Секции по файлам: <h3>FILE</h3> ... (до следующего <h3> или конца content).
  const sectionRe = /<h3>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3>|<div style=|<\/div>\s*<\/body>|$)/g;
  let sm: RegExpExecArray | null;
  while ((sm = sectionRe.exec(html)) !== null) {
    const filePath = stripTags(sm[1]).trim();
    if (!filePath) continue;
    const body = sm[2];

    const stack: { indent: number; seg: string }[] = [];
    let curPath = "";
    let oldBuf: string | null = null;
    let newBuf: string | null = null;

    const flush = () => {
      if (oldBuf === null && newBuf === null) return;
      const kind = oldBuf !== null && newBuf !== null ? "field" : oldBuf !== null ? "removed" : "added";
      if (curPath) out.push({ filePath, keyPath: curPath, kind, oldValue: oldBuf, newValue: newBuf });
      oldBuf = null;
      newBuf = null;
    };

    const lineRe = /<div class="diff-line([^"]*)">([\s\S]*?)<\/div>/g;
    let lm: RegExpExecArray | null;
    while ((lm = lineRe.exec(body)) !== null) {
      const cls = lm[1];
      const raw = decodeEntities(lm[2].replace(/<[^>]*>/g, ""));
      if (cls.includes("diff-removed")) {
        // маркер `(Old) ` только на первой строке; продолжения — просто `-  <текст>`.
        const v = raw.replace(/^-?\s*(?:\(Old\)\s?)?/, "");
        oldBuf = oldBuf === null ? v : `${oldBuf}\n${v}`;
      } else if (cls.includes("diff-added")) {
        const v = raw.replace(/^\+?\s*(?:\(New\)\s?)?/, "");
        newBuf = newBuf === null ? v : `${newBuf}\n${v}`;
      } else {
        // сегмент пути ['...'] — новый leaf: сперва зафиксировать предыдущий.
        flush();
        const indent = leadingSpaces(raw);
        const seg = segOf(raw);
        if (!seg) continue;
        while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
        stack.push({ indent, seg });
        curPath = stack.map((s) => s.seg).join(".");
      }
    }
    flush();
  }
  return out;
}

/* ───────────────────────── синк ───────────────────────── */

export interface SyncResult {
  scannedPulls: number;
  newPulls: number;
  inserted: number;
}

async function existingPullIds(gameId: string): Promise<Set<number>> {
  const rows = await db
    .select({ pullId: silentChanges.pullId })
    .from(silentChanges)
    .where(eq(silentChanges.gameId, gameId));
  return new Set(rows.map((r) => r.pullId));
}

/** Резолвит BSG-id → имя предмета из нашего каталога (одним запросом на пул). */
async function resolveNames(gameId: string, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ inGameId: items.inGameId, name: items.name })
    .from(items)
    .where(and(eq(items.gameId, gameId), inArray(items.inGameId, ids)));
  for (const r of rows) map.set(r.inGameId.toLowerCase(), r.name);
  return map;
}

/**
 * Тянет /list, берёт НОВЫЕ пулы (до maxNewPulls, свежие сначала), парсит каждый /view
 * и заливает изменения. Пулы иммутабельны → onConflictDoNothing. Ничего не роняет:
 * ошибка отдельного пула логируется и пропускается.
 */
export async function syncSilentChanges(
  opts: { maxNewPulls?: number; delayMs?: number } = {},
): Promise<SyncResult> {
  const { maxNewPulls = 8, delayMs = 300 } = opts;
  const gameId = await eftGameId();

  const list = parseList(await fetchHtml("/list"));
  const known = await existingPullIds(gameId);
  const fresh = list.filter((p) => !known.has(p.pullId)).slice(0, maxNewPulls);

  let inserted = 0;
  for (let i = 0; i < fresh.length; i++) {
    const pull = fresh[i];
    try {
      const diffs = parseView(await fetchHtml(`/view/${pull.pullId}`));
      if (diffs.length === 0) continue;

      const ids = [...new Set(diffs.map((d) => extractItemId(d.keyPath)).filter((x): x is string => !!x))];
      const names = await resolveNames(gameId, ids);

      const rows = diffs.map((d) => {
        const inGameId = extractItemId(d.keyPath);
        return {
          gameId,
          pullId: pull.pullId,
          eftVersion: pull.eftVersion,
          pulledAt: pull.pulledAt,
          filePath: d.filePath,
          keyPath: d.keyPath,
          kind: d.kind,
          oldValue: d.oldValue,
          newValue: d.newValue,
          klass: classify(d.filePath, d.keyPath),
          inGameId,
          itemName: inGameId ? names.get(inGameId) ?? null : null,
        };
      });

      const ins = await db
        .insert(silentChanges)
        .values(rows)
        .onConflictDoNothing({
          target: [silentChanges.gameId, silentChanges.pullId, silentChanges.filePath, silentChanges.keyPath],
        })
        .returning({ id: silentChanges.id });
      inserted += ins.length;
    } catch (e) {
      console.error(`[silent-changes] пул ${pull.pullId} пропущен: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (delayMs > 0 && i + 1 < fresh.length) await new Promise((r) => setTimeout(r, delayMs));
  }

  return { scannedPulls: list.length, newPulls: fresh.length, inserted };
}

/* ───────────────────────── чтение для RSC ───────────────────────── */

export interface SilentEntry {
  filePath: string;
  keyPath: string;
  kind: "added" | "removed" | "field";
  oldValue: string | null;
  newValue: string | null;
  klass: string;
  inGameId: string | null;
  itemName: string | null;
}

export interface SilentPull {
  pullId: number;
  eftVersion: string;
  pulledAt: string; // ISO
  changes: SilentEntry[];
}

/**
 * Последние пулы тихих изменений (свежие сверху). НЕ бросает: до миграции/при сбое → [].
 * Страница game-updates остаётся живой.
 */
export async function getSilentChangesets(maxPulls = 8, perPull = 200): Promise<SilentPull[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db
      .select()
      .from(silentChanges)
      .where(eq(silentChanges.gameId, gameId))
      .orderBy(desc(silentChanges.pulledAt))
      .limit(4000);

    const byPull = new Map<number, SilentPull>();
    const order: number[] = [];
    for (const r of rows) {
      let pull = byPull.get(r.pullId);
      if (!pull) {
        pull = {
          pullId: r.pullId,
          eftVersion: r.eftVersion,
          pulledAt: r.pulledAt.toISOString(),
          changes: [],
        };
        byPull.set(r.pullId, pull);
        order.push(r.pullId);
      }
      if (pull.changes.length < perPull) {
        pull.changes.push({
          filePath: r.filePath,
          keyPath: r.keyPath,
          kind: r.kind === "added" || r.kind === "removed" ? r.kind : "field",
          oldValue: r.oldValue,
          newValue: r.newValue,
          klass: r.klass,
          inGameId: r.inGameId,
          itemName: r.itemName,
        });
      }
    }

    return order.slice(0, maxPulls).map((id) => byPull.get(id)!);
  } catch (e) {
    console.error("[silent-changes] чтение упало:", e);
    return [];
  }
}
