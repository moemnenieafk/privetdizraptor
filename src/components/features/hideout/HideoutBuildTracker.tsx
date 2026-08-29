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
import { useHideoutStore } from '@/store/useHideoutStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { FoundInRaidBadge } from '@/components/ui/FoundInRaidBadge';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePmcStatsStore } from '@/store/usePmcStatsStore';
import { useManualProfileStore } from '@/store/useManualProfileStore';
import { resolveSkillLevel } from '@/lib/tarkov/player-view-merge';
import { editionFloor } from '@/lib/hideout-edition';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { FillMedia } from '@/components/ui/FillMedia';
import { TrackCell } from '@/components/ui/kit';
import { itemIconUrl } from '@/lib/item-icon';
import { traderImg } from '@/lib/trader-utils';
import { SKILL_ICONS, SKILL_RU } from '@/components/features/adaptive/skill-icons';
import type { HideoutNeed, HideoutStationInfo, HideoutUnlockMap } from '@/db/hideout';
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

// Порядок постройки модулей «как в игре» (ранняя прогрессия → поздняя). Явный список —
// правится одной строкой; станции вне списка уезжают в конец. Порядок задал V4DYA.
const BUILD_ORDER = [
  'security', 'illumination', 'lavatory', 'stash', 'generator',
  'water-collector', 'heating', 'vents', 'workbench', 'nutrition-unit',
  'rest-space', 'medstation', 'intelligence-center', 'shooting-range', 'library',
  'scav-case', 'bitcoin-farm', 'solar-power', 'air-filtering-unit', 'booze-generator',
  'weapon-rack', 'gear-rack', 'hall-of-fame', 'gym', 'defective-wall', 'cultist-circle',
];
const buildRank = (nn: string) => {
  const i = BUILD_ORDER.indexOf(nn);
  return i === -1 ? BUILD_ORDER.length : i;
};

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
  unlockMap,
  initialModule,
  wide = false,
  showModulesCta = true,
  moduleTiles = false,
}: {
  stations: HideoutStationInfo[];
  hideoutNeeds: HideoutNeed[];
  /** Требования разблокировки уровня (станции/торговцы/навыки) по ключу `${nn}|${level}`. */
  unlockMap?: HideoutUnlockMap;
  /** Дип-линк из «Убежище ЧВК» (`?module=`): предвыбрать этот модуль (normalizedName). */
  initialModule?: string;
  /** Страница раздела: левая колонка 348px, gap 28px. false — компакт вкладки «Трекинг». */
  wide?: boolean;
  /** CTA «Модули» в шапке (на самой странице modules — не нужна). */
  showModulesCta?: boolean;
  /** Дизайн /modules: слева ПЛИТКИ модулей (стиль «Убежище ЧВК», клик = выбрать),
   *  справа — сборка БЕЗ обводки. false — список-строки + карточка с рамкой (вкладка «Трекинг»). */
  moduleTiles?: boolean;
}) {
  // mounted-гард: persist-стор только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const levels = useHideoutStore((s) => s.levels);
  const setLevel = useHideoutStore((s) => s.setLevel);
  const clearLevelProgress = useHideoutStore((s) => s.clearLevelProgress);
  // Владение материалами читаем/пишем в СХРОН (единый пул, итерация 5): «собрано» = ownedItems
  // по item.id (кламп до нужного count в месте отображения), клик по ячейке = bumpCount.
  const ownedItems = useInventoryStore((s) => s.ownedItems);
  const bumpCount = useInventoryStore((s) => s.bumpCount);
  const setCount = useInventoryStore((s) => s.setCount);
  const resetHideout = useHideoutStore((s) => s.reset);
  const resetStation = useHideoutStore((s) => s.resetStation);
  const [selected, setSelected] = useState<string | null>(null);
  const [hammering, setHammering] = useState(false);

  // Издание активного профиля — для авто-построенных модулей (TUE → Круг сектантов). Читаем,
  // но НЕ пишем в стор: накладываем на уровень через editionFloor (см. built ниже).
  const edition = usePlayerStore((s) => s.profiles.find((p) => p.id === s.activeProfileId)?.edition);
  // Уровни лояльности торговцев активного профиля (nn → 1..4, дефолт 1). Ключ — normalizedName,
  // совпадает с StationUnlock.traders[].nn → прямая сверка требований-торговцев.
  const traderLevels = usePlayerStore((s) => s.profiles.find((p) => p.id === s.activeProfileId)?.traderLevels);
  // Навыки игрока: загруженный профиль (usePmcStatsStore.view) + ручные оверрайды (Слой C).
  // Читаем канонически через resolveSkillLevel — manual бьёт загруженное (last-write-wins, §4.7).
  const skillView = usePmcStatsStore((s) => s.view);
  const manualSkills = useManualProfileStore((s) => s.skills);

  // Порядок модулей: /modules — по постройке «как в игре»; иначе — как пришли (алфавит из ридера).
  const orderedStations = useMemo(
    () => (moduleTiles ? [...stations].sort((a, b) => buildRank(a.normalizedName) - buildRank(b.normalizedName)) : stations),
    [stations, moduleTiles],
  );

  // Построенный уровень: max(сохранённый, гарантированный изданием). До маунта — 0 (hydration).
  const built = (station: string) =>
    mounted ? Math.max(levels[station] ?? 0, editionFloor(station, edition)) : 0;

  // Предметы по (станция, уровень): из sources агрегата hideoutNeeds (+fir, +slug, +bgColor).
  const itemsByStationLevel = useMemo(() => {
    const map = new Map<string, { itemId: string; name: string; count: number; fir?: boolean; slug?: string; backgroundColor?: string }[]>();
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
          ...(n.backgroundColor ? { backgroundColor: n.backgroundColor } : {}),
        });
        map.set(key, arr);
      }
    }
    for (const arr of map.values()) arr.sort((a, b) => b.count - a.count);
    return map;
  }, [hideoutNeeds]);

  // Дефолтный выбор после маунта: /modules — ПЕРВЫЙ модуль списка (всегда что-то выбрано,
  // «выберите модуль» не мелькает); вкладка «Трекинг» — первая недостроенная (как было).
  useEffect(() => {
    if (!mounted || selected) return;
    if (moduleTiles) {
      // `initialModule` (из `?module=` «Убежище ЧВК») имеет приоритет, если валиден; иначе первый.
      const fromParam = initialModule && orderedStations.some((s) => s.normalizedName === initialModule) ? initialModule : null;
      setSelected(fromParam ?? orderedStations[0]?.normalizedName ?? null);
    } else {
      const firstUnbuilt = stations.find((s) => built(s.normalizedName) < s.maxLevel);
      setSelected((firstUnbuilt ?? stations[0])?.normalizedName ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Сводка: построено уровней / всего.
  const totals = useMemo(() => {
    const totalLevels = stations.reduce((n, s) => n + s.maxLevel, 0);
    const builtLevels = stations.reduce((n, s) => n + Math.min(built(s.normalizedName), s.maxLevel), 0);
    return { totalLevels, builtLevels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, levels, mounted]);

  const sel =
    orderedStations.find((s) => s.normalizedName === selected) ??
    (moduleTiles ? (orderedStations[0] ?? null) : null);
  const selLvl = sel ? built(sel.normalizedName) : 0;
  const selIsMax = sel ? selLvl >= sel.maxLevel : false;
  // Модуль ПОЛНОСТЬЮ обеспечен изданием (напр. Схрон L4 на EOD/TUE, Круг на TUE) → сбрасывать
  // нечего: built() всё равно вернёт editionFloor. Мини-сброс для такого модуля прячем.
  const selLockedByEdition = sel ? editionFloor(sel.normalizedName, edition) >= sel.maxLevel : false;
  const nextLevel = selLvl + 1;
  const selItems = sel && !selIsMax ? (itemsByStationLevel.get(`${sel.normalizedName}|${nextLevel}`) ?? []) : [];

  // Требования разблокировки следующего уровня: станции-пререквизиты + торговцы + навыки.
  // ВСЕ ТРИ сверяются с профилем и гейтят постройку (§ «связано и работает»):
  //  · станции — built() из useHideoutStore;
  //  · торговцы — traderLevels активного профиля (дефолт LL1);
  //  · навыки — реальный уровень игрока (загруженный профиль + ручные оверрайды).
  const selUnlock = sel && !selIsMax ? unlockMap?.[`${sel.normalizedName}|${nextLevel}`] : undefined;

  // Есть ли вообще данные о навыках игрока (загружен профиль или ручной ввод). Нет данных —
  // навык «неизвестен»: НЕ блокируем постройку и НЕ красим (планировщик не гейтит на пустом профиле).
  const hasSkillData = mounted && (skillView != null || Object.keys(manualSkills).length > 0);
  const skillLevelOf = (id: string) => (mounted ? resolveSkillLevel(skillView, manualSkills, id) : 0);
  const traderLevelOf = (nn: string) => (mounted ? (traderLevels?.[nn] ?? 0) : 0);

  const stationReqsMet = selUnlock ? selUnlock.stations.every((s) => built(s.nn) >= s.level) : true;
  const traderReqsMet = selUnlock ? selUnlock.traders.every((t) => traderLevelOf(t.nn) >= t.level) : true;
  // Навык блокирует, только когда данные есть И уровень недобран (unknown → не блокирует).
  const skillReqsMet = selUnlock ? selUnlock.skills.every((sk) => !hasSkillData || skillLevelOf(sk.id) >= sk.level) : true;
  const reqsMet = stationReqsMet && traderReqsMet && skillReqsMet;

  // «Бак» выбранного уровня: собрано/нужно по каждому предмету + общий прогресс.
  // «Собрано» = сколько предмета лежит в СХРОНЕ (ownedItems по item.id).
  const found = (itemId: string) => (mounted ? (ownedItems[itemId] ?? 0) : 0);
  const tank = useMemo(() => {
    const need = selItems.reduce((n, it) => n + it.count, 0);
    const got = selItems.reduce((n, it) => n + Math.min(found(it.itemId), it.count), 0);
    return { need, got, pct: need > 0 ? Math.round((got / need) * 100) : 0, full: need > 0 && got >= need };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selItems, ownedItems, mounted, selected, nextLevel]);

  // Сегментный бак (/modules): деление = категория (предмет) закрыта целиком (got ≥ нужно).
  const matSegments = selItems.map((it) => Math.min(found(it.itemId), it.count) >= it.count);

  // Готовность постройки: материалы собраны И ВСЕ требования (станции + торговцы + навыки) выполнены.
  const materialsReady = tank.full || tank.need === 0;
  const canBuildSel = materialsReady && reqsMet;

  const buildLevel = () => {
    if (!sel || selIsMax || !reqsMet) return; // не строим при невыполненных требованиях разблокировки
    setLevel(sel.normalizedName, nextLevel);
    clearLevelProgress(sel.normalizedName, nextLevel); // материалы «потрачены»
  };
  // Постройка с анимацией молотка (кнопка в шапке /modules): проиграть удар → построить.
  const triggerBuild = () => {
    setHammering(true);
    window.setTimeout(() => setHammering(false), 450);
    buildLevel();
  };

  // Глобальный «Сброс убежища» — один элемент, используется в шапке (Трекинг) или под плитками (/modules).
  const resetHideoutControl = (
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
  );

  return (
    <div className="flex flex-col">
      {!moduleTiles && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
            Построено: <span className="text-success">{totals.builtLevels}</span>
            <span className="text-text-muted"> / {totals.totalLevels} уровней</span>
          </span>
          <div className="flex items-center gap-2">
            {resetHideoutControl}
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
      )}

      {/* ── Две колонки: модули | бак материалов (wide: 348px + gap 28px) ── */}
      <div className={`grid grid-cols-1 ${wide ? (moduleTiles ? 'gap-7 lg:grid-cols-[420px_1fr]' : 'gap-7 lg:grid-cols-[348px_1fr]') : 'gap-4 lg:grid-cols-[272px_1fr]'}`}>
        {/* СЛЕВА: выбираемый модуль. Высота = высоте правой панели (absolute-заполнение
            grid-ячейки на lg), список скроллится внутри почти незаметным скроллбаром. */}
        <div className="flex flex-col">
          {!moduleTiles && <SectionLabel>Модули · {stations.length}</SectionLabel>}
          <div className="relative flex-1 lg:min-h-96">
          <div
            className={
              moduleTiles
                ? 'grid grid-cols-3 gap-1.5 content-start'
                : 'grid grid-cols-2 gap-1.5 lg:absolute lg:inset-0 lg:flex lg:flex-col lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--color-lines-hover)_55%,transparent)_transparent]'
            }
          >
            {orderedStations.map((s) => {
              const lvl = built(s.normalizedName);
              const isMax = lvl >= s.maxLevel;
              const isSel = selected === s.normalizedName;
              const pct = s.maxLevel > 0 ? Math.round((lvl / s.maxLevel) * 100) : 0;

              // Плитка-выбор (стиль «Убежище ЧВК»): иконка + уровень «0N» + имя + гориз. заливка.
              if (moduleTiles) {
                return (
                  <button
                    key={s.normalizedName}
                    type="button"
                    onClick={() => setSelected(s.normalizedName)}
                    title={`${s.name} — ур. ${lvl}/${s.maxLevel}`}
                    className={`group relative flex min-h-16 select-none flex-col items-center justify-center gap-1 overflow-hidden rounded-xs border p-2 transition-all ${
                      isSel
                        ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
                        : 'border-lines-hover bg-(--color-base) hover:brightness-110'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${isMax ? 'bg-success/25' : 'bg-(--primary)/20'}`}
                      style={{ width: `${pct}%` }}
                    />
                    <span className="relative flex items-center gap-2">
                      <span
                        className={`h-7 w-7 shrink-0 icon-mask ${stationIconClass(s.normalizedName)} ${
                          isMax ? 'bg-success' : lvl > 0 ? 'bg-(--primary)' : 'bg-text-muted'
                        }`}
                      />
                      <span
                        className={`font-blender-medium text-[1.375rem] leading-none tabular-nums ${
                          isMax ? 'text-success' : lvl > 0 ? 'text-(--primary)' : 'text-text-muted'
                        }`}
                      >
                        {String(lvl).padStart(2, '0')}
                      </span>
                    </span>
                    <span className={`relative line-clamp-1 w-full text-center font-blender-medium text-type-micro uppercase tracking-wide ${isSel ? 'text-(--primary)' : 'text-text-secondary'}`}>
                      {s.name}
                    </span>
                  </button>
                );
              }

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
          {moduleTiles && <div className="mt-3 flex justify-start">{resetHideoutControl}</div>}
        </div>

        {/* СПРАВА: бак материалов выбранной станции */}
        <div className="min-w-0">
          {!moduleTiles && <SectionLabel>Стройка</SectionLabel>}
          {sel ? (
            <div className={moduleTiles ? '' : 'rounded-lg border border-lines-hover bg-(--color-base) p-4'}>
              {/* Шапка станции */}
              {moduleTiles ? (
                // /modules: 56-иконка + имя + уровень-индикатор «0N» + мини-сброс модуля + «Построить».
                <div className="mb-3 flex items-center gap-3">
                  <span className={`h-14 w-14 shrink-0 icon-mask ${stationIconClass(sel.normalizedName)} ${selIsMax ? 'bg-success' : 'bg-text-primary'}`} />
                  <span className="font-blender-medium text-base uppercase tracking-widest text-text-primary">
                    {sel.name}
                  </span>
                  <span className={`font-blender-medium text-2xl leading-none tabular-nums ${selIsMax ? 'text-success' : 'text-(--primary)'}`}>
                    {String(selLvl).padStart(2, '0')}
                  </span>
                  {!selLockedByEdition && (
                    <ResetControl
                      buttonLabel=""
                      buttonTitle={`Сбросить модуль «${sel.name}»`}
                      modalTitle="Сброс модуля"
                      onConfirm={() => resetStation(sel.normalizedName)}
                      buttonClassName="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-lines-hover text-text-muted transition-colors hover:border-danger hover:text-danger"
                    >
                      <p>Сбросить модуль <span className="text-zinc-100">«{sel.name}»</span>?</p>
                      <p>
                        Уровень станции вернётся к <span className="text-zinc-100">0</span>, собранные для
                        неё материалы обнулятся. Остальное убежище не затрагивается.
                      </p>
                    </ResetControl>
                  )}
                  {!selIsMax && (
                    <button
                      type="button"
                      onClick={triggerBuild}
                      disabled={!canBuildSel}
                      title={
                        !reqsMet
                          ? 'Сначала выполните требования разблокировки (станции · торговцы · навыки)'
                          : materialsReady
                            ? `Построить уровень ${nextLevel}`
                            : 'Сначала соберите все материалы'
                      }
                      className={`ml-auto flex h-9 shrink-0 items-center gap-2 rounded border px-3.5 font-blender-medium text-type-caption uppercase tracking-widest transition-all ${
                        canBuildSel
                          ? 'border-success bg-success/15 text-success hover:bg-success/25'
                          : 'cursor-not-allowed border-lines-hover text-text-muted opacity-50'
                      }`}
                    >
                      <span
                        aria-hidden
                        // Спрайт 8 кадров (2048×256) → на 16px иконке маска 128px (8×16), кадр 0 статикой.
                        className={`h-4 w-4 shrink-0 bg-current icon-eft-hideout-hammer-anim ${hammering ? 'animate-hammer-hit' : ''}`}
                        style={{
                          maskSize: '128px 16px',
                          WebkitMaskSize: '128px 16px',
                          maskRepeat: 'no-repeat',
                          WebkitMaskRepeat: 'no-repeat',
                          maskPosition: '0 0',
                          WebkitMaskPosition: '0 0',
                        }}
                      />
                      Построить
                    </button>
                  )}
                </div>
              ) : (
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
              )}

              {selIsMax ? (
                <p className="flex items-center gap-2 py-6 text-center text-sm text-success">
                  <Check className="h-4 w-4" /> Станция построена полностью.
                </p>
              ) : (
                <>
                  {/* Прогресс материалов уровня */}
                  {moduleTiles ? (
                    // /modules: только сегментный бар под шапкой (деление = закрытая категория). Построить — в шапке.
                    selItems.length > 0 && (
                      <div className="mb-4 flex gap-1">
                        {selItems.map((it, i) => (
                          <span
                            key={it.itemId}
                            title={`${it.name}: ${matSegments[i] ? 'собрано' : 'не добрано'}`}
                            className={`h-2 flex-1 rounded-xs transition-colors ${matSegments[i] ? 'bg-success' : 'bg-card-menu'}`}
                          />
                        ))}
                      </div>
                    )
                  ) : (
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
                  )}

                  {/* Требования разблокировки уровня — ВСЕ сверяются с профилем персонажа:
                      станции (built), торговцы (traderLevels), навыки (загруженный профиль + ручные).
                      Met → зелёный+галочка, не добрано → амбер, навык без данных → нейтральный.
                      Бейджи крупные: иконка 28px, текст caption. Только /modules. */}
                  {moduleTiles && selUnlock && selUnlock.stations.length + selUnlock.traders.length + selUnlock.skills.length > 0 && (
                    <div className="mb-4 flex flex-col gap-2">
                      {/* Строка 1: подпись. Строка 2: сами бейджи (переносятся между собой). */}
                      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                        Требования{!reqsMet && <span className="text-tactical-amber"> · выполните требования</span>}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                      {selUnlock.stations.map((s) => {
                        const met = built(s.nn) >= s.level;
                        const badgeClass = `inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-blender-medium text-type-micro uppercase tracking-wide ${
                          met ? 'bg-nvg-green/10 text-nvg-green' : 'bg-tactical-amber/10 text-tactical-amber'
                        }`;
                        const inner = (
                          <>
                            <span aria-hidden className={`h-7 w-7 shrink-0 icon-mask ${stationIconClass(s.nn)} ${met ? 'bg-nvg-green' : 'bg-tactical-amber'}`} />
                            {s.name} · Ур. {s.level}
                            {met && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />}
                          </>
                        );
                        // Не добрано (амбер) → бейдж кликабелен: выбрать этот модуль (перейти к его постройке).
                        return met ? (
                          <span
                            key={`st-${s.nn}`}
                            title={`${s.name} — нужен уровень ${s.level}, у вас ${built(s.nn)}`}
                            className={badgeClass}
                          >
                            {inner}
                          </span>
                        ) : (
                          <button
                            key={`st-${s.nn}`}
                            type="button"
                            onClick={() => setSelected(s.nn)}
                            title={`${s.name} — нужен уровень ${s.level}, у вас ${built(s.nn)} · перейти к модулю`}
                            className={`${badgeClass} cursor-pointer transition-colors hover:bg-tactical-amber/20`}
                          >
                            {inner}
                          </button>
                        );
                      })}
                      {selUnlock.traders.map((t) => {
                        const have = traderLevelOf(t.nn);
                        const met = have >= t.level;
                        return (
                          <span
                            key={`tr-${t.nn}`}
                            title={`${t.name} — нужна лояльность ${t.level}, у вас ${have}`}
                            className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-blender-medium text-type-micro uppercase tracking-wide ${
                              met ? 'bg-nvg-green/10 text-nvg-green' : 'bg-tactical-amber/10 text-tactical-amber'
                            }`}
                          >
                            <img src={traderImg(t.nn)} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded-xs object-cover" />
                            {t.name} · Ур. {t.level}
                            {met && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />}
                          </span>
                        );
                      })}
                      {selUnlock.skills.map((sk) => {
                        const icon = SKILL_ICONS[sk.id]?.src;
                        const have = skillLevelOf(sk.id);
                        // Три состояния: данных нет (нейтр.) · добрано (зелёный+✓) · не добрано (амбер).
                        const met = hasSkillData && have >= sk.level;
                        const unmet = hasSkillData && have < sk.level;
                        const tone = met
                          ? 'bg-nvg-green/10 text-nvg-green'
                          : unmet
                            ? 'bg-tactical-amber/10 text-tactical-amber'
                            : 'bg-card-menu/40 text-text-secondary';
                        return (
                          <span
                            key={`sk-${sk.id}`}
                            title={
                              hasSkillData
                                ? `${SKILL_RU[sk.id] ?? sk.id} — нужен уровень ${sk.level}, у вас ${have}`
                                : `${SKILL_RU[sk.id] ?? sk.id} — нужен уровень ${sk.level} (загрузите профиль для сверки)`
                            }
                            className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-blender-medium text-type-micro uppercase tracking-wide ${tone}`}
                          >
                            {icon && <img src={icon} alt="" loading="lazy" className="h-7 w-7 shrink-0 object-contain" />}
                            {SKILL_RU[sk.id] ?? sk.id} · Ур. {sk.level}
                            {met && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />}
                          </span>
                        );
                      })}
                      </div>
                    </div>
                  )}

                  {selItems.length > 0 ? (
                    <div className={moduleTiles ? 'flex flex-wrap gap-3' : 'grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4'}>
                      {selItems.map((it) => {
                        // «Собрано» и запись — в СХРОН по it.itemId (клампим отображение до it.count).
                        const got = Math.min(found(it.itemId), it.count);
                        const pct = it.count > 0 ? Math.round((got / it.count) * 100) : 0;
                        const done = got >= it.count;

                        // /modules: канон-ячейка TrackCell (как /needed) + имя-ссылка + FIR в слот.
                        if (moduleTiles) {
                          return (
                            <div key={it.itemId} className="flex w-28 flex-col items-center gap-1.5">
                              <TrackCell
                                iconSrc={itemIconUrl(it.itemId)}
                                alt={it.name}
                                have={got}
                                need={it.count}
                                sizeClass="h-28 w-28"
                                bgColor={getTarkovBackgroundColor(it.backgroundColor)}
                                onInc={(d) => bumpCount(it.itemId, d, it.count)}
                                onSetTotal={(n) => setCount(it.itemId, n)}
                                bottomLeft={
                                  it.fir ? (
                                    <span title="Найдено в рейде" className="flex h-5 w-5 items-center justify-center">
                                      <span aria-hidden className="h-3 w-3 icon-mask icon-eft-quests-side bg-(--color-rarity-legendary)" />
                                    </span>
                                  ) : undefined
                                }
                                topRight={
                                  it.slug ? (
                                    <Link
                                      href={`/eft/items/item/${it.slug}`}
                                      onClick={(e) => e.stopPropagation()}
                                      title="Информация о предмете"
                                      aria-label="Информация о предмете"
                                      className="group/info flex h-5 w-5 items-center justify-center"
                                    >
                                      <span
                                        aria-hidden
                                        className="h-3 w-3 icon-info-label mask-contain mask-center mask-no-repeat bg-text-secondary transition-colors group-hover/info:bg-(--primary)"
                                      />
                                    </Link>
                                  ) : undefined
                                }
                              />
                              {it.slug ? (
                                <Link
                                  href={`/eft/items/item/${it.slug}`}
                                  className="line-clamp-2 text-center text-type-micro uppercase leading-tight tracking-wider text-text-secondary transition-colors hover:text-(--primary)"
                                >
                                  {it.name}
                                </Link>
                              ) : (
                                <span className="line-clamp-2 text-center text-type-micro uppercase leading-tight tracking-wider text-text-secondary">
                                  {it.name}
                                </span>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={it.itemId}
                            className={`group relative select-none rounded-lg border p-2.5 transition-all duration-150 ${
                              done
                                ? 'border-success/50 bg-success/5'
                                : 'border-lines-hover bg-card-menu/40'
                            }`}
                          >
                            {/* Медиа-бак: клик = +1 материал (точный ввод — кнопками ниже) */}
                            <FillMedia
                              imageSrc={itemIconUrl(it.itemId)}
                              alt={it.name}
                              pct={pct}
                              done={done}
                              className="mx-auto"
                              imgClassName="transition-transform duration-150 group-hover:scale-105"
                              imgLoading="lazy"
                              onTap={done ? undefined : () => bumpCount(it.itemId, 1, it.count)}
                              tapTitle={done ? `${it.name} — собрано` : `${it.name} — клик: +1 материал`}
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
                                    bumpCount(it.itemId, -1, it.count);
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
                                <FoundInRaidBadge />
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
            <p className={`text-center text-sm text-text-muted ${moduleTiles ? 'p-8' : 'rounded-lg border border-lines-hover bg-(--color-base) p-8'}`}>
              Выберите модуль слева.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
