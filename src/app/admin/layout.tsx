// Защита зоны /admin: пускает admin и editor, иначе → /login.
// Разделы внутри гейтятся по правам (каталог — только admin), см. AdminHome и /admin/items.
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCmsUser } from "@/lib/auth/admin";
import { ROLE_LABELS } from "@/lib/auth/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cms = await getCmsUser();
  if (!cms) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Шапка по образцу Аккаунт-центра: лого + титул слева, чип роли + email справа. */}
      <header className="flex items-center gap-4 border-b border-lines-hover px-4 py-4 lg:px-8">
        <Link
          href="/"
          className="shrink-0 transition-all hover:brightness-125 focus-visible:outline-none"
        >
          <Image
            src="/icons/CTA-logo-hover.svg"
            alt="ЦТА"
            width={116}
            height={41}
            className="object-contain"
            priority
          />
        </Link>
        <span className="hidden h-8 w-px shrink-0 bg-lines-hover sm:block" />
        <h1 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary sm:text-base">
          Панель управления
        </h1>
        <span className="ml-auto flex shrink-0 items-center gap-2.5">
          <span className="inline-flex items-center rounded-xs border border-tactical-amber/30 bg-tactical-amber/10 px-1.5 py-0.5 font-blender-medium text-type-micro uppercase leading-none tracking-widest text-tactical-amber">
            {ROLE_LABELS[cms.role]}
          </span>
          <span className="hidden font-blender-book text-xs text-text-muted md:inline">
            {cms.email}
          </span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-275 grow px-4 py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
