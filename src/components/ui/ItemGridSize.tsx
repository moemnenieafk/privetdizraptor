import { Tooltip } from './Tooltip';

interface ItemGridSizeProps {
  width: number;
  height: number;
  variant?: 'footprint' | 'container';
  showLabel?: boolean;
  labelFirst?: boolean;
  className?: string;
}

export function ItemGridSize({
  width,
  height,
  variant = 'footprint',
  showLabel = true,
  labelFirst = false,
  className = '',
}: ItemGridSizeProps) {
  const slots = width * height;
  const isFootprint = variant === 'footprint';
  const tooltipText = `${width}×${height} — ${slots} ${slots === 1 ? 'слот' : slots < 5 ? 'слота' : 'слотов'}`;

  const label = showLabel ? (
    <span className="font-blender-medium text-xs text-text-muted">
      {width}×{height}
    </span>
  ) : null;

  const icon = (
    <div
      className={`inline-grid gap-px p-0.5 rounded-xs border ${
        isFootprint
          ? 'bg-(--color-base) border-lines-hover/40'
          : 'bg-card-menu border-lines-hover/40'
      }`}
      style={{ gridTemplateColumns: `repeat(${width}, 3px)` }}
    >
      {Array.from({ length: slots }).map((_, i) => (
        <div
          key={i}
          className={`h-0.75 w-0.75 ${isFootprint ? 'bg-(--primary)' : 'bg-(--color-base)'}`}
        />
      ))}
    </div>
  );

  return (
    <Tooltip content={tooltipText} className={className}>
      <div className="inline-flex items-center gap-1.5">
        {labelFirst ? <>{label}{icon}</> : <>{icon}{label}</>}
      </div>
    </Tooltip>
  );
}
