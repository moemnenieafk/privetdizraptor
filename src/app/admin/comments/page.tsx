// Лента свежих комментариев по всему порталу. Без неё модератор не увидит, что
// написали под дальней страницей: обсуждение размазано по сборкам, патчам,
// Кодексу, боссам и торговцам, и обходить их руками невозможно.
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCmsUser } from "@/lib/auth/admin";
import { canModerate } from "@/lib/auth/roles";
import { getRecentComments } from "@/db/entity-comments";
import { targetLabel, targetUrl } from "@/lib/comment-targets";
import { ModerationRow } from "@/components/features/comments/ModerationRow";

export const dynamic = "force-dynamic";

export const metadata = { title: "Комментарии | Модерация ЦТА" };

export default async function AdminCommentsPage() {
  const user = await getCmsUser();
  if (!user || !canModerate(user.role)) notFound();

  const items = await getRecentComments(100);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary">
        Комментарии
      </h1>
      <p className="mt-2 font-blender-book text-sm text-text-secondary">
        Последние {items.length} по всему порталу. Скрытые остаются в списке — видно, что
        уже разобрано.
      </p>

      {items.length === 0 ? (
        <p className="mt-10 text-center font-blender-book text-sm text-text-secondary">
          Комментариев пока нет.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {items.map((c) => (
            <ModerationRow
              key={c.id}
              id={c.id}
              body={c.body}
              authorName={c.authorName}
              createdAt={c.createdAt}
              hidden={c.hidden}
              score={c.score}
              sectionLabel={targetLabel(c.targetType)}
              href={targetUrl(c.targetType, c.targetId)}
            />
          ))}
        </ul>
      )}

      <Link
        href="/admin"
        className="mt-8 inline-block font-blender-medium text-xs uppercase tracking-widest text-text-secondary hover:text-(--primary)"
      >
        ← В админку
      </Link>
    </main>
  );
}
