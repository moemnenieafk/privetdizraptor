import { notFound } from 'next/navigation';
import { EntityComments } from '@/components/features/comments/EntityComments';
import type { Metadata } from 'next';
import { getTrader, TRADERS } from '@/data/traders';
import { TraderDetail } from '@/components/features/traders/TraderDetail';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return TRADERS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = getTrader(slug);
  return { title: t ? `${t.nameRu} | Торговцы ЦТА` : 'Торговец не найден | ЦТА' };
}

export default async function TraderPage({ params }: Props) {
  const { slug } = await params;
  const trader = getTrader(slug);
  if (!trader) notFound();
  return (
    <>
      <TraderDetail trader={trader} />
      <div className="mx-auto w-full max-w-5xl px-4 pb-10">
        <EntityComments type="trader" id={slug} />
      </div>
    </>
  );
}
