// POST /api/admin/subscriptions — ручное управление подпиской юзера из админки. Только admin.
// action: 'grant'|'extend' → выдать/продлить тир на months; 'revoke' → сбросить на free.
// Резолвит username→profiles.id, пишет через setUserTier (леджер type='grant') и
// ревалидирует публичный профиль /u/[username] (тир там виден).
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getAdmin } from "@/lib/auth/admin";
import { setUserTier, getTiersFromDb } from "@/db/billing";
import { revalidateProfileByUsername } from "@/lib/revalidate-profile";

export const runtime = "nodejs";

const ACTIONS = ["grant", "extend", "revoke"] as const;
type Action = (typeof ACTIONS)[number];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isAction = (v: unknown): v is Action =>
  typeof v === "string" && (ACTIONS as readonly string[]).includes(v);

interface SubReq {
  username: string;
  tier: string;
  months: number;
  action: Action;
}

function parseReq(body: unknown): SubReq | null {
  if (!isObject(body)) return null;
  if (typeof body.username !== "string" || !body.username.trim()) return null;
  if (!isAction(body.action)) return null;
  // revoke → тир='free', months игнорируются; grant/extend → тир + months обязательны.
  if (body.action === "revoke") {
    return { username: body.username.trim(), tier: "free", months: 0, action: "revoke" };
  }
  if (typeof body.tier !== "string" || !body.tier) return null;
  const months = typeof body.months === "number" && Number.isFinite(body.months) ? body.months : 0;
  if (months < 0) return null;
  return { username: body.username.trim(), tier: body.tier, months, action: body.action };
}

export async function POST(req: Request): Promise<NextResponse> {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const input = parseReq(body);
  if (!input) return NextResponse.json({ error: "bad payload" }, { status: 422 });

  // Тир должен существовать (кроме free, который всегда валиден как сброс).
  if (input.tier !== "free") {
    const tiers = await getTiersFromDb();
    if (!tiers.some((t) => t.slug === input.tier)) {
      return NextResponse.json({ error: "unknown tier" }, { status: 422 });
    }
  }

  const [user] = await db
    .select({ id: profiles.id, username: profiles.username })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = lower(${input.username})`)
    .limit(1);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // extend — настоящее продление (срок наращивается от текущего, не перезаписывается);
  // grant — выдача (замена срока); revoke — сброс на free.
  await setUserTier({
    userId: user.id,
    tier: input.tier,
    months: input.months,
    source: "manual",
    extend: input.action === "extend",
    type:
      input.action === "revoke"
        ? "downgrade"
        : input.action === "extend"
          ? "renewal"
          : "grant",
  });

  revalidateProfileByUsername(user.username);
  return NextResponse.json({ ok: true });
}
