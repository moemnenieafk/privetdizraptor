import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, FileText } from 'lucide-react';
import { getArticles } from '@/db/articles';

// «Обновления игры» — лента патчей. Источник: Steam News API (appid 3932890),
// официально и без ключа. Discord-канал BSG читать нельзя (нужен бот в их сервере),
// парсинг сайта хрупок.
//
// Полный текст патчноута НЕ зеркалим (контент BSG): заголовок, дата, выжимка, ссылка
// на первоисточник. Наша ценность сверху — «Разбор ЦТА» на русском: BSG публикует
// по-английски, объяснения «что это значит для игрока» нет ни у кого.
//
// Публичная страница (в отличие от анкет): это воронка в раздел, её должен видеть поиск.

export const metadata: Metadata = {
  title: 'Обновления игры · Связь · ЦТА',
  description: 'Патчи и обновления Escape from Tarkov с разбором на русском.',
};

export const revalidate = 3600;

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function GameUpdatesPage() {
  const patches = await getArticles('patch', 30);

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <img src="/icons/eft/00-nav/comlink-icon.svg" alt="" className="h-8 w-8" />
            <h1 className="font-blender-medium text-3xl uppercase tracking-widest text-text-primary">
              Обновления игры
            </h1>
          </div>
          <p className="max-w-xl font-blender-book text-sm text-text-secondary">
            Патчи Escape from Tarkov из официального источника. Где есть разбор ЦТА —
            объясняем по-русски, что изменилось для игрока.
          </p>
        </header>

        {patches.length === 0 ? (
          <p className="py-10 text-center font-blender-book text-sm text-text-secondary">
            Патчи ещё не синхронизированы.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {patches.map((p) => (
              <article
                key={p.id}
                className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4 transition-colors hover:border-(--primary)"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-blender-medium text-base uppercase tracking-widest text-text-primary">
                    {p.title}
                  </h2>
                  <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
                    {fmtDate(p.publishedAt)}
                  </span>
                </div>

                {p.excerpt && (
                  <p className="line-clamp-3 font-blender-book text-sm text-text-secondary">
                    {p.excerpt}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {p.hasBodyRu && (
                    <Link
                      href={`/eft/comlink/game-updates/${p.slug}`}
                      className="flex h-11 items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Разбор ЦТА
                    </Link>
                  )}

                  {p.externalUrl && (
                    <a
                      href={p.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Оригинал патчноута
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
