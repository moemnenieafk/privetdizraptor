// Ранг-шеврон: уровень ЧВК в шевроне (clip-path) + эмблема престижа (иконка из
// /icons/eft/prestige/*). Мотив из §3.2, референс — PrestigePath. Числа tabular-nums (§6).
// Пустое состояние (level=null) → «—» в шевроне, без эмблемы.

interface RankChevronProps {
  /** Уровень ЧВК. null → данных нет. */
  level: number | null;
  /** Престиж 0..6 (0 = без эмблемы). */
  prestige?: number;
  className?: string;
}

const MAX_PRESTIGE_ICON = 6;

export function RankChevron({ level, prestige = 0, className = '' }: RankChevronProps) {
  const hasPrestige = prestige > 0 && prestige <= MAX_PRESTIGE_ICON;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {hasPrestige && (
        <img
          src={`/icons/eft/prestige/prestige-${prestige}.webp`}
          alt=""
          className="size-8 shrink-0 object-contain"
        />
      )}
      <span
        className="inline-flex h-9 min-w-9 items-center justify-center px-2"
        style={{
          // Шеврон: срезанный низ (стрелка вниз) — «нашивка».
          clipPath: 'polygon(0 0, 100% 0, 100% 65%, 50% 100%, 0 65%)',
          background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
          border: '1px solid color-mix(in srgb, var(--primary) 50%, transparent)',
        }}
      >
        <span className="pb-1 text-sm font-blender-medium tabular-nums tracking-wider text-(--primary)">
          {level == null ? '—' : level}
        </span>
      </span>
    </div>
  );
}
