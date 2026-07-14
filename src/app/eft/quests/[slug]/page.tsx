import { notFound } from 'next/navigation';
import { draftMode } from 'next/headers';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';
import { getStory } from '@/db/stories';
import { getMe } from '@/lib/auth/me';
import { canEditContent } from '@/lib/auth/roles';
import { StoryWalkthroughEditable } from '@/components/features/quests/StoryWalkthroughEditable';
import { QuestsHubNav } from '@/components/features/quests/QuestsHubNav';
import { getEftPricesByIds } from '@/db/prices';
import { QuestTraderList } from '@/components/features/quests/QuestTraderList';
import { getQuestsSiblings } from '@/lib/quests-nav';
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

  // Walkthrough-гайд: истории живут в БД (E10, фаза 5) с фолбэком на src/data,
  // пока миграция не накатана. Черновик виден только контентной роли.
  const [me, { isEnabled }] = await Promise.all([getMe(), draftMode()]);
  const canEdit = canEditContent(me?.role ?? 'user');

  const record = await getStory(slug, isEnabled && canEdit);
  const walkthrough = record?.doc;
  if (record && walkthrough) {
    // Актуальные цены предметов условий — из НАШЕГО зеркала (RSC).
    const itemIds = walkthrough.steps.flatMap((s) =>
      s.blocks.flatMap((b) => [
        ...(b.priceNote ? [b.priceNote.itemId] : []),
        ...(b.condition?.item ? [b.condition.item.id] : []),
      ]),
    );
    const priceMap = await getEftPricesByIds([...new Set(itemIds)]);
    const priceByItemId: Record<string, number | null> = {};
    for (const id of itemIds) {
      const p = priceMap.get(id);
      priceByItemId[id] = p?.lastLowPrice ?? p?.avg24hPrice ?? null;
    }

    return (
      <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
        <div className="mx-auto w-full max-w-275 px-4 xl:px-0">
          {/* Единая навигация раздела «Задания» — как на побочных (QuestsHubNav):
              слева иконка+заголовок+счётчик шагов, справа разделы + истории-соседи. */}
          <QuestsHubNav
            iconUrl={walkthrough.iconUrl}
            title={walkthrough.title}
            count={walkthrough.steps.length}
            description={`Прохождение сюжета по шагам · сложность: ${walkthrough.difficulty.label}`}
            tabs={sections}
            subTabs={siblings}
            subLabel={parentLabel}
            activeHref={`/eft/quests/${slug}`}
          />
          <StoryWalkthroughEditable
            story={walkthrough}
            priceByItemId={priceByItemId}
            published={record.published}
            fromStatic={record.fromStatic}
            canEdit={canEdit}
          />
        </div>
      </main>
    );
  }

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
