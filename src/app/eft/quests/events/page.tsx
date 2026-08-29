import type { Metadata } from 'next';
import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';
import { getQuestsNav } from '@/lib/quests-nav';
import { QuestsHubNav } from '@/components/features/quests/QuestsHubNav';
import { EventsTimeline } from '@/components/features/events/EventsTimeline';
import { EFT_EVENTS } from '@/data/eft-events';
import { getEventContentIndex, getEventContentStatus } from '@/lib/eft-event-content';
import type { EftEventContentStatus } from '@/types/eft-events';

export const metadata: Metadata = {
  title: 'События | Задания ЦТА',
  description:
    'Полная хронология внутриигровых событий Escape from Tarkov: сюжетные главы, праздничные ивенты, изменения боссов, экономики и механик.',
};

/**
 * Индекс внутриигровых событий. Данные статичные → серверный рендер;
 * ссылки на квесты резолвятся здесь, чтобы база квестов не уехала в клиентский бандл.
 */
// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const { sections } = getQuestsNav('/eft/quests/events');
  const pageContent = PAGE_CONTENT_DICTIONARY['eft-quests-events'];

  // Актуальность бартеров и достижений считаем по живой БД, а не по ручным флажкам.
  const content = await getEventContentIndex();
  const statuses: Record<string, EftEventContentStatus> = Object.fromEntries(
    EFT_EVENTS.map((e) => [e.id, getEventContentStatus(e)]),
  );

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <QuestsHubNav
          iconClass={pageContent?.iconClass}
          title={pageContent?.title ?? 'События'}
          description={pageContent?.description}
          tabs={sections}
          activeHref="/eft/quests/events"
          count={EFT_EVENTS.length}
        />

        <EventsTimeline events={EFT_EVENTS} content={content} statuses={statuses} />
      </div>
    </main>
  );
}
