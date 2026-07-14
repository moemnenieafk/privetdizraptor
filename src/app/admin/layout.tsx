// Защита зоны /admin: пускает admin и editor, иначе → /login.
// Разделы внутри гейтятся по правам (каталог — только admin), см. AdminHome и /admin/items.
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
    <main className="mx-auto w-full max-w-275 px-4 py-10">
      <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
        <Link
          href="/admin"
          className="font-blender-medium text-lg uppercase tracking-widest text-(--primary)"
        >
          ЦТА · CMS
        </Link>
        <span className="flex items-center gap-3 font-blender-book text-xs text-white/50">
          <span className="rounded-xs border border-white/15 px-2 py-0.5 font-blender-medium uppercase tracking-widest text-(--primary)">
            {ROLE_LABELS[cms.role]}
          </span>
          {cms.email}
        </span>
      </header>
      {children}
    </main>
  );
}
