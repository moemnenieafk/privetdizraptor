// Одноразовая миграция оружейного слоя: создаёт таблицы weapon_* через Drizzle.
// Нужна потому, что db:push и Supabase SQL Editor недоступны с телефона.
//
// Защита — CRON_SECRET (fail-closed). Выполняет ТОЛЬКО статический DDL из
// src/db/weapons-ddl.ts — произвольный SQL из запроса не принимается принципиально.
// Идемпотентно: гоняется сколько угодно раз.
//
// После успешного прогона можно дёргать /api/cron/sync-weapons.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { WEAPONS_DDL } from "@/db/weapons-ddl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const applied: number[] = [];

  try {
    // Последовательно, не в транзакции: DDL идемпотентен, а частичный успех
    // виден по `applied` — проще чинить, чем откатывать всё из-за одной policy.
    for (let i = 0; i < WEAPONS_DDL.length; i++) {
      await db.execute(sql.raw(WEAPONS_DDL[i]));
      applied.push(i);
    }

    // Контроль: реально ли таблицы появились.
    const check = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public' and table_name like 'weapon%'
          order by table_name`,
    );
    const tables = [...check].map((r) => r.table_name);

    return NextResponse.json({
      ok: true,
      statements: WEAPONS_DDL.length,
      tables,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-weapons]", e);
    const err = e as { message?: string; cause?: { message?: string; code?: string } };
    return NextResponse.json(
      {
        ok: false,
        failedAtStatement: applied.length, // индекс упавшего стейтмента в WEAPONS_DDL
        error: err.message ?? String(e),
        dbError: err.cause?.message ?? null,
        dbCode: err.cause?.code ?? null,
      },
      { status: 500 },
    );
  }
}