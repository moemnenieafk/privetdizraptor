import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';
import { getQuestsNav } from '@/lib/quests-nav';
import { PageHeader } from '@/components/ui/PageHeader';
import { HubCard } from '@/components/ui/HubCard';

export default function QuestsHubPage() {
  const { sections } = getQuestsNav('/eft/quests');

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-4 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-quests" />

        {/* Верхний уровень раздела: карточки Сюжетные / Побочные / События (единый источник — getQuestsNav) */}
        <div className="tactical-grid">
          {sections.map((section, index) => {
            const contentKey = section.href.replace(/^\//, '').replace(/\//g, '-');
            const content = PAGE_CONTENT_DICTIONARY[contentKey];
            return (
              <HubCard
                key={section.id}
                gameId="eft"
                id={section.id}
                title={section.label}
                description={content?.description}
                href={section.href}
                iconPath={section.iconUrl}
                index={index}
              />
            );
          })}
        </div>
      </div>
    </main>
  );
}
