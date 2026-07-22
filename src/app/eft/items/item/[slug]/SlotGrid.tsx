import layoutsData from '@/data/container-grid-layouts.json';

interface Grid {
  width: number;
  height: number;
}

// Раскладка секций в АБСОЛЮТНЫХ пикселях (масштаб сайта 6px = масштаб Figma):
// {l,t} — позиция блока, {w,h} — его размер. Так сохраняются под-клеточные зазоры (4px).
const LAYOUTS = (layoutsData as { layouts: Record<string, { l: number; t: number; w: number; h: number }[]> }).layouts;

// Ячейка одиночной сетки предмета фикс. 6px (мульти-секция — по px-раскладке из JSON).
const CELL_PX = 6;

function GridFrame({ width, height, accent = false }: Grid & { accent?: boolean }) {
  const cell = CELL_PX;
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-lines-hover bg-(--color-base) shadow-inner">
      {/* Линии/контур #242426 (bg-card-menu) через p-px + gap-px. Заливка клетки:
          «Сетка предмета» — фирменный оранжевый (accent), «Вместимость» — чёрная. */}
      <div
        className="grid gap-px rounded-xs bg-card-menu p-px"
        style={{ gridTemplateColumns: `repeat(${width}, ${cell}px)` }}
      >
        {Array.from({ length: width * height }).map((_, i) => (
          <div
            key={i}
            style={{ width: cell, height: cell }}
            className={accent ? 'bg-(--primary)' : 'bg-black'}
          />
        ))}
      </div>
    </div>
  );
}

// Мульти-секционная вместимость по игровой раскладке. Каждая секция — свой блок с
// линиями/контуром #242426 и чёрными клетками; МЕЖДУ секциями — прозрачно (зазоры,
// которые расставлены в Figma, на сайте остаются пустыми, не закрашиваются).
function CompositeGrid({ sections, layout }: { sections: Grid[]; layout: { l: number; t: number; w: number; h: number }[] }) {
  const width = Math.max(...layout.map((p) => p.l + p.w));
  const height = Math.max(...layout.map((p) => p.t + p.h));
  return (
    <div className="relative shrink-0" style={{ width, height }}>
      {sections.map((s, i) => (
        <div
          key={i}
          className="absolute grid gap-px rounded-xs bg-card-menu p-px"
          style={{
            left: layout[i].l,
            top: layout[i].t,
            width: layout[i].w,
            height: layout[i].h,
            gridTemplateColumns: `repeat(${s.width}, 1fr)`,
          }}
        >
          {Array.from({ length: s.width * s.height }).map((_, k) => (
            <div key={k} className="bg-black" />
          ))}
        </div>
      ))}
    </div>
  );
}

function GridColumn({ title, grids, accent = false }: { title: string; grids: Grid[]; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wider font-blender-medium text-text-secondary">{title}</h3>
      <div className="flex flex-col gap-3">
        {grids.map((g, i) => (
          <div key={i} className="flex items-center gap-3.5">
            <GridFrame width={g.width} height={g.height} accent={accent} />
            <div className="flex flex-col">
              <span className="font-blender-medium text-xs text-(--text-muted)">
                {g.width}x{g.height}
              </span>
              <span className="text-3xl leading-none font-blender-medium text-text-primary">
                {g.width * g.height}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Колонка вместимости с готовой раскладкой: композиция секций по центру + итог.
function CapacityLayoutColumn({ sections, layout }: { sections: Grid[]; layout: { l: number; t: number; w: number; h: number }[] }) {
  const total = sections.reduce((s, g) => s + g.width * g.height, 0);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wider font-blender-medium text-text-secondary">Вместимость</h3>
      <div className="flex items-center gap-3.5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-lines-hover bg-(--color-base) shadow-inner">
          <CompositeGrid sections={sections} layout={layout} />
        </div>
        <div className="flex flex-col">
          <span className="font-blender-medium text-xs text-(--text-muted)">{sections.length} секц.</span>
          <span className="text-3xl leading-none font-blender-medium text-text-primary">{total}</span>
        </div>
      </div>
    </div>
  );
}

interface SlotGridProps {
  width: number;
  height: number;
  /** Внутренние секции (вместимость) — для контейнеров/рюкзаков */
  sections?: Grid[];
  /** BSG id — по нему берётся готовая раскладка секций (container-grid-layouts.json). */
  itemId?: string;
}

export function SlotGrid({ width, height, sections, itemId }: SlotGridProps) {
  const hasSections = !!sections && sections.length > 0;
  const layout = itemId ? LAYOUTS[itemId] : undefined;
  const useComposite = hasSections && layout && layout.length === sections!.length;

  return (
    <div className="grid grid-cols-2 gap-7">
      <GridColumn title="Сетка предмета" grids={[{ width, height }]} accent />
      {hasSections &&
        (useComposite ? (
          <CapacityLayoutColumn sections={sections!} layout={layout!} />
        ) : (
          <GridColumn title="Вместимость" grids={sections!} />
        ))}
    </div>
  );
}
