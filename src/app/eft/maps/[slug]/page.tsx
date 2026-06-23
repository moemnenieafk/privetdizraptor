import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';

interface Props {
  params: Promise<{ slug: string }>;
}

// Заглушка детальной карты локации. Реальный интерактив — Phase 4 (Leaflet).
export default async function MapPlaceholderPage({ params }: Props) {
  const { slug } = await params;
  const data = getSectionPlaceholder(`/eft/maps/${slug}`);
  if (!data) notFound();
  return <SectionPlaceholder {...data} />;
}
