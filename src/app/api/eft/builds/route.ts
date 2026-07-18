// /api/eft/builds — публикация сборок в витрину профиля.
//   POST   { name, purpose, tree } → кладёт снимок в weapon_builds (isPublic), отдаёт { slug }.
//           Статы/цену считает СЕРВЕР по дереву (как вьюер /b/[code]) — клиенту не доверяем.
//   DELETE ?slug=... → снять с публикации (owner-scoped).
// Пользователь — только из сессии. Rate-limit на нашей БД.
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getBuildDefs } from "@/db/build-defs";
import { buildTotal } from "@/lib/build-price";
import { calcBuild, type BuildItemIndex, type BuildNode } from "@/lib/weapon-build";
import {
  deletePublicBuild,
  insertPublicBuild,
  type PublicBuildInput,
} from "@/db/public-builds";
import { revalidateProfileByUserId } from "@/lib/revalidate-profile";
import type { BuildStatsSnapshot } from "@/db/schema";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const SLUG_RE = /^[a-z0-9]{6,16}$/;

/** Дерево сборки: валидируем форму рекурсивно (itemId + mods). Ограничиваем размер. */
function isBuildNode(v: unknown, depth = 0): v is BuildNode {
  if (depth > 12 || typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.itemId !== "string" || o.itemId.length === 0 || o.itemId.length > 64) return false;
  if (typeof o.mods !== "object" || o.mods === null) return false;
  const mods = o.mods as Record<string, unknown>;
  const entries = Object.entries(mods);
  if (entries.length > 40) return false;
  return entries.every(([, child]) => isBuildNode(child, depth + 1));
}

function collectIds(node: BuildNode, acc: Set<string>): void {
  acc.add(node.itemId);
  for (const child of Object.values(node.mods)) collectIds(child, acc);
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: { name?: unknown; purpose?: unknown; tree?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const purpose = typeof body.purpose === "string" ? body.purpose.trim().slice(0, 40) : "";
  if (name.length === 0 || name.length > 60) return err(422, "Название 1–60 символов");
  if (!isBuildNode(body.tree)) return err(422, "Некорректное дерево сборки");
  const tree = body.tree;

  if (!(await rateLimit(`build-publish:${me.id}`, 20, 86_400))) {
    return err(429, "Слишком много публикаций. Попробуйте завтра");
  }

  // Резолвим определения и считаем снимок — тем же путём, что вьюер сборки.
  const ids = new Set<string>();
  collectIds(tree, ids);
  const bundle = await getBuildDefs([...ids]);
  const index: BuildItemIndex = new Map(bundle.defs.map((d) => [d.id, d]));

  const baseOk = bundle.defs.some((d) => d.id === tree.itemId && d.kind === "weapon");
  if (!baseOk) return err(422, "База сборки не найдена в оружейном справочнике");

  const result = calcBuild(tree, index);
  const total = buildTotal(tree.itemId, result, bundle.prices);
  const stats: BuildStatsSnapshot = { ...result.stats, priceRub: total.total > 0 ? total.total : null };

  const input: PublicBuildInput = { name, purpose, baseItemId: tree.itemId, tree, stats };
  const res = await insertPublicBuild(me.id, input);
  if (!res.ok) return err(409, res.error ?? "Не удалось опубликовать");

  await revalidateProfileByUserId(me.id);
  return NextResponse.json({ ok: true, slug: res.slug });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");

  const slug = (new URL(req.url).searchParams.get("slug") ?? "").trim();
  if (!SLUG_RE.test(slug)) return err(422, "Некорректный slug");

  await deletePublicBuild(me.id, slug);
  await revalidateProfileByUserId(me.id);
  return NextResponse.json({ ok: true });
}
