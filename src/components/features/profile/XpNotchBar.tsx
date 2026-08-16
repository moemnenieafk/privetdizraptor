// XP-полоса с насечками: заполнение по проценту + tick-насечки repeating-linear-gradient,
// бегущий блик animate-shimmer по заполненной части (§3.2/3.3). Числа — tabular-nums (§6).
// Пустое состояние (percent=0) = ровная seed-полоса, подпись «—», не голый ноль.

interface XpNotchBarProps {
  /** Прогресс 0..100. */
  percent: number;
  /** Подпись текущего тира (напр. «БАРЫГА»). */
  tierLabel?: string;
  /** Ярлык следующей вехи / остатка. */
  nextLabel?: string;
  className?: string;
}

export function XpNotchBar({ percent, tierLabel, nextLabel, className = '' }: XpNotchBarProps) {
  const pct = Math.max(0, Math.min(100, percent));
  const empty = pct <= 0;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          {tierLabel ?? 'XP-тир'}
        </span>
        <span className="text-type-caption font-blender-medium tabular-nums tracking-wider text-(--primary)">
          {empty ? '—' : `${Math.round(pct)}%`}
        </span>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-xs bg-lines-hover">
        {/* Заполнение */}
        <div
          className="absolute inset-y-0 left-0 rounded-xs bg-(--primary) transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        >
          {/* Бегущий блик по заполненной части */}
          {!empty && (
            <span
              aria-hidden
              className="animate-shimmer absolute inset-y-0 left-0 w-1/3"
              style={{
                background:
                  'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-text-primary) 45%, transparent), transparent)',
              }}
            />
          )}
        </div>
        {/* Насечки поверх — repeating-linear-gradient «зубцы» шкалы */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0, transparent calc(10% - 1px), color-mix(in srgb, var(--color-base) 70%, transparent) calc(10% - 1px), color-mix(in srgb, var(--color-base) 70%, transparent) 10%)',
          }}
        />
      </div>

      {nextLabel && (
        <span className="text-type-micro font-blender-book text-text-secondary">{nextLabel}</span>
      )}
    </div>
  );
}
