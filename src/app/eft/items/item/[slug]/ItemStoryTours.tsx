'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useStoryProgressStore } from '@/store/useStoryProgressStore';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import type { ItemStoryTour } from '@/lib/item-story-tours';

interface ItemStoryToursProps {
  tours: ItemStoryTour[];
  itemName: string;
  itemImage?: string;
  itemBackground?: string;
}

// Блок «ТУР» левой колонки: сюжетные истории, где нужен предмет. На каждую историю —
// заголовок (иконка + название) + строка предмета со слотом и прогрессом N/M,
// клик уводит в walkthrough-гайд истории. Прогресс живёт в localStorage-сторе,
// поэтому считаем его только после монтирования (иначе рассинхрон гидрации).
export function ItemStoryTours({ tours, itemName, itemImage, itemBackground }: ItemStoryToursProps) {
  const conditionDone = useStoryProgressStore((s) => s.conditionDone);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (tours.length === 0) return null;

  return (
    <section className="flex flex-col gap-3.5">
      {tours.map((tour) => {
        const total = tour.conditionKeys.length;
        const done = mounted ? tour.conditionKeys.filter((k) => conditionDone[k]).length : 0;
        const complete = done === total;

        return (
          <div key={tour.slug} className="flex flex-col gap-3.5">
            {/* Заголовок истории: hero-баннер (кроп object-cover) + название — ссылка в гайд */}
            <Link href={`/eft/quests/${tour.slug}`} className="group flex items-center gap-3.5 hover:brightness-110">
              {tour.heroImage ? (
                <img
                  src={tour.heroImage}
                  alt=""
                  className="h-14 w-25 shrink-0 rounded-xs border border-black/50 object-cover"
                />
              ) : (
                <img src={tour.iconUrl} alt="" className="h-7 w-7 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate font-blender-medium text-base uppercase leading-none text-text-primary transition-colors group-hover:text-(--primary)">
                {tour.title}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition-colors group-hover:text-(--primary)" />
            </Link>

            {/* Строка предмета: слот 48 + имя + прогресс N/M */}
            <div className="flex items-center gap-3.5">
              <span
                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xs border-[0.5px] border-lines-hover"
                style={{ backgroundColor: getTarkovBackgroundColor(itemBackground) }}
              >
                {itemImage && (
                  <img src={itemImage} alt="" className="absolute inset-0 h-full w-full object-contain" />
                )}
                <span className="pointer-events-none absolute inset-0 rounded-xs shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />
              </span>
              <span className="min-w-0 flex-1 truncate font-blender-book text-base leading-none text-text-primary">
                {itemName}
              </span>
              <span
                className={`shrink-0 font-blender-book text-base leading-none ${complete ? 'text-nvg-green' : 'text-text-primary'}`}
              >
                {done}/{total}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
