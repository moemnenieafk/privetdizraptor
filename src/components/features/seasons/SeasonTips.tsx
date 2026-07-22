'use client';

// Карусель онбординг-советов ЦТА (хаб/конструктор «Сезоны»). Авто-прокрутка с паузой
// на hover, точки + счётчик сверху-справа, тонкий прогресс-бар автоплея. Акцент —
// тил сезона (--color-lightkeeper). Контент статичный, рендерится сразу.
import { useEffect, useState } from 'react';
import type { Season } from '@/data/eft-seasons';
import { getSeasonTips } from '@/data/season-tips';

const AUTOPLAY_MS = 7000;

interface Props {
  season: Season;
}

export function SeasonTips({ season }: Props) {
  const tips = getSeasonTips(season.slug);
  const count = tips.length;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, count]);

  if (count === 0) return null;

  const tip = tips[index];
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section
      aria-label="Советы ЦТА по сезону"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative flex h-32 w-full flex-col gap-2 overflow-hidden rounded-lg border border-lines-hover bg-card-menu p-4"
    >
      {/* Прогресс автоплея: scaleX слева направо, пауза на hover. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-(--color-darkbase)">
        <span
          key={index}
          className="season-tip-progress block h-full origin-left bg-(--color-lightkeeper)"
          style={{
            animationDuration: `${AUTOPLAY_MS}ms`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      </span>

      {/* Верх: метка ЦТА (слева) + точки-пагинация и счётчик (справа) */}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-lightkeeper)">
          <span aria-hidden className="icon-mask icon-eft-progress h-4 w-4 bg-(--color-lightkeeper)" />
          Совет ЦТА · Сезон {season.number}
        </span>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-1 sm:flex">
            {tips.map((t, i) => (
              <button
                key={t.title}
                type="button"
                aria-label={`Совет ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={[
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index
                    ? 'w-4 bg-(--color-lightkeeper)'
                    : 'w-1.5 bg-lines-hover hover:bg-text-muted',
                ].join(' ')}
              />
            ))}
          </div>
          <span className="font-blender-medium text-xs tracking-wide text-text-muted">
            {pad(index + 1)}/{pad(count)}
          </span>
        </div>
      </div>

      {/* Тело совета: перерисовка с fade по смене индекса */}
      <div
        key={index}
        className="flex flex-1 flex-col justify-center gap-2 animate-[fade-in_0.35s_ease-out_both]"
      >
        <h3 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          {tip.title}
        </h3>
        <p className="line-clamp-2 max-w-2xl font-blender-book text-sm leading-snug text-text-secondary">
          {tip.body}
        </p>
      </div>
    </section>
  );
}
