// Защита всей зоны /admin: пускает только role='admin', иначе → /login.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdmin();
  if (!admin) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-275 px-4 py-10">
      <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
        <Link
          href="/admin"
          className="font-blender-medium text-lg uppercase tracking-widest text-(--primary)"
        >
          ЦТА · CMS
        </Link>
        <span className="font-blender-book text-xs text-white/50">{admin.email}</span>
      </header>
      {children}
    </main>
  );
}
