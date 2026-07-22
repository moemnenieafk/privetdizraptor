import { Boxes } from 'lucide-react';
import { SectionRule } from '@/components/ui/SectionRule';
import { itemIconUrl } from '@/lib/item-icon';
import type { GridInfo } from './ItemModules';

// Блок «Вмещает»: какие категории и предметы принимают ячейки контейнера/рюкзака.
// Данные — grids[].filters (tarkov.dev), собранные по всем ячейкам в уникальные списки.
// Пусто (фильтров нет в зеркале) → блок не рисуется.
export function ContainerContents({ grids }: { grids?: GridInfo[] }) {
  if (!grids?.length) return null;

  const categories = new Map<string, string>();
  const items = new Map<string, string>();
  for (const g of grids) {
    for (const c of g.filters?.allowedCategories ?? []) categories.set(c.id, c.name);
    for (const it of g.filters?.allowedItems ?? []) {
      items.set(it.id, it.shortName || it.name || it.id);
    }
  }
  if (categories.size === 0 && items.size === 0) return null;

  return (
    <section className="flex w-full max-w-[724px] flex-col gap-3.5">
      <SectionRule title="Вмещает" icon={<Boxes className="h-4 w-4" />} />
      <div className="flex flex-wrap items-center gap-2">
        {[...categories].map(([id, name]) => (
          <span
            key={`cat-${id}`}
            className="inline-flex h-7 items-center rounded-sm border border-lines-hover bg-card-menu px-2 font-blender-medium text-[10px] uppercase tracking-widest text-text-secondary"
          >
            {name}
          </span>
        ))}
        {[...items].map(([id, label]) => (
          <span
            key={`item-${id}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-lines-hover bg-card-menu px-1.5 font-blender-medium text-[10px] uppercase tracking-widest text-text-secondary"
          >
            <img src={itemIconUrl(id)} alt="" className="h-4 w-4 shrink-0 rounded-xs object-contain" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
