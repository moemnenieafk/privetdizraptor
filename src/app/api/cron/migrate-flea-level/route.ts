// Миграция: колонка `min_level_for_flea` в `prices` — уровень ЧВК, с которого
// предмет доступен на барахолке. В Tarkov 1.0 поверх общего порога 15 навешены
// блокировки по категориям (болтовки ~20, штурмовые ~25, бартер и медицина ~30,
// топовые патроны ~40). tarkov.dev отдаёт уже разрешённое число полем
// `Item.minLevelForFlea` — собирать карту категорий вручную не нужно.
//
// Защита — CRON_SECRET (fail-closed). Только статический DDL. Идемпотентно.
//
// ВАЖНО: гнать ДО деплоя кода, который пишет колонку. syncEftPrices() в кроне
// критический и не обёрнут в try/catch — падение на несуществующей колонке
// уронит весь прайс-синк, а не только это поле.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DDL: string[] = [
  `ALTER TABLE prices ADD COLUMN IF NOT EXISTS min_level_for_flea integer`,
];

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const applied: number[] = [];
  try {
    for (let i = 0; i < DDL.length; i++) {
      await db.execute(sql.raw(DDL[i]));
      applied.push(i);
    }

    const stats = await db.execute<{ total: number; filled: number }>(
      sql`select count(*)::int as total, count(min_level_for_flea)::int as filled from prices`,
    );
    const s = [...stats][0] ?? { total: 0, filled: 0 };

    return NextResponse.json({
      ok: true,
      statements: DDL.length,
      items: s.total,
      withLevel: s.filled,
      hint: s.filled === 0 ? "колонка пуста — задеплой код и прогони sync-prices" : null,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-flea-level]", e);
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
