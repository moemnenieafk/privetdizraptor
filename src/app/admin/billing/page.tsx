// /admin/billing — панель биллинга и подписок. Только admin (гард getAdmin → redirect).
// Грузит tiers + карту гейтов (дефолты реестра ⊕ оверрайды БД) + последние billing_events,
// раскладывает по клиентским панелям: матрица гейтов, редактор тиров, выдача подписок, леджер.
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { billingEvents, profiles } from "@/db/schema";
import { getAdmin } from "@/lib/auth/admin";
import { getTiersFromDb, getGatesFromDb } from "@/db/billing";
import { allGateDefs } from "@/data/gate-registry";
import { getPreviewTierSlug } from "@/lib/gating/preview";
import { isProtectedTier } from "@/lib/gating/tiers";
import { GateMatrixClient, type GateRow, type TierOption } from "./GateMatrixClient";
import { TierEditorClient, type EditableTier } from "./TierEditorClient";
import { UserSubsClient } from "./UserSubsClient";
import { LedgerTable, type LedgerRow } from "./LedgerTable";
import { SystemTogglesClient, type SystemToggle } from "./SystemTogglesClient";
import { TierPreviewClient } from "./TierPreviewClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEDGER_LIMIT = 50;

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
        {title}
      </h2>
      {hint && <p className="font-blender-book text-xs text-white/40">{hint}</p>}
    </div>
  );
}

export default async function AdminBillingPage() {
  if (!(await getAdmin())) redirect("/admin");

  const [tierRows, gateRows, previewTier, events] = await Promise.all([
    getTiersFromDb(),
    getGatesFromDb(),
    getPreviewTierSlug(),
    db
      .select({
        id: billingEvents.id,
        createdAt: billingEvents.createdAt,
        provider: billingEvents.provider,
        type: billingEvents.type,
        tier: billingEvents.tier,
        amount: billingEvents.amount,
        currency: billingEvents.currency,
        status: billingEvents.status,
        username: profiles.username,
      })
      .from(billingEvents)
      .leftJoin(profiles, eq(billingEvents.userId, profiles.id))
      .orderBy(desc(billingEvents.createdAt))
      .limit(LEDGER_LIMIT),
  ]);

  // Тиры в порядке rank для селектов и редактора.
  const orderedTiers = [...tierRows].sort((a, b) => a.rank - b.rank);
  const tierOptions: TierOption[] = orderedTiers.map((t) => ({ slug: t.slug, name: t.name }));

  // hasLedgerRefs — по одному проходу событий (леджер уже загружен, доп. запросов нет для
  // последних N; для полноты достаточно факта появления slug в выборке).
  const ledgerSlugs = new Set(events.map((e) => e.tier).filter((s): s is string => !!s));

  const editableTiers: EditableTier[] = orderedTiers.map((t) => ({
    slug: t.slug,
    name: t.name,
    price: t.price,
    rank: t.rank,
    archived: t.archived,
    perks: t.perks ?? null,
    protected: isProtectedTier(t.slug),
    hasLedgerRefs: ledgerSlugs.has(t.slug),
  }));

  // Карта гейтов: дефолт реестра ⊕ оверрайд из БД (строка БД перебивает дефолт).
  const overrides = new Map(gateRows.map((g) => [g.featureKey, g]));
  const allDefs = allGateDefs();

  // ⚠️ Дефолт enabled берём из определения, а НЕ хардкодим true: системные переключатели
  // приезжают выключенными, и матрица иначе показывала бы включённым то, что выключено.
  const matrix: GateRow[] = allDefs
    .filter((def) => def.kind !== "system")
    .map((def) => {
      const ov = overrides.get(def.key);
      return {
        key: def.key,
        label: def.label,
        category: def.category,
        minTier: ov?.minTier ?? def.defaultMinTier,
        behavior: ov?.behavior ?? def.defaultBehavior,
        enabled: ov?.enabled ?? def.defaultEnabled ?? true,
      };
    });

  // Системные переключатели — свой блок: у них нет порога, значение несёт только вкл/выкл.
  const toggles: SystemToggle[] = allDefs
    .filter((def) => def.kind === "system")
    .map((def) => {
      const ov = overrides.get(def.key);
      return {
        key: def.key,
        label: def.label,
        description: def.description,
        enabled: ov?.enabled ?? def.defaultEnabled ?? true,
        minTier: ov?.minTier ?? def.defaultMinTier,
        behavior: ov?.behavior ?? def.defaultBehavior,
      };
    });

  const ledger: LedgerRow[] = events.map((e) => ({
    id: e.id,
    createdAt: dateFmt.format(e.createdAt),
    user: e.username ?? "—",
    provider: e.provider,
    type: e.type,
    tier: e.tier,
    amount: e.amount,
    currency: e.currency,
    status: e.status,
  }));

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-blender-medium text-xl uppercase tracking-widest">Биллинг и подписки</h1>

      <section className="flex flex-col gap-4">
        <SectionHead
          title="Матрица доступа"
          hint="Минимальный тир, поведение замка и вкл/выкл для каждого раздела и фичи. Применяется сразу."
        />
        <GateMatrixClient gates={matrix} tiers={tierOptions} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHead
          title="Уровни подписки"
          hint="Создание, переименование, цена, ранг, архив. free защищён от удаления и оплаты."
        />
        <TierEditorClient tiers={editableTiers} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHead
          title="Подписки юзеров"
          hint="Выдать, продлить или снять тир по username. Пишется в леджер начислений."
        />
        <UserSubsClient tiers={tierOptions} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHead
          title="Переключатели"
          hint="Системные тумблеры портала. Витрину цен включать только после того, как заполнена публичная оферта."
        />
        <SystemTogglesClient toggles={toggles} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHead
          title="Просмотр от лица тира"
          hint="Понизить свой видимый уровень доступа, чтобы проверить замки и апселлы на живом сайте."
        />
        <TierPreviewClient tiers={tierOptions} active={previewTier} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHead title="Леджер начислений" hint={`Последние ${LEDGER_LIMIT} событий (read-only).`} />
        <LedgerTable rows={ledger} />
      </section>
    </div>
  );
}
