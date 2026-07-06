import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionPlaceholder } from "@/components/ui/SectionPlaceholder";
import { COMLINK_BASE, COMLINK_ICON, COMLINK_SECTIONS, COMLINK_TABS } from "@/data/comlinkSections";

interface Props {
  params: Promise<{ section: string }>;
}

// Пререндерим только известные подпункты; прочее → 404.
export function generateStaticParams() {
  return COMLINK_SECTIONS.map((s) => ({ section: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const s = COMLINK_SECTIONS.find((x) => x.slug === section);
  if (!s) return { title: "Связь · ЦТА" };
  return { title: `${s.label} · Связь · ЦТА`, description: s.description, robots: { index: false, follow: true } };
}

export default async function ComlinkSectionPage({ params }: Props) {
  const { section } = await params;
  const s = COMLINK_SECTIONS.find((x) => x.slug === section);
  if (!s) notFound();

  return (
    <SectionPlaceholder
      title={s.label}
      description={s.description}
      iconUrl={COMLINK_ICON}
      tabs={COMLINK_TABS}
      activeHref={`${COMLINK_BASE}/${s.slug}`}
    />
  );
}
