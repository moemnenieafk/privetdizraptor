import type { Metadata } from 'next';
import { buildNeededItems } from '@/lib/needed-items';
import { getHideoutStations } from '@/db/hideout';
import { NeededMergedClient } from './NeededMergedClient';

export const metadata: Metadata = { title: 'Важные предметы | Прогресс ЦТА' };

// Объединённый трекер «Важные предметы» (слияние /tracker + /needed) — важные предметы всех
// источников (квесты + убежище) единым списком. Данные — из зеркала (RSC), режим regular.
// Заголовок/навигацию даёт layout раздела (SectionLayoutNav). Спека: docs/decisions/important-items-merge.md.
export default async function NeededItemsPage() {
  const [data, hideoutStations] = await Promise.all([buildNeededItems('regular'), getHideoutStations()]);

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <NeededMergedClient data={data} hideoutStations={hideoutStations} />
      </div>
    </main>
  );
}
