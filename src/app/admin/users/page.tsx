// Раздел «Пользователи»: список всех игроков + построчное управление подпиской.
// Только admin (выдача подписок — admin-only, как /api/admin/subscriptions). Read-only список
// (listUsersForAdmin), запись — через существующий API. Итерация 2 редизайна /admin.
import { redirect } from "next/navigation";
import { getCmsUser } from "@/lib/auth/admin";
import { canManageCatalog } from "@/lib/auth/roles";
import { listUsersForAdmin } from "@/db/admin-users";
import { getTiersFromDb } from "@/db/billing";
import { UsersTable } from "./UsersTable";

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const cms = await getCmsUser();
  if (!cms) redirect("/login");
  if (!canManageCatalog(cms.role)) redirect("/admin");

  const [users, tiers] = await Promise.all([listUsersForAdmin(), getTiersFromDb()]);
  const tierOpts = tiers.map((t) => ({ slug: t.slug, name: t.name }));

  const proCount = users.filter((u) => u.tier !== "free").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-blender-medium text-xl uppercase tracking-widest text-text-primary">
          Пользователи
        </h1>
        <span className="font-blender-book text-xs text-text-muted">
          Всего: <span className="text-text-secondary">{users.length}</span> · PRO:{" "}
          <span className="text-tactical-amber">{proCount}</span>
        </span>
      </div>
      <UsersTable rows={users} tiers={tierOpts} />
    </div>
  );
}
