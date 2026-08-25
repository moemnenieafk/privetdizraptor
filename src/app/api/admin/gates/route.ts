// PATCH /api/admin/gates — правка одной строки матрицы гейтов из админки. Только admin.
// Записывает оверрайд через upsertGate и сбрасывает кеш-теги (invalidateGating) —
// смена порога/поведения применяется у не-подписчика сразу, без деплоя (R03.1).
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { upsertGate, getTiersFromDb } from "@/db/billing";
import { allGateDefs } from "@/data/gate-registry";
import { invalidateGating } from "@/lib/gating/resolve";

export const runtime = "nodejs";

const BEHAVIORS = ["lock", "hide", "teaser"] as const;
type Behavior = (typeof BEHAVIORS)[number];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isBehavior = (v: unknown): v is Behavior =>
  typeof v === "string" && (BEHAVIORS as readonly string[]).includes(v);

interface GatePatch {
  feature_key: string;
  min_tier: string;
  behavior: Behavior;
  enabled: boolean;
}

function parsePatch(body: unknown): GatePatch | null {
  if (!isObject(body)) return null;
  if (typeof body.feature_key !== "string" || !body.feature_key) return null;
  if (typeof body.min_tier !== "string" || !body.min_tier) return null;
  if (!isBehavior(body.behavior)) return null;
  if (typeof body.enabled !== "boolean") return null;
  return {
    feature_key: body.feature_key,
    min_tier: body.min_tier,
    behavior: body.behavior,
    enabled: body.enabled,
  };
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const patch = parsePatch(body);
  if (!patch) return NextResponse.json({ error: "bad payload" }, { status: 422 });

  // feature_key должен быть известным гейтом (фича или секция).
  const known = allGateDefs().some((g) => g.key === patch.feature_key);
  if (!known) return NextResponse.json({ error: "unknown feature_key" }, { status: 422 });

  // min_tier обязан существовать среди тиров.
  const tiers = await getTiersFromDb();
  if (!tiers.some((t) => t.slug === patch.min_tier)) {
    return NextResponse.json({ error: "unknown min_tier" }, { status: 422 });
  }

  const row = await upsertGate({
    feature_key: patch.feature_key,
    min_tier: patch.min_tier,
    behavior: patch.behavior,
    enabled: patch.enabled,
    updated_by: admin.id,
  });
  invalidateGating();

  return NextResponse.json({
    ok: true,
    gate: {
      feature_key: row.featureKey,
      min_tier: row.minTier,
      behavior: row.behavior,
      enabled: row.enabled,
    },
  });
}
