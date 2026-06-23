import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';

// «Престиж». Реал — Phase 2.5.
export default function PrestigePlaceholderPage() {
  const data = getSectionPlaceholder('/eft/progress/prestige');
  if (!data) notFound();
  return <SectionPlaceholder {...data} />;
}
