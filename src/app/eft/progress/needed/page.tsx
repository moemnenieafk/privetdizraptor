import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';

// «Нужные предметы» (мёртвая карточка хаба). Реал — Phase 2.4.
export default function NeededItemsPlaceholderPage() {
  const data = getSectionPlaceholder('/eft/progress/needed');
  if (!data) notFound();
  return <SectionPlaceholder {...data} />;
}
