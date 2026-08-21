import { getHideoutNeeds, getHideoutStations, getHideoutUnlockMap } from '@/db/hideout';
import { HideoutBuildTracker } from '@/components/features/hideout/HideoutBuildTracker';

// «Модули убежища» — геймифицированный трекер постройки (единый дизайн с вкладкой
// «Трекинг» Аккаунт Центра, wide-раскладка). Данные — наше зеркало hideout_upgrades (RSC).
// unlockMap — требования разблокировки уровня (станции/торговцы/навыки) из того же зеркала.
export default async function HideoutModulesHubPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const [{ module: initialModule }, stations, hideoutNeeds, unlockMap] = await Promise.all([
    searchParams,
    getHideoutStations(),
    getHideoutNeeds(),
    getHideoutUnlockMap(),
  ]);

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <HideoutBuildTracker
          stations={stations}
          hideoutNeeds={hideoutNeeds}
          unlockMap={unlockMap}
          initialModule={initialModule}
          wide
          showModulesCta={false}
          moduleTiles
        />
      </div>
    </main>
  );
}
