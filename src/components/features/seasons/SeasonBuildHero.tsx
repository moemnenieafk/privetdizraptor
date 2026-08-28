// Шапка страницы расшаренной сборки перков — по макету Figma (node 3257-130):
// слева hero-карточка билда (баннер курируемого / «Своя сборка» для кастома),
// справа лого сезона + заголовок «Оцени сборку сезонного ЧВК» + боксовые реакции.
// Серверный компонент; интерактив (лайк/дизлайк) — во вложенном клиентском.
import Image from 'next/image';
import { SeasonBuildReactions } from './SeasonBuildReactions';

interface Props {
  /** Канон-код сборки — для API реакций. */
  code: string;
  loggedIn: boolean;
  up: number;
  down: number;
  myValue: -1 | 0 | 1;
  /** Баннер курируемого билда (webp). Нет → карточка «Своя сборка». */
  banner?: string;
  /** Заголовок на карточке: имя курируемого билда или «Своя сборка». */
  cardTitle: string;
  /** Рамка карточки — акцент вайба курируемого билда либо нейтраль. */
  cardAccent: string;
  /** Лого сезона (многоцветный SVG — через <img>, не маску). Нет → строку логотипа скрываем. */
  logoUrl?: string;
  seasonName: string;
  /** Тил-акцент сезона для выделенной строки заголовка. */
  seasonAccent?: string;
}

export function SeasonBuildHero({
  code,
  loggedIn,
  up,
  down,
  myValue,
  banner,
  cardTitle,
  cardAccent,
  logoUrl,
  seasonName,
  seasonAccent,
}: Props) {
  return (
    <section className="mb-9 flex flex-col items-center gap-7 lg:flex-row lg:items-start lg:gap-12">
      {/* ── Левая hero-карточка билда (256×459 ≈ 9:16) ── */}
      {banner ? (
        <div
          className="relative aspect-[256/459] w-56 shrink-0 overflow-hidden rounded-lg border-2 sm:w-64"
          style={{ borderColor: cardAccent }}
        >
          <Image src={banner} alt={cardTitle} fill sizes="256px" className="object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-(--color-darkbase) to-transparent px-3 pb-3 pt-10 text-center font-blender-medium text-sm uppercase leading-tight tracking-widest text-text-primary">
            {cardTitle}
          </span>
        </div>
      ) : (
        <div className="relative flex aspect-[256/459] w-56 shrink-0 flex-col items-center justify-center gap-4 overflow-hidden rounded-lg border-2 border-lines-hover bg-(--color-darkbase) sm:w-64">
          <span aria-hidden className="icon-mask icon-eft-season1-badge size-24 bg-text-muted" />
          <span className="font-blender-medium text-sm uppercase tracking-widest text-text-secondary">
            {cardTitle}
          </span>
        </div>
      )}

      {/* ── Правая колонка: лого + заголовок + реакции ── */}
      <div className="flex flex-col items-center gap-5 lg:items-start">
        {/* Многоцветный SVG-лого сезона — через <img>, не маску (цвета важны). */}
        {logoUrl && <img src={logoUrl} alt={`Сезон ${seasonName}`} className="h-14 w-auto sm:h-16" />}

        <h1 className="max-w-sm text-center font-blender-medium text-2xl uppercase leading-tight tracking-widest text-text-primary lg:text-left">
          Оцени сборку{' '}
          <span style={{ color: seasonAccent ?? 'var(--primary)' }}>сезонного ЧВК</span> и выскажи мнение
        </h1>

        <SeasonBuildReactions code={code} loggedIn={loggedIn} up={up} down={down} myValue={myValue} />
      </div>
    </section>
  );
}
