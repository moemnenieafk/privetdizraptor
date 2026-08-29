import { notFound } from 'next/navigation';
import { EntityComments } from '@/components/features/comments/EntityComments';
import type { Metadata } from 'next';
import { getBoss } from '@/data/bosses';
import { BossDetail } from '@/components/features/bosses/BossDetail';

interface Props {
  params: Promise<{ slug: string }>;
}

// ISR on-demand: не пререндерим на сборке (рендер тянет цены лоадаута босса из БД
// через BossDetail→BossItemLoadout, а порт 5432 закрыт наружу → БД на билде нет,
// §4.11). Слуг рендерится по первому запросу и кэшируется на час.
export const revalidate = 3600;

export function generateStaticParams(): { slug: string }[] {
  return [];
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
  return (
    <>
      <BossDetail boss={boss} />
      <div className="mx-auto w-full max-w-5xl px-4 pb-10">
        <EntityComments type="boss" id={slug} />
      </div>
    </>
  );
}
