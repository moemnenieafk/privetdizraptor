"use client";

import { Boxes } from 'lucide-react';
import { SectionPanel } from '@/components/ui/kit';
import { EftItemTile } from '@/components/features/items/EftItemTile';
import type { EftItemData } from '@/components/features/items/EftItemTile';

interface SimilarItemsProps {
  items: EftItemData[];
}

export function SimilarItems({ items }: SimilarItemsProps) {
  if (items.length === 0) return null;

  return (
    <SectionPanel title="Похожие предметы" icon={<Boxes className="w-4 h-4" />} noDivider smallTitle bare>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <EftItemTile.Root key={item.id} item={item}>
            <EftItemTile.Header />
            <EftItemTile.Media />
            <EftItemTile.Name />
            <EftItemTile.Pricing />
          </EftItemTile.Root>
        ))}
      </div>
    </SectionPanel>
  );
}
