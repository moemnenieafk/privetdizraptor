import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Скоро | ЦТА',
  description: 'Раздел в разработке — скоро будет доступен на портале ЦТА.',
};

/**
 * Заглушка «Скоро» — общий пункт назначения для ещё не построенных фич (ready:false)
 * из грида «Избранные разделы архетипа». Статична, без данных (§4.5): заголовок,
 * пара строк и возврат в Досье.
 */
export default function SoonPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="flex w-full max-w-275 flex-col items-center gap-6 px-4 py-24 text-center xl:px-0">
        <span className="icon-mask icon-eft-comlink-icon size-16 bg-text-muted" aria-hidden />
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-blender-medium uppercase tracking-widest text-text-primary">
            Раздел скоро
          </h1>
          <p className="text-type-caption font-blender-book leading-5 text-text-secondary">
            Эта фича ещё в разработке. Мы уже заложили её в каталог портала — как только раздел
            будет готов, он откроется здесь.
          </p>
        </div>
        <Link
          href="/eft/hub"
          className="inline-flex items-center gap-2 rounded-xs border border-lines-hover bg-card-menu px-4 py-2 text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="size-3" />
          Назад в Досье
        </Link>
      </div>
    </main>
  );
}
