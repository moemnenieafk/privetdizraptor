// Одноразовая миграция кэша лукапа игроков: создаёт таблицу eft_player_lookup_cache.
// Нужна потому, что db:push и Supabase SQL Editor недоступны с телефона.
//
// Защита — CRON_SECRET (fail-closed). Выполняет ТОЛЬКО статический DDL из
// src/db/player-cache-ddl.ts — произвольный SQL из запроса не принимается принципиально.
// Идемпотентно: гоняется сколько угодно раз.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { PLAYER_CACHE_DDL } from "@/db/player-cache-ddl";

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
    for (let i = 0; i < PLAYER_CACHE_DDL.length; i++) {
      await db.execute(sql.raw(PLAYER_CACHE_DDL[i]));
      applied.push(i);
    }

    const check = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public' and table_name = 'eft_player_lookup_cache'`,
    );
    const exists = [...check].length > 0;

    return NextResponse.json({
      ok: true,
      statements: PLAYER_CACHE_DDL.length,
      table: exists ? "eft_player_lookup_cache" : null,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-player-cache]", e);
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
