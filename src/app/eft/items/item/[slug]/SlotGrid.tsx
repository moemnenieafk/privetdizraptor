interface SlotGridProps {
  width: number;
  height: number;
}

export function SlotGrid({ width, height }: SlotGridProps) {
  const cells = Array.from({ length: width * height });

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="inline-grid gap-px"
        style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
      >
        {cells.map((_, i) => (
          <div
            key={i}
            className="h-3.5 w-3.5 rounded-xs border border-(--primary)/40 bg-(--primary)/15"
          />
        ))}
      </div>
      <p className="font-blender-medium text-type-caption uppercase tracking-widest text-(--text-muted)">
        {width}×{height} = {width * height} сл.
      </p>
    </div>
  );
}
