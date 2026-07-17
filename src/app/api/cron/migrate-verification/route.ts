// Одноразовая миграция подтверждения ЧВК-профиля: создаёт player_verifications
// (+ индекс, RLS, owner-read policy). db:push с телефона недоступен — накатываем
// роутом (паттерн migrate-comlink). Защита CRON_SECRET, идемпотентно.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { VERIFICATION_DDL } from "@/db/verification-ddl";

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
    for (let i = 0; i < VERIFICATION_DDL.length; i++) {
      await db.execute(sql.raw(VERIFICATION_DDL[i]));
      applied.push(i);
    }

    // Проверка: таблица есть.
    const check = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public' and table_name = 'player_verifications'`,
    );
    const exists = [...check].length > 0;

    // Проверка RLS: включён + ровно одна read-политика (owner-read).
    const rlsRows = await db.execute<{ rls_enabled: boolean }>(
      sql`select relrowsecurity as rls_enabled
          from pg_class
          where relnamespace = 'public'::regnamespace
            and relname = 'player_verifications'`,
    );
    const polRows = await db.execute<{ policies: number }>(
      sql`select count(*)::int as policies
          from pg_policies
          where schemaname = 'public' and tablename = 'player_verifications'`,
    );
    const rlsEnabled = [...rlsRows][0]?.rls_enabled === true;
    const policies = Number([...polRows][0]?.policies ?? 0);

    return NextResponse.json({
      ok: true,
      statements: VERIFICATION_DDL.length,
      table: exists ? "player_verifications" : null,
      rlsEnabled,
      policies,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-verification]", e);
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
