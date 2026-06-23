import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Материалы | Кодекс ЦТА' };

const CARDS = [
  { label: 'Аудиозаписи', href: '/eft/gamesetting/audiotapes', icon: '/icons/eft/05-gamesetting/audiotapes.svg', desc: 'Найденные в рейдах аудиозаписи и их расшифровки.' },
  { label: 'Документы и записки', href: '/eft/gamesetting/docs-notes', icon: '/icons/eft/05-gamesetting/docs-notes.svg', desc: 'Записки, документы и обрывки переписки из мира Таркова.' },
];

// Индекс «Материалы» — лендинг к Аудиозаписям и Документам. Перекрывает gamesetting/[slug].
export default function MaterialsIndexPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">Материалы</h1>
          <p className="mt-2 text-sm text-text-secondary font-blender-book">Внутриигровые улики: аудиозаписи, документы и записки, складывающиеся в общую картину.</p>
        </header>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex items-center gap-4 rounded-md border border-lines-hover bg-card-menu p-5 transition-colors hover:border-(--primary)"
            >
              <div
                className="h-9 w-9 shrink-0 mask-contain mask-center mask-no-repeat transition-colors"
                style={{ maskImage: `url(${c.icon})`, WebkitMaskImage: `url(${c.icon})`, backgroundColor: 'var(--color-text-muted)' }}
              />
              <div className="min-w-0">
                <h2 className="font-blender-medium uppercase tracking-wide text-text-primary transition-colors group-hover:text-(--primary)">{c.label}</h2>
                <p className="mt-0.5 text-sm text-text-secondary font-blender-book">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
