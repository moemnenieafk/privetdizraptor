import type { Metadata } from 'next';
import Link from 'next/link';
import { CURRENT_SEASON } from '@/data/eft-seasons';
import { seasonPerks, personalPerks } from '@/lib/season-points';
import { SeasonLogo } from '@/components/features/seasons/SeasonLogo';
import { SeasonCountdown } from '@/components/features/seasons/SeasonCountdown';

export const metadata: Metadata = {
  title: 'Сезоны',
  description:
    'Сезоны Escape from Tarkov: механика сезонного персонажа и интерактивный конструктор модификаторов.',
};

const STATUS_LABEL: Record<string, string> = {
  announced: 'Анонсирован',
  live: 'Активен',
  ended: 'Завершён',
};

// Мини-плашка статы: микро-лейбл сверху, значение цифрами (font-blender-medium).
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-lines-hover bg-(--color-base) px-3 py-2.5">
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
  const accent = active.accent ?? 'var(--color-season-01)';
  const startLabel = active.startAt ? new Date(active.startAt).toLocaleDateString('ru-RU') : '—';

  return (
    <main className="flex w-full flex-col items-center pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── Активный сезон ─────────────────────────────────────────── */}
          <article className="group relative flex flex-col gap-6 overflow-hidden rounded-lg border border-lines-hover bg-card-menu p-6 transition-all duration-300 hover:border-(--primary)/50 hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--primary)_15%,transparent)]">
            {/* Свечение-подложка по бренду сезона */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-40"
              style={{
                background:
                  'radial-gradient(circle at 50% -20%, color-mix(in srgb, var(--color-season-01) 16%, transparent), transparent 70%)',
              }}
            />

            <div className="relative flex items-start justify-between gap-3">
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                Сезон {active.number}
                {active.kickoffEvent ? ` · старт с события «${active.kickoffEvent}»` : ''}
              </span>
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1 font-blender-medium text-type-micro uppercase tracking-widest"
                style={{
                  borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                  background: `color-mix(in srgb, ${accent} 10%, transparent)`,
                  color: accent,
                }}
              >
                <span className="size-1.5 animate-pulse rounded-full" style={{ background: accent }} aria-hidden />
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

            {/* Обратный отсчёт до конца сезона (к гарантированному минимуму — офиц. даты нет) */}
            {active.endAt && (
              <div className="relative">
                <SeasonCountdown target={active.endAt} accent={accent} minimum={active.endIsMinimum} />
              </div>
            )}

            {/* Патч + дата старта */}
            <div className="relative grid grid-cols-2 gap-2">
              <Stat label="Патч" value={active.patch} />
              <Stat label="Старт" value={startLabel} />
            </div>

            {/* Что делать в сезоне — кратко и по делу */}
            <div className="relative flex flex-col gap-1.5">
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                Что делать в сезоне
              </span>
              <ul className="flex flex-col gap-1.5 font-blender-book text-xs leading-snug text-text-muted">
                {[
                  'Создай сезонного персонажа — отдельный «свежий» мир, основной профиль не трогается.',
                  `Играй с модификаторами: ${forced} сезонных у всех + собери ${personal} личных в бюджет очков.`,
                  'Качай бесплатный Battle Pass — прогресс общий для всех режимов.',
                  'Забирай награды: ~25 косметик и ~12 разблокировок торговцев переносятся на аккаунт навсегда (перки — нет).',
                ].map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full" style={{ background: accent }} aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Кнопки сезона в ряд 50/50: активная — Battlepass-трекер (акцент), вторичная — конструктор */}
            <div className="relative mt-auto grid grid-cols-2 gap-2">
              <Link
                href={`/eft/progress/seasons/tracker?s=${active.slug}`}
                className="flex h-12 items-center justify-center gap-2 rounded-lg border px-3 text-center font-blender-medium text-xs uppercase leading-tight tracking-widest transition-colors"
                style={{
                  borderColor: accent,
                  background: `color-mix(in srgb, ${accent} 10%, transparent)`,
                  color: accent,
                }}
              >
                <span
                  aria-hidden
                  className="icon-mask icon-eft-battlepass-docs-tracker h-5 w-5 shrink-0"
                  style={{ backgroundColor: accent }}
                />
                Battlepass-трекер
              </Link>
              <Link
                href={`/eft/progress/seasons/perks?s=${active.slug}`}
                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-lines-hover bg-(--color-base) px-3 text-center font-blender-medium text-xs uppercase leading-tight tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <span aria-hidden className="icon-mask icon-eft-build-constructor h-5 w-5 shrink-0 bg-text-secondary" />
                Конструктор билдов
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
              <span className="rounded-lg border border-lines-hover px-4 py-1.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                В разработке
              </span>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
