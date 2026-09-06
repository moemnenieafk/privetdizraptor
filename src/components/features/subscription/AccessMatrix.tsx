import { RequirementChip } from '@/components/features/hideout/RequirementChip';
import type { ShowcaseTier } from '@/lib/gating/showcase';

/**
 * Матрица доступа — ОДИН список возможностей со статусом «открыто / нужен тариф»,
 * вместо трёх раздельных списков внутри карточек. Решение V4DYA 06.09: раздельные списки
 * не давали прочитать «что я теряю», а карточка бесплатного тарифа оставалась пустой.
 *
 * Язык статуса переиспользован из Убежища (RequirementChip): выполнено — галочка
 * nvg-green, не выполнено — амбер. Игрок этот словарь уже знает по требованиям станций,
 * поэтому «замок» читается как «требование не добрано», а не как запрет.
 *
 * В матрицу попадают ТОЛЬКО платные возможности. Бесплатных гейтов в реестре больше сотни
 * (все разделы портала по умолчанию free) — их вывод превратил бы витрину в простыню;
 * вместо этого сверху идёт короткая сводка по ядру из перков бесплатного тарифа.
 */

interface AccessMatrixProps {
  showcase: ShowcaseTier[];
  /** Ранг текущего пользователя — по нему решается, открыта строка или нет. */
  currentRank: number;
}

export function AccessMatrix({ showcase, currentRank }: AccessMatrixProps) {
  // Разворачиваем витрину в плоский список: возможность + тир, который её открывает.
  const rows = showcase
    .filter((t) => t.rank > 0)
    .flatMap((t) => t.features.map((f) => ({ ...f, tierName: t.name, tierRank: t.rank })));

  const freeTier = showcase.find((t) => t.rank === 0);
  const corePerks = freeTier?.perks ?? [];

  if (rows.length === 0 && corePerks.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <h2 className="shrink-0 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          Что открывает допуск
        </h2>
        <div className="h-px flex-1 bg-lines-hover" />
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-lines-hover bg-card-menu p-6">
        {/* Сводка по бесплатному ядру — главный аргумент ЦТА, его нельзя терять. */}
        {corePerks.length > 0 ? (
          <div className="flex flex-col gap-2 border-b border-lines-hover pb-4">
            <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              Бесплатно всем
            </span>
            <ul className="flex flex-col gap-1.5 font-blender-book text-xs leading-snug text-text-secondary">
              {corePerks.map((perk) => (
                <li key={perk} className="flex gap-2">
                  <span
                    className="mt-1.5 size-1 shrink-0 rounded-full bg-nvg-green"
                    aria-hidden
                  />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="flex flex-col">
            {rows.map((row) => {
              const open = currentRank >= row.tierRank;
              return (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-4 border-b border-lines-hover py-3 last:border-b-0"
                >
                  <span className="font-blender-book text-sm leading-snug text-text-secondary">
                    {row.label}
                  </span>
                  <span className="shrink-0">
                    <RequirementChip
                      label={open ? 'Открыто' : row.tierName}
                      met={open}
                      title={
                        open
                          ? 'Доступно на вашем тарифе'
                          : `Открывается на тарифе «${row.tierName}»`
                      }
                    />
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
