import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';
import { getStoryQuest } from '@/data/story-quests';
import { StoryQuestGuide } from '@/components/features/quests/StoryQuestGuide';
import { QuestTraderList } from '@/components/features/quests/QuestTraderList';
import { getQuestsSiblings } from '@/lib/quests-nav';
import type { QuestsNavRow } from '@/components/features/quests/QuestsNavBar';
import { EFT_QUESTS } from '@/data/quests';
import type { TaskRaw } from '@/types/quest';

interface Props {
  params: Promise<{ slug: string }>;
}

// Слаги трейдеров из headerConfig (ветка «Побочные»).
const TRADER_SLUGS = new Set([
  'prapor', 'therapist', 'fence', 'skier', 'peacekeeper',
  'mechanic', 'ragman', 'jaeger', 'ref', 'lightkeeper', 'btr-driver',
]);

/** Задачи трейдера из EFT_QUESTS (btr-driver → btrdriver для портрета/цвета, как на карте). */
function traderTasks(slug: string): TaskRaw[] {
  const target = slug === 'btr-driver' ? 'btrdriver' : slug;
  return EFT_QUESTS
    .filter((t) => {
      const n = t.trader.normalizedName === 'btr-driver' ? 'btrdriver' : t.trader.normalizedName;
      return n === target;
    })
    .map((t) =>
      t.trader.normalizedName === 'btr-driver'
        ? { ...t, trader: { ...t.trader, normalizedName: 'btrdriver' } }
        : t,
    );
}

// Ветвление по типу узла:
//  - сюжетная глава → walkthrough-гайд;
//  - трейдер → список QuestNode (+ деталь в QuestDrawer);
//  - события / прочее → умная заглушка.
export default async function QuestSlugPage({ params }: Props) {
  const { slug } = await params;

  const { sections, siblings, parentLabel } = getQuestsSiblings(`/eft/quests/${slug}`);
  const navRows: QuestsNavRow[] = [
    { label: 'Навигация по разделу', tabs: sections },
    { label: parentLabel, tabs: siblings },
  ];

  const story = getStoryQuest(slug);
  if (story) return <StoryQuestGuide chapter={story} navRows={navRows} />;

  if (TRADER_SLUGS.has(slug)) {
    const tasks = traderTasks(slug);
    if (tasks.length > 0) {
      return (
        <QuestTraderList
          tasks={tasks}
          traderNormalized={slug === 'btr-driver' ? 'btrdriver' : slug}
          title={tasks[0].trader.name}
          navSections={sections}
          navTraders={siblings}
        />
      );
    }
  }

  const data = getSectionPlaceholder(`/eft/quests/${slug}`);
  if (!data) notFound();
  return <SectionPlaceholder {...data} />;
}
