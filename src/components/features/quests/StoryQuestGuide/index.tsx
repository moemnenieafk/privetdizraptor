import type { StoryQuestChapter, StorySection } from '@/types/story-quest';

function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function SectionBlock({ section }: { section: StorySection }) {
  if (section.type === 'text') {
    return (
      <section className="mb-8">
        {section.heading && (
          <h2 className="mb-3 text-lg font-blender-medium uppercase tracking-widest text-text-primary">{section.heading}</h2>
        )}
        <div className="flex flex-col gap-3">
          {section.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-text-secondary font-blender-book">{p}</p>
          ))}
        </div>
      </section>
    );
  }

  if (section.type === 'steps') {
    return (
      <section className="mb-8">
        {section.heading && (
          <h2 className="mb-4 text-lg font-blender-medium uppercase tracking-widest text-text-primary">{section.heading}</h2>
        )}
        <ol className="flex flex-col gap-3">
          {section.steps.map((s, i) => (
            <li key={i} className="flex gap-4 rounded-md border border-lines-hover bg-card-menu p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-sm font-blender-medium text-(--primary)">
                {i + 1}
              </span>
              <div>
                {s.title && <p className="mb-1 text-sm font-blender-medium uppercase tracking-wide text-text-primary">{s.title}</p>}
                <p className="text-sm leading-relaxed text-text-secondary font-blender-book">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (section.type === 'items') {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-blender-medium uppercase tracking-widest text-text-primary">{section.heading}</h2>
        {section.note && <p className="mb-3 text-sm text-text-secondary font-blender-book">{section.note}</p>}
        <div className="overflow-hidden rounded-md border border-lines-hover">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-card-menu text-type-caption uppercase tracking-widest text-text-muted">
                <th className="px-4 py-2 font-blender-medium">Предмет</th>
                <th className="px-4 py-2 font-blender-medium">Кол-во</th>
                <th className="px-4 py-2 font-blender-medium">Статус</th>
                <th className="px-4 py-2 font-blender-medium">Где искать</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((r, i) => (
                <tr key={i} className="border-t border-lines-hover last:border-b-0">
                  <td className="px-4 py-2 font-blender-medium text-text-primary">{r.item}</td>
                  <td className="px-4 py-2 text-text-secondary">{r.count ?? '—'}</td>
                  <td className="px-4 py-2 text-text-secondary">{r.status ?? '—'}</td>
                  <td className="px-4 py-2 text-text-secondary font-blender-book">{r.location ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // decision
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-blender-medium uppercase tracking-widest text-(--primary)">{section.heading}</h2>
      {section.note && <p className="mb-4 text-sm text-text-secondary font-blender-book">{section.note}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {section.options.map((o, i) => (
          <div key={i} className="flex flex-col rounded-md border border-lines-hover bg-card-menu p-5">
            <h3 className="mb-2 text-sm font-blender-medium uppercase tracking-wide text-text-primary">{o.label}</h3>
            <p className="mb-3 flex-1 text-sm leading-relaxed text-text-secondary font-blender-book">{o.consequence}</p>
            {o.reward && (
              <p className="text-type-caption uppercase tracking-widest text-(--primary)">{o.reward}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function StoryQuestGuide({ chapter }: { chapter: StoryQuestChapter }) {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-16">
      <div className="w-full max-w-275 px-4 xl:px-0">

        {/* HERO — заглушка (изображение появится позже) */}
        <header className="relative mb-10 overflow-hidden rounded-md border border-lines-hover bg-(--color-darkbase)">
          <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--primary)_14%,transparent)] via-transparent to-transparent" />
          <span className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 select-none text-[160px] font-blender-medium leading-none text-lines-hover opacity-30">
            {chapter.chapterNumber}
          </span>
          <div className="relative z-10 flex flex-col gap-3 p-8">
            <span className="text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">
              Глава {chapter.chapterNumber}
            </span>
            <h1 className="text-3xl md:text-4xl font-blender-medium uppercase tracking-widest text-text-primary">
              {chapter.titleRu}
            </h1>
            <p className="text-sm uppercase tracking-widest text-text-muted">{chapter.titleEn}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {chapter.difficulty && (
                <span className="rounded border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-0.5 text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">
                  Сложность: {chapter.difficulty}
                </span>
              )}
              {chapter.prerequisites?.map((p, i) => (
                <span key={i} className="rounded border border-lines-hover bg-card-menu px-2 py-0.5 text-type-caption font-blender-book text-text-secondary">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Вступление */}
        <p className="mb-8 text-base leading-relaxed text-text-secondary font-blender-book">{chapter.summary}</p>

        {/* Активация */}
        {chapter.activation && (
          <div className="mb-10 rounded-md border-l-2 border-(--primary) bg-card-menu p-4">
            <p className="mb-1 text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">Активация задания</p>
            <p className="text-sm leading-relaxed text-text-secondary font-blender-book">{chapter.activation}</p>
          </div>
        )}

        {/* Walkthrough-секции */}
        {chapter.sections.map((s, i) => (
          <SectionBlock key={i} section={s} />
        ))}

        {/* Награды / достижение */}
        {(chapter.rewards?.length || chapter.achievement) && (
          <section className="mb-10 rounded-md border border-lines-hover bg-card-menu p-5">
            <h2 className="mb-3 text-lg font-blender-medium uppercase tracking-widest text-text-primary">Награды</h2>
            {chapter.rewards?.map((r, i) => (
              <p key={i} className="text-sm text-text-secondary font-blender-book">• {r}</p>
            ))}
            {chapter.achievement && (
              <p className="mt-3 text-type-caption uppercase tracking-widest text-(--primary)">🏆 Достижение: {chapter.achievement}</p>
            )}
          </section>
        )}

        {/* Видео-гайды */}
        {chapter.videoGuides && chapter.videoGuides.length > 0 && (
          <section className="mb-4">
            <h2 className="mb-4 text-lg font-blender-medium uppercase tracking-widest text-text-primary">Видео-гайд</h2>
            <div className="flex flex-col gap-6">
              {chapter.videoGuides.map((v, i) => {
                const embed = youtubeEmbed(v.url);
                if (!embed) return null;
                return (
                  <div key={i} className="overflow-hidden rounded-md border border-lines-hover bg-(--color-darkbase)">
                    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                      <iframe
                        src={embed}
                        title={v.title ?? `Видео-гайд ${i + 1}`}
                        loading="lazy"
                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0 h-full w-full"
                      />
                    </div>
                    {v.title && <p className="px-4 py-3 text-sm font-blender-book text-text-secondary">{v.title}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
