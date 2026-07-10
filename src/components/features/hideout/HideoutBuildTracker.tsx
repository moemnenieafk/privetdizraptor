'use client';

// Геймифицированный трекинг постройки убежища. ДВА потребителя (единый дизайн):
//  - вкладка «Трекинг» Аккаунт Центра (компакт: левая 272px, gap-4);
//  - страница раздела /eft/progress/hideout/modules (wide: левая 348px, gap-7 [28px]).
// Две колонки: СЛЕВА выбираемый модуль (иконка + имя + точки уровней), СПРАВА —
// «бак материалов» следующего уровня: карточки предметов в едином стиле медиа-
// контейнеров (как QuestItemTracker: darkbase + inner-shadow + рамка), клик по
// карточке = +1 материал, фон заливается ВЕРТИКАЛЬНЫМ прогресс-баром (бак).
// Собрал всё → активируется «Построить уровень» (level+1, материалы тратятся).
// Счётчики — useHideoutStore.itemProgress (localStorage). Мобилка: стек, модули 2-в-ряд.
//
// ГОЧА иконок: normalizedName станций — kebab-case (bitcoin-farm), файлы масок —
// snake_case + спец-кейсы (medstation→med_station, illumination→illumitation-опечатка,
// intelligence-center→intelligence_centre).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, ArrowRight, Hammer, Check, Maximize2 } from 'lucide-react';
import { useHideoutStore, hideoutItemKey } from '@/store/useHideoutStore';
import { FillMedia } from '@/components/ui/FillMedia';
import { itemIconUrl } from '@/lib/item-icon';
import type { HideoutNeed, HideoutStationInfo } from '@/db/hideout';
import { ResetControl } from '@/components/features/tracking/ResetControl';

const ICON_OVERRIDES: Record<string, string> = {
  medstation: 'med_station',
  illumination: 'illumitation', // опечатка в имени файла — оставлена как есть
  'intelligence-center': 'intelligence_centre', // UK-спеллинг файла
};
export function stationIconClass(normalizedName: string): string {
  const file = ICON_OVERRIDES[normalizedName] ?? normalizedName.replace(/-/g, '_');
  return `icon-eft-${file}`;
}

// Метка-заголовок блока с линией (rule-micro-labels).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
      <span className="h-px w-6 bg-lines-hover" />
      {children}
    </h3>
  );
}

