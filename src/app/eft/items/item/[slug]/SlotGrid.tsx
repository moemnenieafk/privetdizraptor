interface Grid {
  width: number;
  height: number;
}

const FRAME_PX = 96;          // h-24 w-24
const INNER_PX = FRAME_PX - 8; // ~4px внутренний отступ с каждой стороны
const MAX_CELL = 12;           // потолок размера ячейки (мелкие сетки не растягиваются на всю рамку)

// Размер ячейки: мелкие сетки (футпринт) держат фикс. размер и центрируются,
// крупные (вместимость) — ужимаются и заполняют рамку.
function cellPx(width: number, height: number): number {
  const maxDim = Math.max(width, height, 1);
  return Math.max(2, Math.min(MAX_CELL, Math.floor((INNER_PX - (maxDim - 1)) / maxDim)));
}

function GridFrame({ width, height, accent = false }: Grid & { accent?: boolean }) {
  const cell = cellPx(width, height);

  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-lines-hover bg-(--color-base) shadow-inner">
      <div
        className={`grid gap-px ${accent ? '' : 'bg-lines-hover/40'}`}
        style={{ gridTemplateColumns: `repeat(${width}, ${cell}px)` }}
      >
        {Array.from({ length: width * height }).map((_, i) => (
          <div
            key={i}
            style={{ width: cell, height: cell }}
            className={accent ? 'bg-(--primary)' : 'bg-card-menu'}
          />
        ))}
      </div>
    </div>
  );
}

function GridColumn({ title, grids, accent = false }: { title: string; grids: Grid[]; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wider font-blender-medium text-text-secondary">
        {title}
      </h3>
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

interface SlotGridProps {
  width: number;
  height: number;
  /** Внутренние секции (вместимость) — для контейнеров/рюкзаков */
  sections?: Grid[];
}

export function SlotGrid({ width, height, sections }: SlotGridProps) {
  const hasSections = !!sections && sections.length > 0;

  return (
    <div className="grid grid-cols-2 gap-7">
      <GridColumn title="Сетка предмета" grids={[{ width, height }]} accent />
      {hasSections && <GridColumn title="Вместимость" grids={sections!} />}
    </div>
  );
}
