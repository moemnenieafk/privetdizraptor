// Дашборд CMS.
import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-blender-medium text-xl uppercase tracking-widest">
        Панель управления
      </h1>
      <nav className="flex flex-col gap-2">
        <Link
          href="/admin/items"
          className="rounded-xs border border-white/15 px-4 py-3 font-blender-book text-sm hover:border-(--primary)"
        >
          Предметы — каталог EFT (правка названий, цен, категорий) →
        </Link>
      </nav>
    </div>
  );
}
