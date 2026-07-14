// Назначение роли пользователю без доступа к SQL Editor (телефон/отпуск).
// Паттерн migrate-*: GET за CRON_SECRET, дёргается из GitHub Actions (workflow «set-role»).
//
// Умышленное ограничение: роут выдаёт 'user', 'editor' и 'moderator'. Роль 'admin'
// (каталог + выдача ролей) через него НЕ назначается — утечка CRON_SECRET не должна
// давать админку; админа ставим вручную в Supabase.
import { NextResponse } from "next/server";
import { and, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSIGNABLE = new Set(["user", "editor", "moderator"]);

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const username = (params.get("username") ?? "").trim();
  const role = (params.get("role") ?? "moderator").trim();

  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }
  if (!ASSIGNABLE.has(role)) {
    return NextResponse.json(
      { error: `role must be one of: ${[...ASSIGNABLE].join(", ")}` },
      { status: 400 },
    );
  }

  try {
    // Матч по логину без учёта регистра. Админов не трогаем (понижение через роут запрещено).
    const updated = await db
      .update(profiles)
      .set({ role, updatedAt: sql`now()` })
      .where(
        and(
          sql`lower(${profiles.username}) = lower(${username})`,
          ne(profiles.role, "admin"),
        ),
      )
      .returning({ id: profiles.id, username: profiles.username, role: profiles.role });

    if (updated.length === 0) {
      // Различаем «нет такого логина» и «это админ, не трогаем».
      const [existing] = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(sql`lower(${profiles.username}) = lower(${username})`)
        .limit(1);

      return NextResponse.json(
        {
          ok: false,
          reason: existing ? "user is admin — не понижаем через роут" : "user not found",
          username,
        },
        { status: existing ? 409 : 404 },
      );
    }

    return NextResponse.json({ ok: true, updated, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/set-role]", e);
    const err = e as { message?: string };
    return NextResponse.json({ ok: false, error: err.message ?? String(e) }, { status: 500 });
  }
}