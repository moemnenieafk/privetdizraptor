// GET/PUT /api/eft/achievement-progress — трекинг достижений текущего пользователя (Фаза 2).
// Пользователь берётся ТОЛЬКО из сессии Supabase (никогда из тела запроса).
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { achievementProgress } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { createClient } from "@/lib/supabase/server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import type { AchievementProgressPayload } from "@/lib/cta-api";

export const runtime = "nodejs";

const EMPTY: AchievementProgressPayload = {
  completedIds: [],
  trackedIds: [],
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

function parsePayload(body: unknown): AchievementProgressPayload | null {
  if (!isObject(body)) return null;
  if (!isStringArray(body.completedIds)) return null;
  if (!isStringArray(body.trackedIds)) return null;
  return { completedIds: body.completedIds, trackedIds: body.trackedIds };
}

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const gameId = await eftGameId();
  const [row] = await db
    .select({
      completedIds: achievementProgress.completedIds,
      trackedIds: achievementProgress.trackedIds,
    })
    .from(achievementProgress)
    .where(and(eq(achievementProgress.userId, userId), eq(achievementProgress.gameId, gameId)))
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
    .insert(achievementProgress)
    .values({ userId, gameId, ...payload })
    .onConflictDoUpdate({
      target: [achievementProgress.userId, achievementProgress.gameId],
      set: {
        completedIds: payload.completedIds,
        trackedIds: payload.trackedIds,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}
