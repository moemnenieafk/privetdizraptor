import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { EFT_QUESTS } from '@/data/quests';
import { QuestDetail } from '@/components/features/quests/QuestDetail';
import type { TaskRaw } from '@/types/quest';

interface Props {
  params: Promise<{ id: string }>;
}

/** btr-driver → btrdriver для портрета/цвета трейдера, как на карте. */
function normalizeTrader(task: TaskRaw): TaskRaw {
  return task.trader.normalizedName === 'btr-driver'
    ? { ...task, trader: { ...task.trader, normalizedName: 'btrdriver' } }
    : task;
}

export default async function QuestTaskPage({ params }: Props) {
  const { id } = await params;
  const task = EFT_QUESTS.find((t) => t.id === id);
  if (!task) notFound();

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-3xl px-4">
        <Link
          href="/eft/quests"
          className="mb-4 inline-flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Квесты
        </Link>
        <QuestDetail task={normalizeTrader(task)} variant="page" />
      </div>
    </main>
  );
}
