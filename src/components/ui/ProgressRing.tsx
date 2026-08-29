interface ProgressRingProps {
  /** 0..100 */
  percent: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}

/** Кольцо прогресса. Дамб-атом: трек — lines-hover, дуга — --primary. */
export function ProgressRing({ percent, size = 96, stroke = 8, children }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}>
      <svg width={`${size / 16}rem`} height={`${size / 16}rem`} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-lines-hover" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="stroke-(--primary) transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">{children}</span>
    </span>
  );
}
