import type { Season } from '@/data/eft-seasons';
import { SeasonLogo } from './SeasonLogo';
import { SeasonTips } from './SeasonTips';

// Вводный блок сезона: слева логотип (фикс. 348px), справа карусель советов ЦТА,
// растянутая на весь остаток контентной ширины. Ниже xl — колонки в стек.
export function SeasonIntro({ season }: { season: Season }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      {/* Логотип сезона — 348px */}
      <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border border-lines-hover bg-card-menu p-4 xl:w-87 xl:shrink-0">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--color-lightkeeper) 14%, transparent), transparent 70%)',
          }}
        />
        {season.logoUrl ? (
          <SeasonLogo src={season.logoUrl} alt={season.name} className="relative h-12 sm:h-14" />
        ) : (
          <h2 className="relative font-blender-medium text-2xl uppercase tracking-widest text-text-primary">
            {season.name}
          </h2>
        )}
      </div>

      {/* Советы ЦТА — тянутся до конца контентной области */}
      <div className="flex flex-1">
        <SeasonTips season={season} />
      </div>
    </div>
  );
}
