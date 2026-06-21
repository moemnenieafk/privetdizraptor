import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { SectionPanel } from '@/components/ui/kit';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { formatCompactNumber } from '@/lib/formatters';
import { ItemImage } from './ItemImage';

export interface SimilarItem {
  id: string;
  normalizedName: string;
  name: string;
  shortName: string;
  image512pxLink: string;
  backgroundColor?: string;
  bestSellPrice: number;
}

interface SimilarItemsProps {
  items: SimilarItem[];
}

export function SimilarItems({ items }: SimilarItemsProps) {
  if (items.length === 0) return null;

  return (
    <SectionPanel title="Похожие предметы" icon={<Boxes className="w-4 h-4" />}>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/eft/items/item/${item.normalizedName}`}
            className="group flex w-26 shrink-0 flex-col gap-2"
          >
            <div
              className="relative flex aspect-square items-center justify-center overflow-hidden rounded border border-lines-hover transition-colors group-hover:border-(--primary)"
              style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
            >
              <ItemImage
                id={item.id}
                image512pxLink={item.image512pxLink}
                name={item.name}
                className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className="truncate font-blender-medium text-xs text-text-primary transition-colors group-hover:text-(--primary)"
                title={item.name}
              >
                {item.shortName}
              </span>
              {item.bestSellPrice > 0 && (
                <span className="font-blender-medium text-type-caption text-nvg-green">
                  {formatCompactNumber(item.bestSellPrice)} ₽
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </SectionPanel>
  );
}
