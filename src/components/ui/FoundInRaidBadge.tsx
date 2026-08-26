// Единый бейдж «НАЙДЕНО В РЕЙДЕ» (Found in Raid). Эталон — Figma node 3146:16722:
// золото FiR (--color-fir), иконка-галочка 12px + текст 10px Blender Pro Medium,
// фон 10%, рамка 0.5px, rounded. Один дизайн на весь портал (QuestNode, трекер предметов,
// карточки квестов, убежище, «Прибыль/Нужно» и пр.). `compact` — только глиф (тесные ряды).

interface Props {
  /** Только иконка-глиф в рамке (без текста) — для узких рядов. Текст уходит в title. */
  compact?: boolean;
  className?: string;
}

export function FoundInRaidBadge({ compact = false, className = '' }: Props) {
  if (compact) {
    return (
      <span
        title="Найдено в рейде"
        aria-label="Найдено в рейде"
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-[0.5px] border-fir bg-fir/10 ${className}`}
      >
        <span className="icon-eft-find-in-raid icon-mask h-3 w-3 bg-fir" />
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-5 items-center gap-2 rounded border-[0.5px] border-fir bg-fir/10 px-2.5 font-blender-medium text-[0.625rem] uppercase leading-none tracking-wide text-fir ${className}`}
    >
      <span className="icon-eft-find-in-raid icon-mask h-3 w-3 shrink-0 bg-fir" />
      Найдено в рейде
    </span>
  );
}
