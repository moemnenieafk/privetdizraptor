import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';

interface Props {
  params: Promise<{ category: string }>;
}

// Заглушка категории видео (гайды/советы/новости/стримы).
export default async function VideoCategoryPlaceholderPage({ params }: Props) {
  const { category } = await params;
  const data = getSectionPlaceholder(`/eft/videos/${category}`);
  if (!data) notFound();
  return <SectionPlaceholder {...data} />;
}
