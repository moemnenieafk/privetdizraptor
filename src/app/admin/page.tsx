// Дашборд CMS. Состав разделов зависит от прав: редактор видит контент,
// администратор — ещё и каталог/системное.
import Link from "next/link";
import { getCmsUser } from "@/lib/auth/admin";

interface CmsLink {
  href: string;
  title: string;
  hint: string;
}

const CONTENT_LINKS: CmsLink[] = [
  {
    href: "/eft/gamesetting",
    title: "Кодекс",
    hint: "Лор-статьи: правка прямо на странице статьи, кнопка «✎»",
  },
  {
    href: "/eft/comlink/blog",
    title: "Блог",
    hint: "Новости проекта и статьи — правка на самой странице раздела",
  },
  {
    href: "/eft/comlink/masterclasses",
    title: "Мастер-классы",
    hint: "Анонсы и записи — дата события, ссылка на видео",
  },
  {
    href: "/eft/comlink/game-updates",
    title: "Обновления игры",
    hint: "Патчи из Steam приходят синком; вручную пишется наш разбор",
  },
];

const ADMIN_LINKS: CmsLink[] = [
  {
    href: "/admin/items",
    title: "Предметы",
    hint: "Каталог EFT: названия, цены, категории",
  },
];

function LinkCard({ href, title, hint }: CmsLink) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xs border border-white/15 px-4 py-3 transition-colors hover:border-(--primary)"
    >
      <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
        {title} →
      </span>
      <span className="font-blender-book text-xs text-white/50">{hint}</span>
    </Link>
  );
}

export default async function AdminHome() {
  const cms = await getCmsUser();
  if (!cms) return null; // layout уже увёл на /login — тут только для типов

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-blender-medium text-xl uppercase tracking-widest">Панель управления</h1>

      {cms.canEditContent && (
        <section className="flex flex-col gap-3">
          <h2 className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Контент
          </h2>
          <nav className="flex flex-col gap-2">
            {CONTENT_LINKS.map((l) => (
              <LinkCard key={l.href} {...l} />
            ))}
          </nav>
          <p className="font-blender-book text-xs text-white/40">
            Материалы правятся прямо на своих страницах: кнопка создания и «✎» видны, пока вы
            в CMS-роли. Черновик виден только вам — включите режим черновика в плашке внизу.
          </p>
        </section>
      )}

      {cms.canManageCatalog && (
        <section className="flex flex-col gap-3">
          <h2 className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Каталог и система
          </h2>
          <nav className="flex flex-col gap-2">
            {ADMIN_LINKS.map((l) => (
              <LinkCard key={l.href} {...l} />
            ))}
          </nav>
        </section>
      )}
    </div>
  );
}
