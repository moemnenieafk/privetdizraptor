// /api/companion/catalog — лёгкий список { inGameId, name } для клиентского фаззи-матча
// в ридере компаньона. Только имена (не цены/свойства) — минимум трафика. Кэшируем на CDN.
// Шаг 2 (icon-match) добавит сюда icon-hash по предмету.
import { NextResponse } from "next/server";
import { getEftCatalog } from "@/lib/eft-catalog";

export const runtime = "nodejs";
// force-dynamic: GET без аргумента req Next пытается пререндерить на сборке, а он
// читает каталог из БД (порт 5432 закрыт наружу → БД на билде недоступна, §4.11).
// Кэш сохраняется на CDN через Cache-Control (s-maxage) ниже — не через SSG.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const catalog = await getEftCatalog();
  const items = catalog.map((i) => {
    // properties.uses — макс. использований ключа/износа; отдаём как maxUses (разница 1/Y vs Y/Y цены).
    const u = i.properties?.uses;
    const maxUses = typeof u === "number" && u > 1 ? u : undefined;
    return maxUses ? { inGameId: i.id, name: i.name, maxUses } : { inGameId: i.id, name: i.name };
  });
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
