import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { getEftInteractiveMapsWithNames } from '@/db/maps';
import { getStaticMaps } from '@/data/eft-map-config';
import { mapIconClass, mapOrderIndex } from '@/data/map-icons';

// Динамический индекс: список карт = интерактивные карты из БД (imageKey задан).
// Добавили/убрали карту серверным кроном → страница сама обновилась.
export default async function MapsPage() {
  const dbMaps = await getEftInteractiveMapsWithNames();
  // + статичные карты (наш арт, не в БД), без дублей по slug.
  const staticMaps = getStaticMaps().filter((s) => !dbMaps.some((m) => m.slug === s.slug));
  const sorted = [...dbMaps, ...staticMaps].sort((a, b) => mapOrderIndex(a.slug) - mapOrderIndex(b.slug));

  return (
    <main className="flex w-full flex-col items-center justify-start pt-4 pb-14 animate-[fade-in_0.5s_ease-out_both] min-h-[70vh]">
      <div className="w-full max-w-275 px-4 xl:px-0 mx-auto">
        <PageHeader pageId="eft-maps" />
        <div className="w-full max-w-275 mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-7 justify-items-center">
            {sorted.map((m, i) => {
              const icon = mapIconClass(m.slug);
              return (
                <Link
                  key={m.slug}
                  href={`/eft/maps/${m.slug}`}
                  className="group flex flex-col items-center justify-center gap-4 p-4 w-35 h-35 sm:w-40 sm:h-40 bg-card-menu border border-lines-hover rounded transition-all duration-300 hover:border-primary hover:shadow-[0_0_15px] hover:shadow-primary/20 animate-[fade-in-up_0.5s_both]"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {icon ? (
                    <span className={`icon-mask ${icon} w-10 h-10 bg-text-secondary transition-colors duration-300 group-hover:bg-primary`} />
                  ) : (
                    <span className="font-blender-medium text-2xl text-text-secondary uppercase">{m.name.slice(0, 2)}</span>
                  )}
                  <span className="font-blender-medium text-type-micro sm:text-type-label text-text-secondary uppercase tracking-widest transition-colors duration-300 group-hover:text-primary text-center">
                    {m.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
