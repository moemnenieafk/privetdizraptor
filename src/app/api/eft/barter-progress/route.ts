// GET/PUT /api/eft/barter-progress — прогресс геймификации бартера (слой 4c).
// Пользователь берётся ТОЛЬКО из сессии Supabase (никогда из тела запроса).
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { barterProgress } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { createClient } from "@/lib/supabase/server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import type { BarterProgressPayload } from "@/lib/cta-api";

export const runtime = "nodejs";

const EMPTY: BarterProgressPayload = {
  xp: 0,
  confirmedBarterIds: [],
  badges: [],
  streak: 0,
  bestStreak: 0,
  dailyDate: null,
  dailyProfit: 0,
  lifetimeProfit: 0,
  lifetimeSavings: 0,
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

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
// Клампы под типы колонок: bigint(int8, в пределах safe-int) и integer(int4, игровой потолок).
const bigClamp = (v: unknown): number =>
  Math.min(Math.max(0, Math.floor(num(v))), Number.MAX_SAFE_INTEGER);
const smallClamp = (v: unknown): number =>
  Math.min(Math.max(0, Math.floor(num(v))), 1_000_000);

const MAX_CONFIRMED = 5000;
const MAX_BADGES = 50;
const STR_CAP = 200;

function parseBadges(v: unknown): BarterProgressPayload["badges"] {
  if (!Array.isArray(v)) return [];
  const out: BarterProgressPayload["badges"] = [];
  for (const b of v.slice(0, MAX_BADGES)) {
    if (!isObject(b)) continue;
    if (typeof b.id !== "string") continue;
    out.push({
      id: b.id.slice(0, 64),
      label: typeof b.label === "string" ? b.label.slice(0, STR_CAP) : "",
      description: typeof b.description === "string" ? b.description.slice(0, STR_CAP) : "",
      unlockedAt:
        typeof b.unlockedAt === "number" && Number.isFinite(b.unlockedAt) ? b.unlockedAt : null,
    });
  }
  return out;
}

function parsePayload(body: unknown): BarterProgressPayload | null {
  if (!isObject(body)) return null;
  if (!isStringArray(body.confirmedBarterIds)) return null;
  const confirmedBarterIds = Array.from(new Set(body.confirmedBarterIds))
    .filter((s) => s.length <= 64)
    .slice(0, MAX_CONFIRMED);
  return {
    xp: bigClamp(body.xp),
    confirmedBarterIds,
    badges: parseBadges(body.badges),
    streak: smallClamp(body.streak),
    bestStreak: smallClamp(body.bestStreak),
    dailyDate: typeof body.dailyDate === "string" ? body.dailyDate.slice(0, 10) : null,
    dailyProfit: bigClamp(body.dailyProfit),
    lifetimeProfit: bigClamp(body.lifetimeProfit),
    lifetimeSavings: bigClamp(body.lifetimeSavings),
  };
}

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const gameId = await eftGameId();
  const [row] = await db
    .select({
      xp: barterProgress.xp,
      confirmedBarterIds: barterProgress.confirmedBarterIds,
      badges: barterProgress.badges,
      streak: barterProgress.streak,
      bestStreak: barterProgress.bestStreak,
      dailyDate: barterProgress.dailyDate,
      dailyProfit: barterProgress.dailyProfit,
      lifetimeProfit: barterProgress.lifetimeProfit,
      lifetimeSavings: barterProgress.lifetimeSavings,
    })
    .from(barterProgress)
    .where(and(eq(barterProgress.userId, userId), eq(barterProgress.gameId, gameId)))
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
    .insert(barterProgress)
    .values({ userId, gameId, ...payload })
    .onConflictDoUpdate({
      target: [barterProgress.userId, barterProgress.gameId],
      set: {
        xp: payload.xp,
        confirmedBarterIds: payload.confirmedBarterIds,
        badges: payload.badges,
        streak: payload.streak,
        bestStreak: payload.bestStreak,
        dailyDate: payload.dailyDate,
        dailyProfit: payload.dailyProfit,
        lifetimeProfit: payload.lifetimeProfit,
        lifetimeSavings: payload.lifetimeSavings,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}
