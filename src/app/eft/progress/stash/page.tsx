import type { Metadata } from 'next';
import { StashClient } from './StashClient';

// «Мой схрон» — визуальная сетка предметов, отмеченных «В схрон» по сайту (§ важные предметы).
// Обвязка PageHeader/HubNav приходит из общего layout раздела «Прогресс» (SectionLayoutNav
// читает узел p-stash из HEADER_DICTIONARY по маршруту) — как у соседних страниц progress,
// поэтому здесь только каркас <main> + клиентский островок. Данные схрона живут в клиенте
// (localStorage-стор владения), мета предметов тянется из нашего зеркала через /api (§4.11).
export const metadata: Metadata = { title: 'Мой схрон | Прогресс ЦТА' };

export default function StashPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <StashClient />
      </div>
    </main>
  );
}
