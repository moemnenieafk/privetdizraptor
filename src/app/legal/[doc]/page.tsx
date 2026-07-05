import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { LEGAL_DOCS, LEGAL_DOC_ORDER, type LegalSlug } from "@/data/legal-docs";

interface Props {
  params: Promise<{ doc: string }>;
}

export function generateStaticParams() {
  return LEGAL_DOC_ORDER.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  const d = LEGAL_DOCS[doc as LegalSlug];
  if (!d) return { title: "Документ не найден · ЦТА" };
  // Черновики не индексируем, пока не будет реального текста.
  return { title: `${d.title} · ЦТА`, description: d.short, robots: { index: false, follow: true } };
}

export default async function LegalPage({ params }: Props) {
  const { doc } = await params;
  const d = LEGAL_DOCS[doc as LegalSlug];
  if (!d) notFound();

  return (
    <main className="flex w-full flex-col items-center pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-3xl px-4">

        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          На главную
        </Link>

        <h1 className="font-blender-medium text-type-h2 uppercase tracking-widest text-text-primary">
          {d.title}
        </h1>
        <p className="mt-2 font-blender-book text-type-body text-text-secondary">{d.short}</p>

        {/* Баннер-черновик */}
        <div className="mt-6 flex items-start gap-3 rounded-sm border-[0.5px] border-tactical-amber/50 bg-tactical-amber/10 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-tactical-amber" />
          <p className="font-blender-medium text-type-caption leading-relaxed text-tactical-amber">
            ЧЕРНОВИК. Документ в разработке и <span className="uppercase">не имеет юридической силы</span>.
            Ниже — структура-заготовка; финальный текст будет опубликован позднее.
          </p>
        </div>

        {/* Разделы-скелет */}
        <div className="mt-10 flex flex-col gap-8">
          {d.sections.map((s) => (
            <section key={s.h}>
              <h2 className="font-blender-medium text-type-h4 uppercase tracking-wider text-text-primary">
                {s.h}
              </h2>
              <p className="mt-2 font-blender-book text-type-body leading-relaxed text-text-secondary">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        {/* Кросс-линки на остальные документы */}
        <div className="mt-14 border-t border-lines-hover pt-6">
          <p className="mb-3 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Правовые документы
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {LEGAL_DOC_ORDER.map((slug) => (
              <Link
                key={slug}
                href={`/legal/${slug}`}
                className={`font-blender-medium text-type-caption uppercase tracking-wide transition-colors ${
                  slug === d.slug ? "text-(--primary)" : "text-text-muted hover:text-(--primary)"
                }`}
              >
                {LEGAL_DOCS[slug].title}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
