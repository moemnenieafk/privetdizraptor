import type { Metadata } from 'next';
import { getMe } from '@/lib/auth/me';
import { getArticles } from '@/db/articles';
import { ArticleFeedClient } from '@/components/features/comlink/ArticleFeedClient';

// Мастер-классы: анонсы (с датой) и записи прошедших. Тот же движок comlink_articles,
// отличается kind + поля eventAt/videoUrl. Публичная страница.

export const metadata: Metadata = {
  title: 'Мастер-классы · Связь · ЦТА',
  description: 'Разборы, обучающие сессии и гайды от опытных игроков.',
};

export const revalidate = 300;

export default async function MasterclassesPage() {
  const [me, items] = await Promise.all([getMe(), getArticles('masterclass', 30)]);

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <img src="/icons/eft/00-nav/comlink-icon.svg" alt="" className="h-8 w-8" />
            <h1 className="font-blender-medium text-3xl uppercase tracking-widest text-text-primary">
              Мастер-классы
            </h1>
          </div>
          <p className="max-w-xl font-blender-book text-sm text-text-secondary">
            Анонсы сессий и записи разборов. Ближайшие — сверху, помечены датой.
          </p>
        </header>

        <ArticleFeedClient
          kind="masterclass"
          items={items}
          isAdmin={me?.role === 'admin'}
          emptyText="Мастер-классов пока нет. Анонсы появятся здесь."
        />
      </div>
    </main>
  );
}
