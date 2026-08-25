// Одноразовая миграция биллинга/гейтинга (tiers + feature_gates + billing_events +
// снятие CHECK/добавление scope_game_id у subscriptions + сид секций-гейтов). db:push
// с телефона недоступен — накатываем роутом (паттерн migrate-subscriptions). Защита
// CRON_SECRET, идемпотентно. Повторный прогон безопасен.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { TIERS_DDL } from "@/db/tiers-ddl";
import { FEATURE_GATES_DDL } from "@/db/feature-gates-ddl";
import { BILLING_EVENTS_DDL } from "@/db/billing-events-ddl";
import { SUBSCRIPTIONS_DDL } from "@/db/subscriptions-ddl";
import { sectionGatesFromHeader } from "@/data/gate-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Все DDL-модули + повторный прогон subscriptions-ddl (снимает CHECK, добавляет
  // scope_game_id). Порядок важен: tiers перед сидом секций-гейтов не обязателен —
  // feature_gates.min_tier ссылается на slug логически, без FK.
  const statements: string[] = [
    ...TIERS_DDL,
    ...FEATURE_GATES_DDL,
    ...BILLING_EVENTS_DDL,
    ...SUBSCRIPTIONS_DDL,
  ];

  let applied = 0;
  let seededSections = 0;

  try {
    for (const stmt of statements) {
      await db.execute(sql.raw(stmt));
      applied++;
    }

    // Сид section-гейтов из HEADER_DICTIONARY (insert on conflict do nothing —
    // не затирает оверрайды, что админ уже поставил в матрице).
    const sections = sectionGatesFromHeader();
    for (const gate of sections) {
      await db.execute(sql`
        insert into public.feature_gates (feature_key, min_tier, behavior, enabled)
        values (${gate.key}, ${gate.defaultMinTier}, ${gate.defaultBehavior}, true)
        on conflict (feature_key) do nothing
      `);
      seededSections++;
    }

    return NextResponse.json({
      ok: true,
      applied,
      statements: statements.length,
      seededSections,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-billing]", e);
    const err = e as { message?: string; cause?: { message?: string; code?: string } };
    return NextResponse.json(
      {
        ok: false,
        failedAtStatement: applied,
        error: err.message ?? String(e),
        dbError: err.cause?.message ?? null,
        dbCode: err.cause?.code ?? null,
      },
      { status: 500 },
    );
  }
}
