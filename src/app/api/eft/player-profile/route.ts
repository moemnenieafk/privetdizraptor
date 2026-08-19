// GET/PUT /api/eft/player-profile — облачные игровые профили текущего юзера (слой 4d).
// Пользователь берётся ТОЛЬКО из сессии Supabase (никогда из тела запроса).
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playerProfiles, type PlayerProfilePersist } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { createClient } from "@/lib/supabase/server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import type { PlayerProfilePayload } from "@/lib/cta-api";

export const runtime = "nodejs";

const MAX_PROFILES = 5;
const STR_CAP = 64;

const EMPTY: PlayerProfilePayload = { profiles: [], activeProfileId: "" };

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v.slice(0, STR_CAP) : fallback;

const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function parseTraderLevels(v: unknown): Record<string, number> {
  if (!isObject(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "number" && Number.isFinite(val)) {
      out[k.slice(0, 32)] = Math.min(Math.max(0, Math.floor(val)), 4);
    }
  }
  return out;
}

function parseProfile(v: unknown): PlayerProfilePersist | null {
  if (!isObject(v) || typeof v.id !== "string") return null;
  return {
    id: v.id.slice(0, STR_CAP),
    nickname: str(v.nickname, "TarkovCitizen"),
    level: str(v.level, "1"),
    prestige: str(v.prestige, "0"),
    faction: str(v.faction, "BEAR"),
    edition: str(v.edition, "Standard"),
    mode: str(v.mode, "PVP"),
    hoursPlayed: numOrNull(v.hoursPlayed),
    raids: numOrNull(v.raids),
    survivalRate: numOrNull(v.survivalRate),
    traderLevels: parseTraderLevels(v.traderLevels),
    // Аддитивная EFT-стата (из profile.json) — сохраняем в облаке, иначе синк слоя 4d её терял.
    memberCategory: numOrNull(v.memberCategory),
    experience: numOrNull(v.experience),
    kills: numOrNull(v.kills),
    deaths: numOrNull(v.deaths),
    killed: numOrNull(v.killed),
    survived: numOrNull(v.survived),
    kd: numOrNull(v.kd),
    streak: numOrNull(v.streak),
  };
}

function parsePayload(body: unknown): { profiles: PlayerProfilePersist[]; activeProfileId: string } | null {
  if (!isObject(body)) return null;
  if (!Array.isArray(body.profiles)) return null;
  if (typeof body.activeProfileId !== "string") return null;
  const profiles = body.profiles
    .slice(0, MAX_PROFILES)
    .map(parseProfile)
    .filter((p): p is PlayerProfilePersist => p !== null);
  if (profiles.length === 0) return null; // минимум 1 профиль
  // activeProfileId должен указывать на существующий профиль (иначе — первый)
  const activeProfileId = profiles.some((p) => p.id === body.activeProfileId)
    ? body.activeProfileId
    : profiles[0].id;
  return { profiles, activeProfileId };
}

export async function GET(): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const gameId = await eftGameId();
  const [row] = await db
    .select({ profiles: playerProfiles.profiles, activeProfileId: playerProfiles.activeProfileId })
    .from(playerProfiles)
    .where(and(eq(playerProfiles.userId, userId), eq(playerProfiles.gameId, gameId)))
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
    .insert(playerProfiles)
    .values({ userId, gameId, ...payload })
    .onConflictDoUpdate({
      target: [playerProfiles.userId, playerProfiles.gameId],
      set: {
        profiles: payload.profiles,
        activeProfileId: payload.activeProfileId,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}
