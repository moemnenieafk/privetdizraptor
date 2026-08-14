import type { Metadata } from 'next';
import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { CURRENT_SEASON } from '@/data/eft-seasons';
import { seasonPerks, personalPerks } from '@/lib/season-points';
import { SeasonLogo } from '@/components/features/seasons/SeasonLogo';

export const metadata: Metadata = {
  title: 'Сезоны',
  description:
    'Сезоны Escape from Tarkov: механика сезонного персонажа и интерактивный конструктор модификаторов.',
};

const STATUS_LABEL: Record<string, string> = {
  announced: 'Анонсирован',
  live: 'Идёт',
  ended: 'Завершён',
};

// Мини-плашка статы: микро-лейбл сверху, значение цифрами (font-blender-medium).
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xs border border-lines-hover bg-(--color-base) px-3 py-2.5">
      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className="font-blender-medium text-sm uppercase tracking-wide text-text-primary">
        {value}
      </span>
    </div>
  );
}

export default function SeasonsHubPage() {
  const active = CURRENT_SEASON;
  const forced = seasonPerks(active).length;
  const personal = personalPerks(active).length;

  return (
    <main className="flex w-full flex-col items-center pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {/* ── Активный сезон ─────────────────────────────────────────── */}
          <article className="group relative flex flex-col gap-6 overflow-hidden rounded-lg border border-lines-hover bg-card-menu p-6 transition-all duration-300 hover:border-(--primary)/50 hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--primary)_15%,transparent)]">
            {/* Свечение-подложка по бренду сезона */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-40"
              style={{
                background:
                  'radial-gradient(circle at 50% -20%, color-mix(in srgb, var(--color-lightkeeper) 16%, transparent), transparent 70%)',
              }}
            />

            <div className="relative flex items-start justify-between gap-3">
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                Сезон {active.number}
                {active.kickoffEvent ? ` · старт с события «${active.kickoffEvent}»` : ''}
              </span>
              <span className="shrink-0 rounded-xs border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-3 py-1 font-blender-medium text-type-micro uppercase tracking-widest text-(--primary)">
                {STATUS_LABEL[active.status]}
              </span>
            </div>

            {/* Крупный логотип сезона вместо названия */}
            <div className="relative flex min-h-36 flex-1 items-center justify-center py-2">
              {active.logoUrl ? (
                <SeasonLogo src={active.logoUrl} alt={active.name} className="h-20 sm:h-24" />
              ) : (
                <h2 className="font-blender-medium text-3xl uppercase tracking-widest text-text-primary">
                  {active.name}
                </h2>
              )}
            </div>

            {/* Патч игры + длительность */}
            <div className="relative grid grid-cols-2 gap-2">
              <Stat label="Патч игры" value={active.patch} />
              <Stat label="Длительность" value={`от ${active.minDays} дней`} />
            </div>

            <p className="relative font-blender-book text-xs leading-relaxed text-text-muted">
              {personal} личных модификаторов · {forced} сезонных · заработанное переносится на
              основного персонажа.
            </p>

            {/* Кнопки сезона: конструктор билдов + трекер боевого пропуска */}
            <div className="relative mt-auto flex flex-col gap-2">
              <Link
                href={`/eft/progress/seasons/perks?s=${active.slug}`}
                className="flex h-12 items-center justify-center gap-2.5 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]"
              >
                <span aria-hidden className="icon-mask icon-eft-build-constructor h-5 w-5" />
                Конструктор билдов
              </Link>
              <Link
                href={`/eft/progress/seasons/tracker?s=${active.slug}`}
                className="flex h-12 items-center justify-center gap-2.5 rounded-xs border border-lines-hover bg-(--color-base) font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <ListChecks className="h-5 w-5" aria-hidden />
                BATTLEPASS Трекер
              </Link>
            </div>
          </article>

          {/* ── Следующий сезон: в разработке ──────────────────────────── */}
          <article
            aria-disabled="true"
            className="relative flex min-h-80 cursor-default select-none flex-col items-center justify-center gap-5 overflow-hidden rounded-lg border border-lines-hover/60 bg-(--color-darkbase) p-6"
          >
            {/* Сканлайны — диджитал/оффлайн-вид */}
            <span aria-hidden className="season-card-scanlines pointer-events-none absolute inset-0 z-0" />
            {/* Виньетка для глубины */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background:
                  'radial-gradient(circle at 50% 45%, transparent 40%, color-mix(in srgb, var(--color-darkbase) 80%, black) 100%)',
              }}
            />

            <div className="relative z-10 flex flex-col items-center gap-4 text-center opacity-55">
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                Следующий сезон
              </span>
              <h2 className="font-blender-medium text-4xl uppercase tracking-widest text-text-secondary">
                Сезон 2
              </h2>
              <span className="rounded-xs border border-lines-hover px-4 py-1.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                В разработке
              </span>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
