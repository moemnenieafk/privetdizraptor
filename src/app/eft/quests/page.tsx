import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';
import { getQuestsNav } from '@/lib/quests-nav';
import { QuestsHubNav } from '@/components/features/quests/QuestsHubNav';

export default function QuestsHubPage() {
  const { sections } = getQuestsNav('/eft/quests');
  const pageContent = PAGE_CONTENT_DICTIONARY['eft-quests'];

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <QuestsHubNav
          iconClass={pageContent?.iconClass}
          title={pageContent?.title ?? 'Задания'}
          description={pageContent?.description}
          tabs={sections}
        />
      </div>
    </main>
  );
}
