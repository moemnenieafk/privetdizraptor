import { notFound } from 'next/navigation';
import { EntityComments } from '@/components/features/comments/EntityComments';
import type { Metadata } from 'next';
import { getBoss } from '@/data/bosses';
import { BossDetail } from '@/components/features/bosses/BossDetail';

interface Props {
  params: Promise<{ slug: string }>;
}

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11),
// а SSG-on-demand невозможен — root-layout резолвит гейтинг через cookies(), что
// запрещено в статическом ISR-контексте (DYNAMIC_SERVER_USAGE). force-dynamic даёт
// динамический контекст: cookies() работает, БД читается в рантайме.
export const dynamic = "force-dynamic";

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
