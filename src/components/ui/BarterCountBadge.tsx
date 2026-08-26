// Бейдж «ОТКРЫВАЕТ N БАРТЕРОВ». Эталон — Figma node 3149:16761: зелёный nvg-green,
// иконка бартера 12px + текст 10px Blender Pro Medium, фон 10%, рамка 0.5px, rounded.
// Склонение «бартер/бартера/бартеров» — по числу (2 бартера, 7 бартеров, 21 бартер).

/** Русское склонение слова «бартер» по количеству. */
function barterWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'бартер';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'бартера';
  return 'бартеров';
}

interface Props {
  count: number;
  className?: string;
}

export function BarterCountBadge({ count, className = '' }: Props) {
  if (count <= 0) return null;
  return (
    <span
      title={`Открывает ${count} ${barterWord(count)}`}
      className={`inline-flex h-5 items-center gap-2 rounded border-[0.5px] border-nvg-green bg-nvg-green/10 px-2.5 font-blender-medium text-[0.625rem] uppercase leading-none tracking-wide text-nvg-green ${className}`}
    >
      <span className="icon-eft-prog-barter h-3 w-3 shrink-0 bg-nvg-green mask-contain mask-center mask-no-repeat" />
      Открывает {count} {barterWord(count)}
    </span>
  );
}
