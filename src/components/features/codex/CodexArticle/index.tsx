import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { CodexArticle as CodexArticleType } from '@/types/codex';
import { SectionHubNav } from '@/components/features/navigation/SectionHubNav';

/** Статья кодекса: шапка-глиф, лид, опц. таймлайн, секции, связанное, источники. */
export function CodexArticle({ article }: { article: CodexArticleType }) {
  const { title, subtitle, icon, intro, sections, timeline, related, sources, confidence } = article;

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pb-14">
      <SectionHubNav rootPath="/eft/gamesetting" variant="bar" widthClass="max-w-3xl" />
      <div className="w-full max-w-3xl px-4 mt-6 xl:px-0">
        <Link
          href="/eft/gamesetting"
          className="mb-5 inline-flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Кодекс
        </Link>

        {/* Шапка */}
        <header className="mb-7 flex items-start gap-4 border-b border-lines-hover pb-6">
          {icon && (
            <div
              className="mt-1 h-10 w-10 shrink-0 mask-contain mask-center mask-no-repeat"
              style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})`, backgroundColor: 'var(--primary)' }}
            />
          )}
          <div className="min-w-0">
            <h1 className="text-[1.75rem] font-blender-medium uppercase leading-none tracking-widest text-text-primary">{title}</h1>
            {subtitle && <p className="mt-2 text-sm uppercase tracking-widest text-text-muted font-blender-medium">{subtitle}</p>}
          </div>
        </header>

        {/* Лид */}
        <p className="mb-8 text-lg leading-relaxed text-text-secondary font-blender-book">{intro}</p>

        {/* Таймлайн */}
        {timeline && timeline.length > 0 && (
          <ol className="relative mb-10 ml-3 flex flex-col gap-7 border-l border-lines-hover pl-6">
            {timeline.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-(--primary) bg-(--color-base)" />
                <div className="font-blender-medium text-type-caption uppercase tracking-widest text-(--primary)">{e.date}</div>
                <div className="mt-0.5 font-blender-medium uppercase tracking-wide text-text-primary">{e.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary font-blender-book">{e.text}</p>
              </li>
            ))}
          </ol>
        )}

        {/* Секции */}
        <div className="flex flex-col gap-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="mb-3 font-blender-medium uppercase tracking-widest text-text-primary">{s.heading}</h2>
              <div className="flex flex-col gap-3">
                {s.body.map((p, j) => (
                  <p key={j} className="text-sm leading-relaxed text-text-secondary font-blender-book">{p}</p>
                ))}
              </div>
              {s.bullets && s.bullets.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm leading-relaxed text-text-secondary font-blender-book">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-(--primary)" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Связанное */}
        {related && related.length > 0 && (
          <div className="mt-10 border-t border-lines-hover pt-6">
            <div className="mb-3 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">Связанное</div>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="rounded border border-lines-hover bg-card-menu px-3 py-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Источники / достоверность */}
        {(sources?.length || confidence) && (
          <p className="mt-8 text-type-caption uppercase tracking-widest text-text-muted/70 font-blender-medium">
            {confidence === 'mixed' ? 'Лор + отмеченные версии сообщества' : 'Каноничный лор'}
            {sources?.length ? ` · ${sources.join(', ')}` : ''}
          </p>
        )}
      </div>
    </main>
  );
}
