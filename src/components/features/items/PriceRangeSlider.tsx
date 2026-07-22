'use client';

interface PriceRangeSliderProps {
  value: [number, number];                 // [lo, hi] в ₽
  onChange: (v: [number, number]) => void;
  /** ₽ → позиция 0..1 (нелинейный маппинг задаёт родитель) */
  toPos: (rub: number) => number;
  /** позиция 0..1 → ₽ (с округлением до «красивого» шага) */
  toValue: (pos: number) => number;
  /** якоря шкалы: цена ₽ + позиция 0..1 + подпись (клик ставит ближайший ползунок) */
  ticks: { value: number; pos: number; label: string }[];
}

const RES = 1000;          // разрешение нативного range в позиционном пространстве
const GAP = 0.015;         // мин. зазор между ползунками (в долях позиции)

const THUMB =
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-(--color-base) [&::-webkit-slider-thumb]:bg-(--primary) [&::-webkit-slider-thumb]:shadow ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-(--color-base) [&::-moz-range-thumb]:bg-(--primary)';

const INPUT =
  `pointer-events-none absolute inset-x-0 top-1/2 m-0 h-4 w-full -translate-y-1/2 appearance-none bg-transparent focus:outline-none ${THUMB}`;

export function PriceRangeSlider({ value, onChange, toPos, toValue, ticks }: PriceRangeSliderProps) {
  const [lo, hi] = value;
  const loPos = toPos(lo);
  const hiPos = toPos(hi);

  const setLoPos = (p: number) => onChange([toValue(Math.min(p, hiPos - GAP)), hi]);
  const setHiPos = (p: number) => onChange([lo, toValue(Math.max(p, loPos + GAP))]);

  // Клик по делению — двигаем ближайший ползунок к нему.
  const clickTick = (tickPos: number) => {
    if (Math.abs(tickPos - loPos) <= Math.abs(tickPos - hiPos)) setLoPos(tickPos);
    else setHiPos(tickPos);
  };

  return (
    <div>
      {/* Дорожка + ползунки + шкала */}
      <div className="relative h-4">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-lines-hover" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-(--primary)"
            style={{ left: `${loPos * 100}%`, right: `${(1 - hiPos) * 100}%` }}
          />
          <input
            type="range" aria-label="Цена от"
            min={0} max={RES} step={1}
            value={Math.round(loPos * RES)}
            onChange={(e) => setLoPos(Number(e.target.value) / RES)}
            className={`${INPUT} z-10`}
          />
          <input
            type="range" aria-label="Цена до"
            min={0} max={RES} step={1}
            value={Math.round(hiPos * RES)}
            onChange={(e) => setHiPos(Number(e.target.value) / RES)}
            className={`${INPUT} z-20`}
          />
        </div>

        {/* Лог-шкала: засечки + кликабельные подписи (клик → ближайший ползунок) */}
        <div className="relative mt-1 h-6">
          {ticks.map((t, i) => (
            <span
              key={`m-${i}`}
              className="pointer-events-none absolute top-0 h-1.5 w-px -translate-x-1/2 bg-lines-hover"
              style={{ left: `${t.pos * 100}%` }}
            />
          ))}
          {ticks.map((t, i) => {
            const align = t.pos <= 0.001 ? 'translate-x-0' : t.pos >= 0.999 ? '-translate-x-full' : '-translate-x-1/2';
            return (
              <button
                key={`b-${i}`}
                type="button"
                onClick={() => clickTick(t.pos)}
                title={`Задать ${t.label}`}
                className={`absolute top-1 px-1.5 py-1 font-blender-medium text-type-micro leading-none whitespace-nowrap text-text-muted transition-colors hover:text-(--primary) ${align}`}
                style={{ left: `${t.pos * 100}%` }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
    </div>
  );
}
