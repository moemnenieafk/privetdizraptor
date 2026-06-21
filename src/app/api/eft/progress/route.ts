// GET/PUT /api/eft/progress — прогресс квестов текущего пользователя (слой 4b).
// Пользователь берётся ТОЛЬКО из сессии Supabase (никогда из тела запроса).
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { questProgress } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { createClient } from "@/lib/supabase/server";
import type { ProgressPayload } from "@/lib/cta-api";

export const runtime = "nodejs";

const EMPTY: ProgressPayload = {
  completedQuests: [],
  itemProgress: {},
  pinnedQuests: [],
  questNotes: {},
};

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

export async function GET(): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const gameId = await eftGameId();
  const [row] = await db
    .select({
      completedQuests: questProgress.completedQuests,
      itemProgress: questProgress.itemProgress,
      pinnedQuests: questProgress.pinnedQuests,
      questNotes: questProgress.questNotes,
    })
    .from(questProgress)
    .where(and(eq(questProgress.userId, userId), eq(questProgress.gameId, gameId)))
    .limit(1);

  return NextResponse.json(row ?? EMPTY);
}

export async function PUT(req: Request): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
    .insert(questProgress)
    .values({ userId, gameId, ...payload })
    .onConflictDoUpdate({
      target: [questProgress.userId, questProgress.gameId],
      set: {
        completedQuests: payload.completedQuests,
        itemProgress: payload.itemProgress,
        pinnedQuests: payload.pinnedQuests,
        questNotes: payload.questNotes,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}