export function HideoutBuildTracker({
  stations,
  hideoutNeeds,
  wide = false,
  showModulesCta = true,
}: {
  stations: HideoutStationInfo[];
  hideoutNeeds: HideoutNeed[];
  /** Страница раздела: левая колонка 348px, gap 28px. false — компакт вкладки «Трекинг». */
  wide?: boolean;
  /** CTA «Модули» в шапке (на самой странице modules — не нужна). */
  showModulesCta?: boolean;
}) {
  // mounted-гард: persist-стор только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const levels = useHideoutStore((s) => s.levels);
  const itemProgress = useHideoutStore((s) => s.itemProgress);
  const setLevel = useHideoutStore((s) => s.setLevel);
  const setItemProgress = useHideoutStore((s) => s.setItemProgress);
  const clearLevelProgress = useHideoutStore((s) => s.clearLevelProgress);
  const resetHideout = useHideoutStore((s) => s.reset);
  const [selected, setSelected] = useState<string | null>(null);

  const built = (station: string) => (mounted ? (levels[station] ?? 0) : 0);

  // Предметы по (станция, уровень): из sources агрегата hideoutNeeds (+fir, +slug).
  const itemsByStationLevel = useMemo(() => {
    const map = new Map<string, { itemId: string; name: string; count: number; fir?: boolean; slug?: string }[]>();
    for (const n of hideoutNeeds) {
      for (const s of n.sources) {
        const key = `${s.station}|${s.level}`;
        const arr = map.get(key) ?? [];
        arr.push({
          itemId: n.itemId,
          name: n.itemName,
          count: s.count,
          ...(s.fir ? { fir: true } : {}),
          ...(n.slug ? { slug: n.slug } : {}),
        });
        map.set(key, arr);
      }
    }
    for (const arr of map.values()) arr.sort((a, b) => b.count - a.count);
    return map;
  }, [hideoutNeeds]);

  // Дефолтный выбор после маунта — первая недостроенная станция.
  useEffect(() => {
    if (!mounted || selected) return;
    const firstUnbuilt = stations.find((s) => built(s.normalizedName) < s.maxLevel);
    setSelected((firstUnbuilt ?? stations[0])?.normalizedName ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Сводка: построено уровней / всего.
  const totals = useMemo(() => {
    const totalLevels = stations.reduce((n, s) => n + s.maxLevel, 0);
    const builtLevels = stations.reduce((n, s) => n + Math.min(built(s.normalizedName), s.maxLevel), 0);
    return { totalLevels, builtLevels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, levels, mounted]);

  const sel = stations.find((s) => s.normalizedName === selected) ?? null;
  const selLvl = sel ? built(sel.normalizedName) : 0;
  const selIsMax = sel ? selLvl >= sel.maxLevel : false;
  const nextLevel = selLvl + 1;
  const selItems = sel && !selIsMax ? (itemsByStationLevel.get(`${sel.normalizedName}|${nextLevel}`) ?? []) : [];

  // «Бак» выбранного уровня: собрано/нужно по каждому предмету + общий прогресс.
  const found = (itemId: string) =>
    sel ? Math.min(mounted ? (itemProgress[hideoutItemKey(sel.normalizedName, nextLevel, itemId)] ?? 0) : 0, Infinity) : 0;
  const tank = useMemo(() => {
    const need = selItems.reduce((n, it) => n + it.count, 0);
    const got = selItems.reduce((n, it) => n + Math.min(found(it.itemId), it.count), 0);
    return { need, got, pct: need > 0 ? Math.round((got / need) * 100) : 0, full: need > 0 && got >= need };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selItems, itemProgress, mounted, selected, nextLevel]);

  const buildLevel = () => {
    if (!sel || selIsMax) return;
    setLevel(sel.normalizedName, nextLevel);
    clearLevelProgress(sel.normalizedName, nextLevel); // материалы «потрачены»
  };

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Построено: <span className="text-success">{totals.builtLevels}</span>
          <span className="text-text-muted"> / {totals.totalLevels} уровней</span>
        </span>
        <div className="flex items-center gap-2">
          <ResetControl
            buttonLabel="СБРОС УБЕЖИЩА"
            buttonTitle="Сбросить построенные уровни и материалы"
            modalTitle="Подтверждение сброса убежища"
            onConfirm={resetHideout}
          >
            <p>Вы действительно хотите сбросить прогресс убежища?</p>
            <p>
              Все станции вернутся к <span className="text-zinc-100">уровню 0</span>, счётчики
              собранных материалов обнулятся. Задания, предметы и достижения не затрагиваются.
            </p>
          </ResetControl>
          {showModulesCta && (
            <Link
              href="/eft/progress/hideout/modules"
              className="inline-flex h-7 items-center gap-1.5 rounded border border-lines-hover px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              Модули
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* ── Две колонки: модули | бак материалов (wide: 348px + gap 28px) ── */}
      <div className={`grid grid-cols-1 ${wide ? 'gap-7 lg:grid-cols-[348px_1fr]' : 'gap-4 lg:grid-cols-[272px_1fr]'}`}>
        {/* СЛЕВА: выбираемый модуль. Высота = высоте правой панели (absolute-заполнение
            grid-ячейки на lg), список скроллится внутри почти незаметным скроллбаром. */}
        <div className="flex flex-col">
          <SectionLabel>Модули · {stations.length}</SectionLabel>
          <div className="relative flex-1 lg:min-h-96">
          <div className="grid grid-cols-2 gap-1.5 lg:absolute lg:inset-0 lg:flex lg:flex-col lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--color-lines-hover)_55%,transparent)_transparent]">
            {stations.map((s) => {
              const lvl = built(s.normalizedName);
              const isMax = lvl >= s.maxLevel;
              const isSel = selected === s.normalizedName;
              return (
                <button
                  key={s.normalizedName}
                  type="button"
                  onClick={() => setSelected(s.normalizedName)}
                  className={`flex shrink-0 items-center gap-2.5 rounded border px-2.5 py-2 text-left transition-all duration-150 ${
                    isSel
                      ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
                      : 'border-lines-hover bg-(--color-base) hover:border-text-secondary'
                  }`}
                >
                  <span
                    className={`h-7 w-7 shrink-0 icon-mask ${stationIconClass(s.normalizedName)} ${
                      isMax ? 'bg-success' : lvl > 0 ? 'bg-text-primary' : 'bg-text-muted'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-blender-medium text-type-micro uppercase tracking-widest ${isSel ? 'text-(--primary)' : 'text-text-secondary'}`}>
                      {s.name}
                    </span>
                    <span className="mt-1 flex items-center gap-1">
                      {Array.from({ length: s.maxLevel }, (_, i) => (
                        <span
                          key={i}
                          className={`h-1 w-3 rounded-xs ${i < lvl ? (isMax ? 'bg-success' : 'bg-(--primary)') : 'bg-lines-hover'}`}
                        />
                      ))}
                    </span>
                  </span>
                  {isMax && <Check className="h-3.5 w-3.5 shrink-0 text-success" />}
                </button>
              );
            })}
          </div>
          </div>
        </div>

        {/* СПРАВА: бак материалов выбранной станции */}
        <div className="min-w-0">
          <SectionLabel>Стройка</SectionLabel>
          {sel ? (
            <div className="rounded-lg border border-lines-hover bg-(--color-base) p-4">
              {/* Шапка станции: имя + степпер уровня */}
              <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-lines-hover pb-3">
                <span className={`h-8 w-8 shrink-0 icon-mask ${stationIconClass(sel.normalizedName)} ${selIsMax ? 'bg-success' : 'bg-text-primary'}`} />
                <span className="font-blender-medium text-base uppercase tracking-widest text-text-primary">
                  {sel.name}
                </span>
                <Link
                  href={`/eft/progress/hideout/modules/${sel.normalizedName}`}
                  title="Страница модуля"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Link>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Понизить уровень"
                    onClick={() => setLevel(sel.normalizedName, selLvl - 1)}
                    disabled={selLvl <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded border border-lines-hover text-text-muted transition-colors hover:border-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className={`w-14 text-center font-blender-medium text-sm ${selIsMax ? 'text-success' : 'text-text-primary'}`}>
                    {selIsMax ? 'МАКС' : `${selLvl} / ${sel.maxLevel}`}
                  </span>
                  <button
                    type="button"
                    aria-label="Повысить уровень"
                    onClick={() => setLevel(sel.normalizedName, Math.min(sel.maxLevel, selLvl + 1))}
                    disabled={selIsMax}
                    className="flex h-7 w-7 items-center justify-center rounded border border-lines-hover text-text-muted transition-colors hover:border-success hover:text-success disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {selIsMax ? (
                <p className="flex items-center gap-2 py-6 text-center text-sm text-success">
                  <Check className="h-4 w-4" /> Станция построена полностью.
                </p>
              ) : (
                <>
                  {/* Общий бак уровня + кнопка «Построить» */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-primary/50">
                          Материалы на уровень {nextLevel}
                        </span>
                        <span className="font-blender-medium text-xs text-text-primary/70">
                          {tank.got} / {tank.need}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-xs bg-card-menu">
                        <div
                          className={`h-full rounded-xs transition-[width] duration-500 ${tank.full ? 'bg-success' : 'bg-(--primary)'}`}
                          style={{ width: `${tank.pct}%` }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={buildLevel}
                      disabled={!tank.full && tank.need > 0}
                      title={tank.full || tank.need === 0 ? `Построить уровень ${nextLevel}` : 'Сначала соберите все материалы'}
                      className={`flex h-9 shrink-0 items-center gap-2 rounded border px-3.5 font-blender-medium text-type-caption uppercase tracking-widest transition-all ${
                        tank.full || tank.need === 0
                          ? 'border-success bg-success/15 text-success hover:bg-success/25'
                          : 'cursor-not-allowed border-lines-hover text-text-muted opacity-50'
                      }`}
                    >
                      <Hammer className="h-4 w-4" />
                      Построить
                    </button>
                  </div>

                  {selItems.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                      {selItems.map((it) => {
                        const key = hideoutItemKey(sel.normalizedName, nextLevel, it.itemId);
                        const got = Math.min(mounted ? (itemProgress[key] ?? 0) : 0, it.count);
                        const pct = it.count > 0 ? Math.round((got / it.count) * 100) : 0;
                        const done = got >= it.count;
                        return (
                          <div
                            key={it.itemId}
                            className={`group relative select-none rounded-lg border p-2.5 transition-all duration-150 ${
                              done
                                ? 'border-success/50 bg-success/5'
                                : 'border-lines-hover bg-card-menu/40'
                            }`}
                          >
                            {/* Медиа-бак: тап = +1 материал, вертикальный драг = залив (FillMedia) */}
                            <FillMedia
                              imageSrc={itemIconUrl(it.itemId)}
                              alt={it.name}
                              pct={pct}
                              done={done}
                              className="mx-auto"
                              imgClassName="transition-transform duration-150 group-hover:scale-105"
                              imgLoading="lazy"
                              interactive={{
                                value: got,
                                max: it.count,
                                onChange: (n) => setItemProgress(key, n),
                                onTap: done ? undefined : () => setItemProgress(key, got + 1),
                              }}
                            >
                              {/* FIR-галочка на медиаконтейнере */}
                              {it.fir && !done && (
                                <span
                                  title="Требуется «найдено в рейде»"
                                  className="absolute -right-1 -top-1 z-20 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-lines-hover bg-(--color-base)"
                                >
                                  <span className="h-3 w-3 icon-mask icon-eft-quests-side bg-(--primary)" />
                                </span>
                              )}

                              {/* − материал: слева от бака (при ховере) */}
                              {got > 0 && (
                                <button
                                  type="button"
                                  aria-label="Убавить материал"
                                  title="−1 материал"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemProgress(key, got - 1);
                                  }}
                                  className="absolute -left-7 top-1/2 z-20 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-lines-hover bg-(--color-base) text-text-muted opacity-0 transition-opacity hover:border-danger hover:text-danger group-hover:opacity-100"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                              )}

                              {/* Ссылка на предмет: справа от бака (при ховере) */}
                              {it.slug && (
                                <Link
                                  href={`/eft/items/item/${it.slug}`}
                                  aria-label="Открыть карточку предмета"
                                  title="Карточка предмета"
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute -right-7 top-1/2 z-20 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-lines-hover bg-(--color-base) text-text-muted opacity-0 transition-opacity hover:border-(--primary) hover:text-(--primary) group-hover:opacity-100"
                                >
                                  <Maximize2 className="h-3 w-3" />
                                </Link>
                              )}
                            </FillMedia>

                            <p className="mt-2 line-clamp-2 text-center text-type-micro uppercase leading-tight tracking-wider text-text-secondary">
                              {it.name}
                            </p>
                            <p className={`mt-1 text-center font-blender-medium text-xs ${done ? 'text-success' : 'text-text-primary/70'}`}>
                              {got} / {it.count}
                            </p>
                            {it.fir && (
                              <p className="mt-1 flex justify-center">
                                <span className="inline-flex items-center whitespace-nowrap rounded-xs border border-(--primary)/50 bg-primary/10 px-1 py-px text-type-micro uppercase tracking-wider text-(--primary)">
                                  Найдено в рейде
                                </span>
                              </p>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-4 text-sm text-text-muted">
                      Предметы на уровень {nextLevel} не нужны — только требования станций/торговцев/навыков.
                      Кнопка «Построить» активна.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-lines-hover bg-(--color-base) p-8 text-center text-sm text-text-muted">
              Выберите модуль слева.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
