import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { getMe } from '@/lib/auth/me';
import { getArticles } from '@/db/articles';
import { canEditContent } from '@/lib/auth/roles';
import { ArticleFeedClient } from '@/components/features/comlink/ArticleFeedClient';

// Блог ЦТА: новости проекта, статьи, объявления. Публичная страница — воронка в раздел.
// CMS показывается только role=admin (решает СЕРВЕР).

export const metadata: Metadata = {
  title: 'Блог · Связь · ЦТА',
  description: 'Новости проекта ЦТА, статьи и объявления сообщества.',
};

export const revalidate = 300;

export default async function BlogPage() {
  // Черновики видит только CMS-роль и только при включённом режиме черновика.
  const [me, { isEnabled }] = await Promise.all([getMe(), draftMode()]);
  const canEdit = canEditContent(me?.role ?? 'user');
  const items = await getArticles('news', 30, isEnabled && canEdit);

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <img src="/icons/eft/00-nav/comlink-icon.svg" alt="" className="h-8 w-8" />
            <h1 className="font-blender-medium text-3xl uppercase tracking-widest text-text-primary">
              Новостной блог
            </h1>
          </div>
          <p className="max-w-xl font-blender-book text-sm text-text-secondary">
            Что нового в ЦТА: фичи портала, разборы, объявления сообщества.
          </p>
        </header>

        <ArticleFeedClient
          kind="news"
          items={items}
          canEdit={canEdit}
          emptyText="Статей пока нет."
        />
      </div>
    </main>
  );
}
