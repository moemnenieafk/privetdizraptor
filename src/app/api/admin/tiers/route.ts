// /api/admin/tiers — CRUD уровней подписки из редактора тиров. Только admin.
//   POST   — создать тир (slug/name/price/rank/perks).
//   PATCH  — править существующий (name/price/rank/perks/archived).
//   DELETE — снести тир (?slug=…); free защищён, платный с записями в леджере — отказ.
// Серверная защита free и удаления — чистыми validateTierEdit/isProtectedTier + deleteTier
// (проверяет леджер). После любой мутации — invalidateGating (ранги влияют на доступ).
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { upsertTier, archiveTier, deleteTier, getTiersFromDb } from "@/db/billing";
import { validateTierEdit, isProtectedTier } from "@/lib/gating/tiers";
import { invalidateGating } from "@/lib/gating/resolve";

export const runtime = "nodejs";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// perks: массив непустых строк или null.
function parsePerks(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return out.length > 0 ? out : null;
}

interface TierWrite {
  slug: string;
  name: string;
  price: number;
  rank: number;
  archived: boolean;
  perks: string[] | null;
}

function parseWrite(body: unknown): TierWrite | null {
  if (!isObject(body)) return null;
  if (typeof body.slug !== "string" || !body.slug.trim()) return null;
  if (typeof body.name !== "string" || !body.name.trim()) return null;
  if (!isNum(body.price) || !isNum(body.rank)) return null;
  return {
    slug: body.slug.trim(),
    name: body.name.trim(),
    price: body.price,
    rank: body.rank,
    archived: typeof body.archived === "boolean" ? body.archived : false,
    perks: parsePerks(body.perks),
  };
}

// Общая запись для POST/PATCH: валидация домена → upsert → инвалидация.
async function writeTier(body: unknown, mode: "create" | "update"): Promise<NextResponse> {
  const input = parseWrite(body);
  if (!input) return NextResponse.json({ error: "bad payload" }, { status: 422 });

  const check = validateTierEdit({
    slug: input.slug,
    price: input.price,
    rank: input.rank,
    archived: input.archived,
  });
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 422 });

  const existing = await getTiersFromDb();
  const found = existing.find((t) => t.slug === input.slug);
  if (mode === "create" && found) {
    return NextResponse.json({ error: "slug уже существует" }, { status: 409 });
  }
  if (mode === "update" && !found) {
    return NextResponse.json({ error: "тир не найден" }, { status: 404 });
  }

  const row = await upsertTier({
    slug: input.slug,
    name: input.name,
    price: input.price,
    rank: input.rank,
    archived: input.archived,
    perks: input.perks,
  });
  invalidateGating();

  return NextResponse.json({
    ok: true,
    tier: {
      slug: row.slug,
      name: row.name,
      price: row.price,
      rank: row.rank,
      archived: row.archived,
      perks: row.perks ?? null,
    },
  });
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
  return writeTier(body, "create");
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
  return writeTier(body, "update");
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const slug = new URL(req.url).searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 422 });
  if (isProtectedTier(slug)) {
    return NextResponse.json({ error: "free защищён от удаления" }, { status: 422 });
  }

  const res = await deleteTier(slug);
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 409 });
  }
  invalidateGating();
  return NextResponse.json({ ok: true });
}
