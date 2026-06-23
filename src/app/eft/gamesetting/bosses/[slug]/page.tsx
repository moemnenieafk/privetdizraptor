import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBoss, BOSSES } from '@/data/bosses';
import { BossDetail } from '@/components/features/bosses/BossDetail';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return BOSSES.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const boss = getBoss(slug);
  return { title: boss ? `${boss.nameRu} | Боссы ЦТА` : 'Босс не найден | ЦТА' };
}

export default async function BossPage({ params }: Props) {
  const { slug } = await params;
  const boss = getBoss(slug);
  if (!boss) notFound();
  return <BossDetail boss={boss} />;
}
