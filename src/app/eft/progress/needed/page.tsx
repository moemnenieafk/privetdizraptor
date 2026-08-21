import type { Metadata } from 'next';
import { buildNeededItems, type NeededData, type NeededMode } from '@/lib/needed-items';
import { getHideoutStations } from '@/db/hideout';
import { NeededMergedClient } from './NeededMergedClient';

export const metadata: Metadata = { title: 'Важные предметы | Прогресс ЦТА' };

// Объединённый трекер «Важные предметы» (слияние /tracker + /needed) — важные предметы всех
// источников (квесты + убежище) единым списком. Данные — из зеркала (RSC).
// Режим (regular/pve) — клиентское поле профиля (usePlayerStore, localStorage), в RSC недоступно.
// Поэтому собираем ОБА набора и передаём клиенту, а он выбирает по активному профилю. Убежище —
// общее (regular-зеркало): требования убежища режим-инвариантны — сверка regular/hideout vs
// pve/hideout в json.tarkov.dev даёт 0 отличий по всем 68 станциям×уровням (предметы, время,
// требования торговцев/станций/навыков). Поэтому таблица `hideout_upgrades` без mode-колонки —
// это не долг, а корректность. Payload квестов ~2× осознанно: дешевле, чем куки-плоскость через
// middleware/auth. Спека: docs/decisions/important-items-merge.md.
export default async function NeededItemsPage() {
  const [regular, pve, hideoutStations] = await Promise.all([
    buildNeededItems('regular'),
    buildNeededItems('pve'),
    getHideoutStations(),
  ]);
  const dataByMode: Record<NeededMode, NeededData> = { regular, pve };

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <NeededMergedClient dataByMode={dataByMode} hideoutStations={hideoutStations} />
      </div>
    </main>
  );
}
