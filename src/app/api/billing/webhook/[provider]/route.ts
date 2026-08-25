// Провайдер-независимый вебхук приёма платежей. Резолвит адаптер по сегменту
// маршрута; реестр пуст (реальный рельс подключит Дима, см. src/lib/billing/adapter.ts).
//
// Поток: нет адаптера → 501 (честно: каркас без провайдера) · verify провалился →
// 401 · иначе parse → writeBillingEvent (идемпотентно по provider+external_id) →
// при начисляющем типе двинуть тир через setUserTier. Наружу не ходим (§4.11).
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getAdapter, type BillingEventInput } from "@/lib/billing/adapter";
import { setUserTier, writeBillingEvent, type BillingEventType } from "@/db/billing";
import { revalidateProfileByUserId } from "@/lib/revalidate-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Типы события, которые начисляют/двигают тир. refund/downgrade тир не выдают. */
const GRANTING_TYPES: ReadonlySet<BillingEventType> = new Set<BillingEventType>([
  "grant",
  "payment",
  "renewal",
]);

/** Резолв userId: прямой из события или по usernameHint (регистр не важен). */
async function resolveUserId(input: BillingEventInput): Promise<string | null> {
  if (input.userId) return input.userId;
  const hint = input.usernameHint?.trim();
  if (!hint) return null;
  const [user] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = lower(${hint})`)
    .limit(1);
  return user?.id ?? null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params;

  const adapter = getAdapter(provider);
  if (!adapter) {
    return NextResponse.json(
      { ok: false, reason: `no adapter for ${provider} yet` },
      { status: 501 },
    );
  }

  try {
    const authentic = await adapter.verify(req);
    if (!authentic) {
      return NextResponse.json({ ok: false, reason: "verify failed" }, { status: 401 });
    }

    const event = await adapter.parse(req);
    const userId = await resolveUserId(event);
    const isGranting = GRANTING_TYPES.has(event.type);

    // Аутентичное НАЧИСЛЯЮЩЕЕ событие без резолвленного юзера нельзя молча подтвердить:
    // в леджер не запишешь (user_id NOT NULL FK), а 2xx скажет провайдеру «успех» и он
    // не переретраит — оплата потеряется без следа. Возвращаем не-2xx + лог, чтобы отказ
    // был виден и провайдер повторил. (refund/downgrade без юзера — не начисление, ниже.)
    if (isGranting && !userId) {
      console.error(
        `[billing/webhook/${provider}] unresolved_user`,
        { provider, usernameHint: event.usernameHint ?? null },
      );
      return NextResponse.json({ ok: false, reason: "unresolved_user" }, { status: 422 });
    }

    // Леджер пишется всегда, когда есть кого начислить — идемпотентно по external_id.
    if (userId) {
      await writeBillingEvent({
        userId,
        type: event.type,
        provider: event.provider || provider,
        externalId: event.externalId ?? null,
        tier: event.tier ?? null,
        amount: event.amount ?? null,
        currency: event.currency,
        status: event.status ?? null,
        raw: event.raw != null ? { payload: event.raw } : null,
      });

      // Начисляющее событие с тиром → двинуть подписку (setUserTier сам пишет grant;
      // здесь тип и провайдер прокидываем, чтобы леджер отражал реальный источник).
      if (event.tier && GRANTING_TYPES.has(event.type)) {
        await setUserTier({
          userId,
          tier: event.tier,
          months: event.months ?? 0,
          source: event.provider || provider,
          provider: event.provider || provider,
          type: event.type,
        });
        await revalidateProfileByUserId(userId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[billing/webhook/${provider}]`, e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json(
      { ok: false, error: err.message ?? String(e), dbError: err.cause?.message ?? null },
      { status: 500 },
    );
  }
}
