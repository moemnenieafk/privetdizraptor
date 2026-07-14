import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { EFT_QUESTS } from '@/data/quests';
import { getBartersByQuest } from '@/db/barter-quest';
import { QuestDetail } from '@/components/features/quests/QuestDetail';
import { QuestsNavBar, type QuestsNavRow } from '@/components/features/quests/QuestsNavBar';
import { getQuestsSiblings } from '@/lib/quests-nav';
import { getQuestEvent } from '@/lib/eft-event-content';
import { formatEventDate } from '@/lib/eft-events-utils';
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

  const bartersByQuest = await getBartersByQuest();

  // Метка ивента: квест пришёл вместе с внутриигровым событием и остался в игре.
  const questEvent = getQuestEvent(task.normalizedName);

  const traderSlug = task.trader.normalizedName;
  const { sections, siblings, parentLabel } = getQuestsSiblings(`/eft/quests/${traderSlug}`);
  const navRows: QuestsNavRow[] = [
    { label: 'Навигация по разделу', tabs: sections },
    { label: parentLabel, tabs: siblings },
  ];

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
        <QuestsNavBar rows={navRows} activeHref={`/eft/quests/${traderSlug}`} />

        {questEvent && (
          <Link
            href={`/eft/quests/events#${questEvent.id}`}
            className="mt-6 flex items-center gap-2 rounded border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-3 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
          >
            <span className="font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
              Ивент · {questEvent.title}
            </span>
            <span className="font-blender-medium text-xs uppercase tracking-widest text-text-muted">
              {formatEventDate(questEvent.date)}
            </span>
          </Link>
        )}

        <QuestDetail task={normalizeTrader(task)} variant="page" barters={bartersByQuest[task.id]} />
      </div>
    </main>
  );
}
