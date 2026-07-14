// GET /api/comlink/candidates — список анкет с фильтрами.
// Только авторизованным: соц-слой закрыт от анонимов и парсеров (в выдаче Discord-хендлы).
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { getCandidates, type CandidateFilters } from "@/db/comlink";
import type { ComlinkGoal } from "@/db/schema-comlink";
import { EFT_MAP_CONFIG } from "@/data/eft-map-config";

export const runtime = "nodejs";

const GOALS = new Set<ComlinkGoal>(["partner", "team", "student", "sherpa"]);
const VALID_MAPS = new Set(Object.keys(EFT_MAP_CONFIG));

export async function GET(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams;

  const filters: CandidateFilters = {
    limit: Math.min(Number(q.get("limit")) || 20, 50),
    offset: Math.max(Number(q.get("offset")) || 0, 0),
  };

  const goal = q.get("goal");
  if (goal && GOALS.has(goal as ComlinkGoal)) filters.goal = goal as ComlinkGoal;

  const map = q.get("map");
  if (map && VALID_MAPS.has(map)) filters.map = map;

  const voice = q.get("voice");
  if (voice === "1") filters.voice = true;

  const data = await getCandidates(filters);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}
