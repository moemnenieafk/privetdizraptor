// Список предметов CMS с поиском по названию. Доступ уже ограничен layout-ом.
import Link from "next/link";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { items, itemCategories } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/admin";

// Рендер в рантайме: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function AdminItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // Каталог — только владелец: редактор в /admin видит контент, но не предметы.
  if (!(await getAdmin())) redirect("/admin");

  const { q } = await searchParams;
  const query = q?.trim();

  const gameId = await eftGameId();
  const filters = [eq(items.gameId, gameId)];
  if (query) filters.push(ilike(items.name, `%${query}%`));

  const rows = await db
    .select({
      id: items.inGameId,
      name: items.name,
      shortName: items.shortName,
      basePrice: items.basePrice,
      category: itemCategories.inGameId,
    })
    .from(items)
    .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
    .where(and(...filters))
    .orderBy(asc(items.name))
    .limit(100);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-blender-medium text-xl uppercase tracking-widest">Предметы</h1>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="Поиск по названию…"
          className="w-full max-w-sm rounded-xs border border-white/15 bg-white/5 px-3 py-2 font-blender-book text-sm outline-none focus:border-(--primary)"
        />
        <button
          type="submit"
          className="rounded-xs border border-(--primary) px-4 py-2 font-blender-medium text-xs uppercase tracking-widest text-(--primary)"
        >
          Найти
        </button>
      </form>

      <p className="font-blender-book text-xs text-white/40">
        Показано {rows.length} (макс. 100){query ? ` по запросу «${query}»` : ""}
      </p>

      <div className="flex flex-col divide-y divide-white/5 border border-white/10">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/admin/items/${r.id}`}
            className="flex items-center justify-between gap-4 px-4 py-2 hover:bg-white/5"
          >
            <span className="font-blender-book text-sm">{r.name}</span>
            <span className="font-blender-medium text-xs text-white/40">
              {r.category ?? "—"} · {r.basePrice ?? 0}₽
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
