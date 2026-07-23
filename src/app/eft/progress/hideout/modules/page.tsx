import { getHideoutNeeds, getHideoutStations } from '@/db/hideout';
import { HideoutBuildTracker } from '@/components/features/hideout/HideoutBuildTracker';

// «Модули убежища» — геймифицированный трекер постройки (единый дизайн с вкладкой
// «Трекинг» Аккаунт Центра, wide-раскладка: левая колонка 348px, gap 28px).
// Данные — наше зеркало hideout_upgrades (RSC, без внешних API). Подстраницы
// станций (/modules/<slug>) доступны из панели станции («Страница модуля»).
export default async function HideoutModulesHubPage() {
  const [stations, hideoutNeeds] = await Promise.all([getHideoutStations(), getHideoutNeeds()]);

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <HideoutBuildTracker stations={stations} hideoutNeeds={hideoutNeeds} wide showModulesCta={false} />
      </div>
    </main>
  );
}
