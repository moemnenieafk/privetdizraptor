// Одноразовая миграция раздела «Связь»: создаёт таблицы comlink_* + karma_events.
// db:push и SQL Editor с телефона недоступны — накатываем роутом (паттерн
// migrate-weapons). Защита CRON_SECRET, идемпотентно.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { COMLINK_DDL } from "@/db/comlink-ddl";

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
    for (let i = 0; i < COMLINK_DDL.length; i++) {
      await db.execute(sql.raw(COMLINK_DDL[i]));
      applied.push(i);
    }

    const check = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public'
            and (table_name like 'comlink%' or table_name = 'karma_events')
          order by table_name`,
    );
    const tables = [...check].map((r) => r.table_name);

    // Верификация RLS: доказываем, что row-level security включён на каждой таблице
    // раздела и что число политик соответствует модели (karma_events/comlink_reports —
    // намеренно 0 политик = глухой доступ; остальные — по одной read-политике).
    const rlsRows = await db.execute<{ table_name: string; rls_enabled: boolean }>(
      sql`select relname as table_name, relrowsecurity as rls_enabled
          from pg_class
          where relnamespace = 'public'::regnamespace
            and (relname like 'comlink%' or relname = 'karma_events')
          order by relname`,
    );
    const polRows = await db.execute<{ table_name: string; policies: number }>(
      sql`select tablename as table_name, count(*)::int as policies
          from pg_policies
          where schemaname = 'public'
            and (tablename like 'comlink%' or tablename = 'karma_events')
          group by tablename`,
    );
    const polMap = new Map([...polRows].map((r) => [r.table_name, Number(r.policies)]));
    const security = [...rlsRows].map((r) => ({
      table: r.table_name,
      rls: r.rls_enabled === true,
      policies: polMap.get(r.table_name) ?? 0,
    }));
    const rlsAllOn = security.length > 0 && security.every((s) => s.rls);

    return NextResponse.json({
      ok: true,
      statements: COMLINK_DDL.length,
      tables,
      rlsAllOn,
      security,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-comlink]", e);
    const err = e as { message?: string; cause?: { message?: string; code?: string } };
    return NextResponse.json(
      {
        ok: false,
        failedAtStatement: applied.length,
        error: err.message ?? String(e),
        dbError: err.cause?.message ?? null,
        dbCode: err.cause?.code ?? null,
      },
      { status: 500 },
    );
  }
}
