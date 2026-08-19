import { notFound } from 'next/navigation';
import { EntityComments } from '@/components/features/comments/EntityComments';
import { draftMode } from 'next/headers';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';
import { getCodex } from '@/db/codex';
import { getMe } from '@/lib/auth/me';
import { canEditContent } from '@/lib/auth/roles';
import { CodexArticleView } from '@/components/features/codex/CodexArticleView';

interface Props {
  params: Promise<{ slug: string }>;
}

// Ветвление Кодекса: есть статья-лор → шаблон CodexArticle; иначе — умная заглушка.
// Статьи теперь живут в БД (E10, фаза 3) с фолбэком на src/data/codex, пока миграция
// не накатана. Черновики видит только контентная роль в режиме черновика.
export default async function CodexSlugPage({ params }: Props) {
  const { slug } = await params;

  const [me, { isEnabled }] = await Promise.all([getMe(), draftMode()]);
  const canEdit = canEditContent(me?.role ?? 'user');

  const record = await getCodex(slug, isEnabled && canEdit);
  if (record) {
    return (
      <>
        <CodexArticleView
          article={record.doc}
          published={record.published}
          fromStatic={record.fromStatic}
          canEdit={canEdit}
        />
        {/* Обсуждение только у реальной статьи: заглушки разделов ветку не получают. */}
        <div className="mx-auto w-full max-w-5xl px-4 pb-10">
          <EntityComments type="codex" id={slug} />
        </div>
      </>
    );
  }

  const data = getSectionPlaceholder(`/eft/gamesetting/${slug}`);
  if (!data) notFound();
  // Навигацию (full-hubnav) даёт layout Кодекса (SectionLayoutNav) — заглушка только контент.
  return <SectionPlaceholder {...data} hideHeader />;
}
