// GET/PUT /api/comlink/profile — моя анкета в разделе «Связь».
//
// PUT: создание/правка. Rate-limit «правка раз в час» (решение V4DYA: анкеты идут
// в список сразу, без премодерации — спам разгребают модераторы по жалобам).
// Лимитер — существующая таблица rate_limits (fixed window, паттерн auth-роутов).
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { getMe } from "@/lib/auth/me";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import {
  getOwnComlinkProfile,
  upsertComlinkProfile,
  type UpsertProfileInput,
} from "@/db/comlink";
import type { ComlinkGoal, PlayStyle, PlayTime } from "@/db/schema-comlink";
import { EFT_MAP_CONFIG } from "@/data/eft-map-config";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

const GOALS: readonly ComlinkGoal[] = ["partner", "team", "student", "sherpa"];
const TIMES: readonly PlayTime[] = ["morning", "day", "evening", "night"];
const STYLES: readonly PlayStyle[] = ["pvp", "loot", "quests", "chill"];
const VALID_MAPS = new Set(Object.keys(EFT_MAP_CONFIG));

const MAX_ABOUT = 400;
const EDIT_WINDOW_MS = 60 * 60 * 1000; // правка раз в час

const strArr = (v: unknown, allowed: ReadonlySet<string>, cap: number): string[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.has(x)))].slice(0, cap)
    : [];

export async function GET(): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  const profile = await getOwnComlinkProfile(me.id);
  return NextResponse.json({ profile });
}

export async function PUT(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err(400, "Некорректный запрос");
  }

  // ── rate-limit: правка раз в час (fixed window по ключу) ──
  const key = `comlink-profile:${me.id}`;
  const [rl] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  const now = Date.now();

  if (rl && now - rl.windowStart.getTime() < EDIT_WINDOW_MS) {
    const waitMin = Math.ceil((EDIT_WINDOW_MS - (now - rl.windowStart.getTime())) / 60_000);
    return err(429, `Анкету можно править раз в час. Подождите ~${waitMin} мин.`);
  }

  // ── валидация ──
  const goal = body.goal;
  if (typeof goal !== "string" || !GOALS.includes(goal as ComlinkGoal)) {
    return err(422, "Неизвестная цель анкеты");
  }

  const aboutRaw = typeof body.about === "string" ? body.about.trim() : "";
  if (aboutRaw.length > MAX_ABOUT) return err(422, `«О себе» не длиннее ${MAX_ABOUT} символов`);

  const tzRaw = body.tzOffset;
  const tzOffset =
    typeof tzRaw === "number" && Number.isInteger(tzRaw) && tzRaw >= -12 && tzRaw <= 12
      ? tzRaw
      : null;

  const input: UpsertProfileInput = {
    goal: goal as ComlinkGoal,
    maps: strArr(body.maps, VALID_MAPS, 13),
    playTime: strArr(body.playTime, new Set<string>(TIMES), 4) as PlayTime[],
    playStyle: strArr(body.playStyle, new Set<string>(STYLES), 4) as PlayStyle[],
    voice: body.voice !== false,
    tzOffset,
    about: aboutRaw,
    active: body.active !== false,
  };

  await upsertComlinkProfile(me.id, input);

  // Окно лимита открываем ПОСЛЕ успешной записи — невалидная попытка час не съедает.
  await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({ target: rateLimits.key, set: { count: 1, windowStart: sql`now()` } });

  const profile = await getOwnComlinkProfile(me.id);
  return NextResponse.json({ ok: true, profile });
}
