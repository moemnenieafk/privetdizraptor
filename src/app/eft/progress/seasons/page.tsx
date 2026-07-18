import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EFT_SEASONS } from '@/data/eft-seasons';
import { seasonPerks, personalPerks } from '@/lib/season-points';

export const metadata: Metadata = {
  title: 'Сезоны',
  description:
    'Сезоны Escape from Tarkov: механика сезонного персонажа и интерактивный конструктор модификаторов.',
};

const STATUS_LABEL: Record<string, string> = {
  announced: 'Анонсирован',
  live: 'Идёт',
  ended: 'Завершён',
};

export default function SeasonsHubPage() {
  return (
    <main className="flex w-full flex-col items-center pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader
          title="Сезоны"
          description="Сезонный персонаж — отдельный вызов с набором модификаторов. Собирайте билд перков в интерактивном конструкторе."
          iconClass="icon-eft-progress"
        />

        <div className="mt-8 flex flex-col gap-4">
          {EFT_SEASONS.map((s) => {
            const forced = seasonPerks(s).length;
            const personal = personalPerks(s).length;
            return (
              <article
                key={s.id}
                className="flex flex-col gap-5 rounded-sm border border-lines-hover bg-(--color-base) p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                      Сезон {s.number} · патч {s.patch}
                      {s.kickoffEvent ? ` · старт с события «${s.kickoffEvent}»` : ''}
                    </span>
                    <h2 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary">
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logoUrl} alt={s.name} className="h-11 w-auto" />
                      ) : (
                        s.name
                      )}
                    </h2>
                  </div>
                  <span className="rounded-xs border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-3 py-1 font-blender-medium text-type-micro uppercase tracking-widest text-(--primary)">
                    {STATUS_LABEL[s.status]} · от {s.minDays} дней
                  </span>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {s.summary.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2 font-blender-book text-sm leading-relaxed text-text-secondary"
                    >
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 bg-(--primary)" />
                      {line}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/eft/progress/seasons/perks?s=${s.slug}`}
                    className="flex h-11 items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
                  >
                    Конструктор перков
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <span className="font-blender-book text-xs text-text-muted">
                    {personal} личных модификаторов · {forced} сезонных
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
