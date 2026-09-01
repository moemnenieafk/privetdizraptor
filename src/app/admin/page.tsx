// Дашборд CMS. Состав разделов зависит от прав: редактор видит контент,
// администратор — ещё и каталог/системное. Карточки — HubCard (rectangle, NIGHTFALL-сетка),
// иконки брендовые (маска в монохром через iconPath). Титул — в шапке (layout).
import { getCmsUser } from "@/lib/auth/admin";
import { HubCard } from "@/components/ui/HubCard";

interface CmsLink {
  href: string;
  title: string;
  hint: string;
  icon: string; // путь к брендовой svg (HubCard маскирует в монохром)
}

const CONTENT_LINKS: CmsLink[] = [
  {
    href: "/eft/gamesetting",
    title: "Кодекс",
    hint: "Лор-статьи: правка прямо на странице статьи, кнопка «✎»",
    icon: "/icons/eft/00-nav/codex.svg",
  },
  {
    href: "/eft/quests/lore-quests",
    title: "Сюжетные гайды",
    hint: "10 историй: шаги, тексты, скриншоты — правка на странице гайда",
    icon: "/icons/eft/00-nav/lore-quests.svg",
  },
  {
    href: "/eft/comlink/blog",
    title: "Блог",
    hint: "Новости проекта и статьи — правка на самой странице раздела",
    icon: "/icons/eft/07-comlink/blog.svg",
  },
  {
    href: "/eft/comlink/masterclasses",
    title: "Мастер-классы",
    hint: "Анонсы и записи — дата события, ссылка на видео",
    icon: "/icons/eft/07-comlink/masterclasses.svg",
  },
  {
    href: "/eft/gamesetting/game-updates",
    title: "Обновления игры",
    hint: "Патчи из Steam приходят синком; вручную пишется наш разбор",
    icon: "/icons/eft/05-gamesetting/game-updates.svg",
  },
  {
    href: "/admin/comments",
    title: "Комментарии",
    hint: "Лента обсуждений по всему порталу: скрыть или вернуть в один тап",
    icon: "/icons/eft/00-nav/comlink-icon.svg",
  },
  {
    href: "/admin/anomalies",
    title: "Аномалии цен",
    hint: "Companion-цены с большим отклонением от tarkov.dev: принять/отклонить/бан",
    icon: "/icons/eft/profile-pannel/warning-attention-icon.svg",
  },
  {
    href: "/admin/media",
    title: "Медиа",
    hint: "Загрузка изображений: обложки, скриншоты гайдов, иллюстрации",
    icon: "/icons/eft/videos-icon.svg",
  },
];

const ADMIN_LINKS: CmsLink[] = [
  {
    href: "/admin/items",
    title: "Предметы",
    hint: "Каталог EFT: названия, цены, категории",
    icon: "/icons/eft/03-items/loot-tier.svg",
  },
  {
    href: "/admin/billing",
    title: "Биллинг и подписки",
    hint: "Тиры, пэйвол на разделы и фичи, выдача подписок",
    icon: "/icons/account_center/account_billing_icon.svg",
  },
  {
    href: "/admin/users",
    title: "Пользователи",
    hint: "Список игроков: роли, подписки — выдать, продлить, снять",
    icon: "/icons/account_center/account_profile_icon.svg",
  },
];

// Сетка карточек: rectangle = col-span-2. Мобилка 1/ряд, md 2/ряд (grid-cols-4), lg 3/ряд (grid-cols-6).
function CardGrid({ links }: { links: CmsLink[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-6">
      {links.map((l, i) => (
        <HubCard
          key={l.href}
          gameId="admin"
          id={l.href}
          title={l.title}
          description={l.hint}
          href={l.href}
          iconPath={l.icon}
          iconTooltip={l.title}
          variant="rectangle"
          index={i}
        />
      ))}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
        {children}
      </h2>
      <span className="h-px flex-1 bg-lines-hover" />
    </div>
  );
}

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const cms = await getCmsUser();
  if (!cms) return null; // layout уже увёл на /login — тут только для типов

  return (
    <div className="flex flex-col gap-10">
      {cms.canEditContent && (
        <section className="flex flex-col gap-4">
          <GroupLabel>Контент</GroupLabel>
          <CardGrid links={CONTENT_LINKS} />
          <p className="font-blender-book text-xs leading-relaxed text-text-muted">
            Материалы правятся прямо на своих страницах: кнопка создания и «✎» видны, пока вы
            в CMS-роли. Черновик виден только вам — включите режим черновика в плашке внизу.
          </p>
        </section>
      )}

      {cms.canManageCatalog && (
        <section className="flex flex-col gap-4">
          <GroupLabel>Каталог и система</GroupLabel>
          <CardGrid links={ADMIN_LINKS} />
        </section>
      )}
    </div>
  );
}
