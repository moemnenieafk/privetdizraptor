// GET/PUT /api/eft/checkpoints — фикс-слоты прогресса текущего юзера.
// Пользователь берётся ТОЛЬКО из сессии Supabase (никогда из тела). GET — все слоты без
// тяжёлого payload; PUT — сохранить снимок в слот (0=авто, 1..3=ручной), upsert по слоту.
import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { questCheckpoints } from "@/db/schema-checkpoints";
import { eftGameId } from "@/db/eft";
import { createClient } from "@/lib/supabase/server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import type { ProgressPayload } from "@/lib/cta-api";

export const runtime = "nodejs";

const NAME_CAP = 60;
const isValidSlot = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 3;

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function parsePayload(body: unknown): ProgressPayload | null {
  if (!isObject(body)) return null;
  if (!isStringArray(body.completedQuests)) return null;
  if (!isStringArray(body.pinnedQuests)) return null;
  if (!isObject(body.itemProgress)) return null;
  if (!isObject(body.questNotes)) return null;
  return {
    completedQuests: body.completedQuests,
    pinnedQuests: body.pinnedQuests,
    itemProgress: body.itemProgress as Record<string, Record<string, number>>,
    questNotes: body.questNotes as Record<string, string>,
  };
}

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const gameId = await eftGameId();
  const slots = await db
    .select({
      slot: questCheckpoints.slot,
      name: questCheckpoints.name,
      createdAt: questCheckpoints.createdAt,
      completedCount: sql<number>`coalesce(jsonb_array_length(${questCheckpoints.payload} -> 'completedQuests'), 0)`,
    })
    .from(questCheckpoints)
    .where(and(eq(questCheckpoints.userId, userId), eq(questCheckpoints.gameId, gameId)))
    .orderBy(asc(questCheckpoints.slot));

  return NextResponse.json({ slots });
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
  if (!isObject(body)) return NextResponse.json({ error: "bad payload" }, { status: 422 });
  if (!isValidSlot(body.slot)) return NextResponse.json({ error: "bad slot" }, { status: 422 });
  const payload = parsePayload(body.payload);
  if (!payload) return NextResponse.json({ error: "bad payload" }, { status: 422 });

  const slot = body.slot;
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const fallback = slot === 0 ? "Автосохранение" : `Слот ${slot}`;
  const name = (rawName || fallback).slice(0, NAME_CAP);

  const gameId = await eftGameId();
  await db
    .insert(questCheckpoints)
    .values({ userId, gameId, slot, name, payload })
    .onConflictDoUpdate({
      target: [questCheckpoints.userId, questCheckpoints.gameId, questCheckpoints.slot],
      set: { name, payload, createdAt: sql`now()` },
    });

  return NextResponse.json({ ok: true });
}
