import { PageHeader } from '@/components/ui/PageHeader';
import Link from "next/link";
import { HEADER_DICTIONARY } from "@/data/headerConfig";

export default function MapsPage() {
  // Извлекаем список карт из конфигурации хедера
  const eftConfig = HEADER_DICTIONARY['eft'];
  const mapsItem = eftConfig.menuItems.find(item => item.id === 'maps');
  const maps = mapsItem?.children || [];

  return (
    <main className="flex w-full flex-col items-center justify-start pt-[28px] pb-[56px] animate-[fade-in_0.5s_ease-out_both] min-h-[70vh]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0 mx-auto">
        <PageHeader pageId="eft-maps" />
        <div className="w-full max-w-[1100px] mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-[28px] justify-items-center">
        {maps.map((mapData, i) => (
          <Link
            key={mapData.id}
            href={mapData.path || '#'}
            className="group flex flex-col items-center justify-center gap-4 p-4 w-[160px] h-[160px] bg-card-menu border border-lines-hover rounded transition-all duration-300 hover:border-primary hover:shadow-[0_0_15px] hover:shadow-primary/20 animate-[fade-in-up_0.5s_both]"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            {mapData.iconUrl && (
              <div
                className="icon-mask w-10 h-10 bg-text-secondary transition-colors duration-300 group-hover:bg-primary"
                style={{
                  maskImage: `url(${mapData.iconUrl})`,
                  WebkitMaskImage: `url(${mapData.iconUrl})`,
                  maskSize: 'contain',
                  maskPosition: 'center',
                  maskRepeat: 'no-repeat',
                }}
              />
            )}
            <span className="font-blender-medium text-[13px] text-text-secondary uppercase tracking-widest transition-colors duration-300 group-hover:text-primary text-center">
              {mapData.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
        </div>
    </main>
  );
}