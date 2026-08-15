import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { STORY_MAPS } from '@/data/story-walkthroughs/boreas-map';
import { STORY_WALKTHROUGHS } from '@/data/story-walkthroughs';
import { StoryQuestMap } from '@/components/features/quests/StoryQuestMap';

// Карта сюжетных квестов истории (Figma: boreas-quest-map) — интерактивный граф
// этапов с ветвлениями. Прогресс чеков общий с walkthrough-гайдом истории.
export default async function StoryQuestMapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const map = STORY_MAPS[slug];
  if (!map) notFound();
  const steps = STORY_WALKTHROUGHS[slug]?.steps.length;

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="mx-auto w-full max-w-275 px-4 xl:px-0">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href={`/eft/quests/${slug}`}
            className="inline-flex items-center gap-2 text-type-label uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
          >
            <ArrowLeft className="h-4 w-4" />
            К прохождению
          </Link>
        </div>

        <header className="mb-7 flex items-center gap-3">
          <span className={`h-10 w-10 shrink-0 icon-mask icon-eft-quests-story-${map.slug} bg-text-primary`} />
          <h1 className="font-blender-medium text-[1.75rem] uppercase tracking-widest text-text-primary">
            {map.title} — карта квеста
          </h1>
          {steps != null && (
            <span className="rounded-xs border border-lines-hover px-2 py-1 font-blender-medium text-sm text-text-secondary">
              {steps}
            </span>
          )}
        </header>

        <StoryQuestMap map={map} />
      </div>
    </main>
  );
}
