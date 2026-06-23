import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';

interface Props {
  params: Promise<{ slug: string }>;
}

// Заглушка раздела Кодекса. Phase 3: боссы (HP по зонам + лор) и торговцы — первыми.
export default async function CodexPlaceholderPage({ params }: Props) {
  const { slug } = await params;
  const data = getSectionPlaceholder(`/eft/gamesetting/${slug}`);
  if (!data) notFound();
  return <SectionPlaceholder {...data} />;
}
