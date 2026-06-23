import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';

interface Props {
  params: Promise<{ action: string }>;
}

// Заглушка подразделов сборок оружия (мои / найти / создать).
export default async function LoadoutsActionPlaceholderPage({ params }: Props) {
  const { action } = await params;
  const data = getSectionPlaceholder(`/eft/progress/loadouts/${action}`);
  if (!data) notFound();
  return <SectionPlaceholder {...data} />;
}
