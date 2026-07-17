// Одноразовая миграция таблицы подписок (subscriptions). db:push с телефона
// недоступен — накатываем роутом (паттерн migrate-comlink). Защита CRON_SECRET,
// идемпотентно. До этой миграции тир у всех деградировал в 'free'.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { SUBSCRIPTIONS_DDL } from "@/db/subscriptions-ddl";

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
    for (let i = 0; i < SUBSCRIPTIONS_DDL.length; i++) {
      await db.execute(sql.raw(SUBSCRIPTIONS_DDL[i]));
      applied.push(i);
    }

    const check = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public' and table_name = 'subscriptions'`,
    );
    const exists = [...check].length > 0;

    const rlsRows = await db.execute<{ rls_enabled: boolean }>(
      sql`select relrowsecurity as rls_enabled
          from pg_class
          where relnamespace = 'public'::regnamespace and relname = 'subscriptions'`,
    );
    const polRows = await db.execute<{ policies: number }>(
      sql`select count(*)::int as policies
          from pg_policies
          where schemaname = 'public' and tablename = 'subscriptions'`,
    );
    const rlsEnabled = [...rlsRows][0]?.rls_enabled === true;
    const policies = Number([...polRows][0]?.policies ?? 0);

    return NextResponse.json({
      ok: true,
      statements: SUBSCRIPTIONS_DDL.length,
      table: exists ? "subscriptions" : null,
      rlsEnabled,
      policies,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-subscriptions]", e);
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
