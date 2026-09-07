import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, TriangleAlert } from 'lucide-react';
import {
  LEGAL_DOCS,
  LEGAL_DOC_ORDER,
  LEGAL_CONTACT,
  requisitesFilled,
} from '@/data/legal-docs';

/**
 * Хаб юридических документов — единая точка входа на всё, что нужно для приёма платежей:
 * оферта, реквизиты продавца, условия, политика конфиденциальности, соглашение.
 *
 * Нужен отдельной страницей, потому что при подключении кассы проверяющие ищут раздел
 * с документами, а не разрозненные ссылки в подвале. Заодно видно, что ещё черновик.
 */

export const metadata: Metadata = {
  title: 'Документы — ЦТА',
  description:
    'Юридические документы ЦТА: публичная оферта, реквизиты продавца, условия использования, политика конфиденциальности.',
};

interface DocCard {
  href: string;
  title: string;
  short: string;
  draft: boolean;
}

export default function LegalIndexPage() {
  const reqReady = requisitesFilled();

  const cards: DocCard[] = [
    {
      href: '/legal/requisites',
      title: 'Реквизиты',
      short: 'Сведения о продавце, состав и стоимость услуг, порядок оплаты и возврата.',
      draft: !reqReady,
    },
    ...LEGAL_DOC_ORDER.map((slug) => {
      const d = LEGAL_DOCS[slug];
      return { href: `/legal/${slug}`, title: d.title, short: d.short, draft: d.draft };
    }),
  ];

  const drafts = cards.filter((c) => c.draft).length;

  return (
    <main className="flex w-full flex-col items-center pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          На главную
        </Link>

        <h1 className="font-blender-medium text-type-h2 uppercase tracking-widest text-text-primary">
          Документы
        </h1>
        <p className="mt-2 max-w-2xl font-blender-book text-type-body text-text-secondary">
          Правовые документы портала и сведения о продавце.
        </p>

        {drafts > 0 && (
          <div className="mt-6 flex items-start gap-3 rounded-sm border-[0.5px] border-tactical-amber/50 bg-tactical-amber/10 px-4 py-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-tactical-amber" />
            <p className="font-blender-medium text-type-caption leading-relaxed text-tactical-amber">
              Часть документов ещё в работе и отмечена как черновик. Приём платежей не
              запускается, пока они не опубликованы в действующей редакции.
            </p>
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col gap-3 rounded-lg border border-lines-hover bg-card-menu p-6 transition-all duration-300 hover:border-(--primary)/50 hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--primary)_15%,transparent)]"
            >
              <div className="flex items-start justify-between gap-3">
                <FileText
                  className="h-5 w-5 shrink-0 text-text-muted transition-colors group-hover:text-(--primary)"
                  aria-hidden
                />
                {c.draft && (
                  <span className="shrink-0 rounded-xs border border-tactical-amber/40 bg-tactical-amber/10 px-2 py-0.5 font-blender-medium text-type-micro uppercase tracking-widest text-tactical-amber">
                    Черновик
                  </span>
                )}
              </div>
              <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
                {c.title}
              </h2>
              <p className="font-blender-book text-type-caption leading-relaxed text-text-secondary">
                {c.short}
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-8 font-blender-book text-type-caption text-text-muted">
          Вопросы по документам — {LEGAL_CONTACT.email}.
        </p>
      </div>
    </main>
  );
}
