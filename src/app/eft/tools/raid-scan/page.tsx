import type { Metadata } from 'next';
import { SectionHubNav } from '@/components/features/navigation/SectionHubNav';
import { getEftPriceMapFromDb } from '@/db/prices';
import { RaidScanClient } from '@/components/features/raid-scan/RaidScanClient';
import type { RaidScanPriceMap } from '@/components/features/raid-scan/raid-scan-prices';

// «Разбор рейда» — игрок грузит скриншот инвентаря EFT, страница распознаёт предметы
// поверх сетки и показывает цены. Данные о ценах — только из НАШЕГО зеркала (§4.11):
// строим компактную карта itemId → {avg,low} на сервере и передаём в клиент пропом,
// потому что сами предметы становятся известны лишь после ответа /api/vision/inventory.
export const metadata: Metadata = {
  title: 'Разбор рейда | Инструменты ЦТА',
  description:
    'Загрузите скриншот инвентаря из рейда — ЦТА распознает предметы поверх сетки и покажет их цены на барахолке.',
};

export default async function RaidScanPage() {
  const priceMap = await getEftPriceMapFromDb();

  // Компактный, JSON-сериализуемый словарь: только числа, нужные UI. Полная карта
  // (тысячи предметов) — это норма для страниц craft-profit/items, но в клиент
  // отдаём урезанную форму, чтобы не тащить sellFor/buyFor.
  const prices: RaidScanPriceMap = {};
  for (const [itemId, info] of priceMap) {
    prices[itemId] = {
      avg24hPrice: info.avg24hPrice ?? null,
      lastLowPrice: info.lastLowPrice ?? null,
    };
  }

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <SectionHubNav
        rootPath="/eft/tools"
        variant="full"
        title="Разбор рейда"
        description="Загрузи скриншот инвентаря — распознаем предметы поверх сетки и покажем цены."
        iconUrl="/icons/eft/raid-scan-icon.svg"
        className="mb-7"
      />
      <div className="w-full max-w-275 px-4 xl:px-0">
        <RaidScanClient prices={prices} />
      </div>
    </main>
  );
}
