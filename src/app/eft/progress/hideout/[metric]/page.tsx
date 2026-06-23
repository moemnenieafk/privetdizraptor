import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';

interface Props {
  params: Promise<{ metric: string }>;
}

// Заглушка экономики убежища (craft-profit / bitcoin-profit). Реал — Phase 2.2/2.3.
// Статический /eft/progress/hideout/modules имеет приоритет над этим [metric].
export default async function HideoutMetricPlaceholderPage({ params }: Props) {
  const { metric } = await params;
  const data = getSectionPlaceholder(`/eft/progress/hideout/${metric}`);
  if (!data) notFound();
  return <SectionPlaceholder {...data} />;
}
