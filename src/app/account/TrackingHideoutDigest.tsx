'use client';

// Домен «Убежище» вкладки «Трекинг» — модули убежища с иконками (icons.css:
// .icon-eft-<stationNormalizedName>, snake_case совпадает с зеркалом tarkov.dev),
// трекинг построенных уровней (useHideoutStore.setLevel) и предметы, необходимые
// на СЛЕДУЮЩИЙ уровень каждой станции (из hideoutNeeds.sources). Сюда переехала
// hideout-часть из домена «Предметы». Полный раздел — /eft/progress/hideout/modules.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, ArrowRight, ChevronDown } from 'lucide-react';
import { useHideoutStore } from '@/store/useHideoutStore';
import { itemIconUrl } from '@/lib/item-icon';
import type { HideoutNeed, HideoutStationInfo } from '@/db/hideout';
import { ResetControl } from '@/components/features/tracking/ResetControl';

// Метка-заголовок блока с линией (rule-micro-labels).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
      <span className="h-px w-6 bg-lines-hover" />
      {children}
    </h3>
  );
}

export function TrackingHideoutDigest({
  stations,
  hideoutNeeds,
}: {
  stations: HideoutStationInfo[];
  hideoutNeeds: HideoutNeed[];
}) {
  // mounted-гард: persist-стор только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const levels = useHideoutStore((s) => s.levels);
  const setLevel = useHideoutStore((s) => s.setLevel);
  const resetHideout = useHideoutStore((s) => s.reset);
  const [expanded, setExpanded] = useState<string | null>(null);

  const built = (station: string) => (mounted ? (levels[station] ?? 0) : 0);

  // Предметы по (станция, уровень): из sources агрегата hideoutNeeds.
  const itemsByStationLevel = useMemo(() => {
    const map = new Map<string, { itemId: string; name: string; count: number }[]>();
    for (const n of hideoutNeeds) {
      for (const s of n.sources) {
        const key = `${s.station}|${s.level}`;
        const arr = map.get(key) ?? [];
        arr.push({ itemId: n.itemId, name: n.itemName, count: s.count });
        map.set(key, arr);
      }
    }
    for (const arr of map.values()) arr.sort((a, b) => b.count - a.count);
    return map;
  }, [hideoutNeeds]);

  // Сводка: построено уровней / всего + осталось предметов (юнитов) на непостроенное.
  const totals = useMemo(() => {
    const totalLevels = stations.reduce((n, s) => n + s.maxLevel, 0);
    const builtLevels = stations.reduce((n, s) => n + Math.min(built(s.normalizedName), s.maxLevel), 0);
    let unitsLeft = 0;
    for (const n of hideoutNeeds) {
      for (const s of n.sources) if (s.level > built(s.station)) unitsLeft += s.count;
    }
    return { totalLevels, builtLevels, unitsLeft };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, hideoutNeeds, levels, mounted]);

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Уровней построено: <span className="text-success">{totals.builtLevels}</span>
          <span className="text-text-muted"> / {totals.totalLevels}</span>
          {' · осталось предметов '}
          <span className="font-blender-medium text-text-primary/70">{totals.unitsLeft}</span>
        </span>
        <div className="flex items-center gap-2">
          <ResetControl
            buttonLabel="СБРОС УБЕЖИЩА"
            buttonTitle="Сбросить построенные уровни убежища"
            modalTitle="Подтверждение сброса убежища"
            onConfirm={resetHideout}
          >
            <p>Вы действительно хотите сбросить построенные уровни убежища?</p>
            <p>
              Все станции вернутся к <span className="text-zinc-100">уровню 0</span>. Задания,
              предметы и достижения не затрагиваются.
            </p>
          </ResetControl>
          <Link
            href="/eft/progress/hideout/modules"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-lines-hover px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Модули
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <SectionLabel>Модули · {stations.length}</SectionLabel>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {stations.map((s) => {
          const lvl = built(s.normalizedName);
          const isMax = lvl >= s.maxLevel;
          const nextItems = isMax ? [] : (itemsByStationLevel.get(`${s.normalizedName}|${lvl + 1}`) ?? []);
          const isOpen = expanded === s.normalizedName;
          return (
            <div key={s.normalizedName} className="rounded-lg border border-lines-hover bg-(--color-base)">
              <div className="flex items-center gap-3 p-3">
                <span className={`h-9 w-9 shrink-0 icon-mask icon-eft-${s.normalizedName} ${lvl > 0 ? 'bg-text-primary' : 'bg-text-muted'}`} />
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : s.normalizedName)}
                  className="group flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={isMax ? 'Максимальный уровень' : 'Показать предметы на следующий уровень'}
                >
                  <span className="min-w-0 flex-1 truncate font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-colors group-hover:text-text-primary">
                    {s.name}
                  </span>
                  {!isMax && nextItems.length > 0 && (
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Понизить уровень"
                    onClick={() => setLevel(s.normalizedName, lvl - 1)}
                    disabled={lvl <= 0}
                    className="flex h-6 w-6 items-center justify-center rounded border border-lines-hover text-text-muted transition-colors hover:border-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className={`w-10 text-center font-blender-medium text-xs ${isMax ? 'text-success' : 'text-text-primary'}`}>
                    {isMax ? 'МАКС' : `${lvl} / ${s.maxLevel}`}
                  </span>
                  <button
                    type="button"
                    aria-label="Повысить уровень"
                    onClick={() => setLevel(s.normalizedName, Math.min(s.maxLevel, lvl + 1))}
                    disabled={isMax}
                    className="flex h-6 w-6 items-center justify-center rounded border border-lines-hover text-text-muted transition-colors hover:border-success hover:text-success disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Предметы на следующий уровень */}
              {isOpen && !isMax && (
                <div className="border-t border-lines-hover px-3 py-2">
                  {nextItems.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {nextItems.map((it) => (
                        <li key={it.itemId} className="flex items-center gap-2">
                          <span className="h-6 w-6 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={itemIconUrl(it.itemId)} alt="" loading="lazy" className="h-full w-full object-contain" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">{it.name}</span>
                          <span className="shrink-0 font-blender-medium text-xs text-text-primary/70">× {it.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-1 text-type-caption text-text-muted">
                      На уровень {lvl + 1} предметы не нужны (только требования станций/торговцев).
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
