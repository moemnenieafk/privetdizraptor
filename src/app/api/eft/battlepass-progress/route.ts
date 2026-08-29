// GET/PUT /api/eft/battlepass-progress — прогресс трекера Боевого Пропуска (слой 4e).
// Пользователь берётся ТОЛЬКО из сессии Supabase (никогда из тела запроса).
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { battlePassProgress } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { createClient } from "@/lib/supabase/server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import type { BattlePassProgressPayload } from "@/lib/cta-api";

export const runtime = "nodejs";

const EMPTY: BattlePassProgressPayload = { claimed: {}, docCounts: {} };

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

// Капы под форму useBattlePassStore (несколько сезонов × награды/типы документов).
const MAX_SLUGS = 20;
const MAX_IDS = 500;
const MAX_TYPES = 32;
const KEY_CAP = 64;
const clampCount = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(0, Math.floor(v)), 1_000_000) : 0;

// claimed: slug сезона → id[] полученных наград.
function parseClaimed(v: unknown): Record<string, string[]> | null {
  if (!isObject(v)) return null;
  const out: Record<string, string[]> = {};
  for (const slug of Object.keys(v).slice(0, MAX_SLUGS)) {
    const ids = v[slug];
    if (!isStringArray(ids)) return null;
    out[slug.slice(0, KEY_CAP)] = Array.from(new Set(ids)).filter((s) => s.length <= KEY_CAP).slice(0, MAX_IDS);
  }
  return out;
}

// docCounts: slug сезона → (тип документа → собрано).
function parseDocCounts(v: unknown): Record<string, Record<string, number>> | null {
  if (!isObject(v)) return null;
  const out: Record<string, Record<string, number>> = {};
  for (const slug of Object.keys(v).slice(0, MAX_SLUGS)) {
    const inner = v[slug];
    if (!isObject(inner)) return null;
    const row: Record<string, number> = {};
    for (const t of Object.keys(inner).slice(0, MAX_TYPES)) {
      row[t.slice(0, KEY_CAP)] = clampCount(inner[t]);
    }
    out[slug.slice(0, KEY_CAP)] = row;
  }
  return out;
}

function parsePayload(body: unknown): BattlePassProgressPayload | null {
  if (!isObject(body)) return null;
  const claimed = parseClaimed(body.claimed);
  const docCounts = parseDocCounts(body.docCounts);
  if (!claimed || !docCounts) return null;
  return { claimed, docCounts };
}

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const gameId = await eftGameId();
  const [row] = await db
    .select({ claimed: battlePassProgress.claimed, docCounts: battlePassProgress.docCounts })
    .from(battlePassProgress)
    .where(and(eq(battlePassProgress.userId, userId), eq(battlePassProgress.gameId, gameId)))
    .limit(1);

  return NextResponse.json(row ?? EMPTY);
}

export async function PUT(req: Request): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (bodyTooLarge(req, JSON_BODY_CAP)) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const payload = parsePayload(body);
  if (!payload) return NextResponse.json({ error: "bad payload" }, { status: 422 });

  const gameId = await eftGameId();
  await db
    .insert(battlePassProgress)
    .values({ userId, gameId, ...payload })
    .onConflictDoUpdate({
      target: [battlePassProgress.userId, battlePassProgress.gameId],
      set: { claimed: payload.claimed, docCounts: payload.docCounts, updatedAt: sql`now()` },
    });

  return NextResponse.json({ ok: true });
}
