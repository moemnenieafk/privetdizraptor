'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bookmark, ChevronRight, X } from 'lucide-react';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { QuestDetail } from '@/components/features/quests/QuestDetail';
import { markerIconUrl, markerColor, type MarkerIconInput } from '@/data/map-marker-icons';
import { LOOT_15 } from '@/data/map-markers/loot-15';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { useMapUiStore } from '@/store/useMapUiStore';
import { useMapViewStore } from '@/store/useMapViewStore';
import { useQuestStore } from '@/store/useQuestStore';
import type { MapViewMarker } from './map-types';
import type { MapViewerApi, MapQuestLite } from './map-frame-types';
import type { TaskRaw } from '@/types/quest';

/**
 * Левый drawer «ПОИСК НА ЛОКАЦИИ» (десктоп, GRILL-3). Зеркалит правый «ЛЕГЕНДА КАРТЫ»:
 * слева, w-87, оверлей + blur, карту не двигает. БЕЗ табов — Предметы и Задания стопкой,
 * gap 28px (`gap-7`), общий скролл (1:1 Figma nodes 2242:2662 + 2245:1657).
 *   Предметы: инпут «ПОИСК ПРЕДМЕТА ИЛИ КОНТЕЙНЕРА» + гриды 36×36 toggle-кнопок (мультивыбор).
 *   Задания: инпут «ВВЕДИТЕ НАЗВАНИЕ ЗАДАНИЯ» + чипы (ВСЕ/СЮЖЕТ/Смотритель%/Каппа%) + лента
 *     торговцев + строки с трейдер-тинтом (уровень, бейджи Каппы/Смотрителя).
 * NB (следующий срез): тогглы Предметов и чипы/трейдеры Заданий — визуальный выбор; привязка к
 * фильтру слоёв карты (vis↔activeFilters), master-detail квеста из QuestMap, 15-кат разметка
 * loose-лута и флаг «сюжет» — отложены.
 */

const SECTION = 'font-blender-medium text-type-caption uppercase tracking-widest text-text-muted';
const CONTAINER_WEBP = '/images/maps/eft/markers/loot-containers/loot-container-';

// Порядок и состав 1:1 с Figma (node 2242:2662).
const CONTAINER_TILES: { file: string; label: string }[] = [
  { file: 'sportsbag', label: 'Спортивная сумка' },
  { file: 'medbag-smu06', label: 'Медсумка' },
  { file: 'medcase', label: 'Медукладка' },
  { file: 'toolbox', label: 'Ящик с инструментами' },
  { file: 'weaponbox-4x4', label: 'Оружейный ящик 4×4' },
  { file: 'wooden-crate', label: 'Деревянный ящик' },
  { file: 'wooden-technical-supply-crate', label: 'Ящик техснабжения' },
  { file: 'wooden-ammo-box', label: 'Патронный ящик' },
  { file: 'ground-cache', label: 'Схрон в земле' },
  { file: 'burried-barrel-cache', label: 'Закопанная бочка' },
  { file: 'wooden-ration-supply-crate', label: 'Ящик с провизией' },
  { file: 'dead-scav', label: 'Труп ЧВК' },
  { file: 'wooden-grenade-box', label: 'Гранатный ящик' },
  { file: 'jacket', label: 'Куртка' },
  { file: 'pc-block', label: 'Системный блок' },
  { file: 'drawer', label: 'Выдвижной ящик' },
  { file: 'dead-pmc', label: 'Труп Дикого' },
  { file: 'bank-safe', label: 'Сейф' },
];

type QuestFilter = 'all' | 'story' | 'lightkeeper' | 'kappa';

/** Глиф строки поиска: резолвер (цветной img) → точка по типу. */
function Glyph({ sample, size }: { sample: MarkerIconInput; size: number }) {
  const icon = markerIconUrl(sample);
  if (icon?.mode === 'img')
    return <img src={icon.url} alt="" className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  return (
    <span className="shrink-0 rounded-full" style={{ backgroundColor: markerColor(sample.type), width: size * 0.6, height: size * 0.6 }} />
  );
}

interface LabelGroup {
  label: string;
  type: string;
  count: number;
  positions: { x: number; z: number }[];
  itemSlug: string | null;
}

interface Props {
  markers: MapViewMarker[];
  quests: MapQuestLite[];
  questTasks: TaskRaw[];
  apiRef: React.RefObject<MapViewerApi | null>;
}

export function MapSearchDrawer({ markers, quests, questTasks, apiRef }: Props) {
  const open = useMapUiStore((s) => s.searchOpen);
  const setOpen = useMapUiStore((s) => s.setSearchOpen);
  // Видимость слоёв — общий стор: тогглы фильтруют карту и синхронны с правой легендой (GRILL-2 §3).
  const activeFilters = useMapViewStore((s) => s.activeFilters);
  const [qItems, setQItems] = useState('');
  const [qQuests, setQQuests] = useState('');
  const [qf, setQf] = useState<QuestFilter>('all');
  const [traderFilter, setTraderFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Полный таск выбранного квеста для master-detail панели (QuestDetail).
  // Панель гейтится на `open && selectedTask`; selectedTask сам null-ится, если квеста нет
  // в текущей карте (смена карты) — отдельный сброс не нужен.
  const taskById = useMemo(() => new Map(questTasks.map((t) => [t.id, t])), [questTasks]);
  const selectedTask = selectedId ? (taskById.get(selectedId) ?? null) : null;

  // Группировка маркеров по label (поиск по предмету): дедуп + позиции для подлёта.
  const groups = useMemo(() => {
    const byLabel = new Map<string, LabelGroup>();
    for (const m of markers) {
      if (!m.position) continue;
      const label = m.label?.trim();
      if (!label) continue;
      const p = { x: m.position.x, z: m.position.z };
      const g = byLabel.get(label);
      if (g) {
        g.count++;
        g.positions.push(p);
        if (!g.itemSlug && m.itemSlug) g.itemSlug = m.itemSlug;
      } else {
        byLabel.set(label, { label, type: m.type, count: 1, positions: [p], itemSlug: m.itemSlug ?? null });
      }
    }
    return [...byLabel.values()].sort((a, b) => b.count - a.count);
  }, [markers]);

  const iq = qItems.trim().toLowerCase();
  const itemHits = iq.length >= 2 ? groups.filter((g) => g.label.toLowerCase().includes(iq)).slice(0, 40) : [];

  const focus = (positions: { x: number; z: number }[]) => {
    if (positions.length) apiRef.current?.focusPoints(positions);
  };

  // Задания: лента торговцев (уникальные), отфильтрованный список.
  const traders = useMemo(() => [...new Set(quests.map((q) => q.trader))], [quests]);
  // Проценты чипов = РЕАЛЬНЫЙ прогресс: сколько квестов Каппы/Смотрителя ЭТОЙ карты закрыто
  // (из useQuestStore, как в PlayerTelemetry). Нет таких квестов на карте → 0%.
  const completed = useQuestStore((s) => s.completedQuests);
  const doneSet = new Set(completed);
  const pctDone = (pred: (q: MapQuestLite) => boolean): number => {
    const list = quests.filter(pred);
    return list.length ? Math.round((list.filter((q) => doneSet.has(q.id)).length / list.length) * 100) : 0;
  };
  const lkPct = pctDone((q) => q.lightkeeperRequired);
  const kappaPct = pctDone((q) => q.kappaRequired);

  const shownQuests = useMemo(() => {
    const tq = qQuests.trim().toLowerCase();
    return quests.filter((q) => {
      if (qf === 'lightkeeper' && !q.lightkeeperRequired) return false;
      if (qf === 'kappa' && !q.kappaRequired) return false;
      if (traderFilter && q.trader !== traderFilter) return false;
      if (tq && !q.name.toLowerCase().includes(tq)) return false;
      return true;
    });
  }, [quests, qf, traderFilter, qQuests]);

  const pickFilter = (key: QuestFilter) => setQf((cur) => (cur === key ? 'all' : key));

  return (
    <>
    {/* Адаптив (по образу десктопа): десктоп — левый drawer, мобилка — bottom-sheet (тот же контент). */}
    <div
      className={`absolute inset-x-0 bottom-0 z-[540] flex max-h-[85svh] flex-col rounded-t-xl border-t border-lines-hover bg-(--color-base)/95 backdrop-blur-md transition-transform duration-200 lg:inset-x-auto lg:top-0 lg:left-0 lg:bottom-auto lg:h-full lg:max-h-none lg:w-87 lg:rounded-t-none lg:border-t-0 lg:border-r ${
        open ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-y-0 lg:-translate-x-full'
      }`}
    >
      {/* Мобильный хват боттом-шита */}
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-lines-hover lg:hidden" />
      {/* Шапка: кнопка-закрыть = амбер-лупа (та же, что открывает в баре) слева + заголовок. */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-3.5">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Закрыть поиск"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-(--primary) bg-(--primary) text-(--color-base)"
        >
          <span className="icon-mask icon-eft-search-icon h-5.5 w-5.5" />
        </button>
        <span className="font-blender-medium text-base uppercase tracking-widest text-text-primary">Поиск на локации</span>
      </div>

      <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto p-3">
        {/* ─────────────── ПРЕДМЕТЫ ─────────────── */}
        <section className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <div className="flex h-9 items-center gap-3.5 rounded-xs border border-lines-hover bg-(--color-base) px-3.5">
              <span className="icon-mask icon-eft-items-loot-tier h-4 w-4 shrink-0 text-text-muted" />
              <input
                value={qItems}
                onChange={(e) => setQItems(e.target.value)}
                placeholder="ПОИСК ПРЕДМЕТА ИЛИ КОНТЕЙНЕРА"
                className="w-full bg-transparent font-blender-medium text-type-caption uppercase tracking-wide text-text-primary outline-none placeholder:text-text-muted"
              />
              {qItems && (
                <button type="button" onClick={() => setQItems('')} aria-label="Очистить" className="shrink-0 text-text-muted transition-colors hover:text-(--primary)">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="font-blender-medium text-[10px] text-text-secondary">
              Поддерживается мульти поиск, например: LEDX, Bitcoin, Ключ-карта
            </p>
          </div>

          {iq.length >= 2 ? (
            itemHits.length === 0 ? (
              <p className="px-1 py-4 text-center font-blender-book text-xs text-text-muted">Ничего не найдено</p>
            ) : (
              <div className="flex flex-col">
                {itemHits.map((g) => (
                  <div key={g.label} className="flex items-center gap-2 border-b border-lines-hover">
                    <button type="button" onClick={() => focus(g.positions)} className="flex h-9 min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:bg-card-menu">
                      <Glyph sample={{ type: g.type, label: g.label }} size={18} />
                      <span className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-primary">
                        <HighlightedText text={g.label} query={qItems} />
                      </span>
                      <span className="shrink-0 font-blender-medium text-type-micro text-text-muted tabular-nums">{g.count}</span>
                    </button>
                    {g.itemSlug && (
                      <Link href={`/eft/items/item/${g.itemSlug}`} title="Открыть страницу предмета" className="flex h-9 w-7 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-(--primary)">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p className={SECTION}>Контейнеры</p>
                <div className="flex flex-wrap gap-[9px]">
                  {CONTAINER_TILES.map((c) => {
                    const on = !!activeFilters[`container-${c.file}`];
                    return (
                      <button
                        key={c.file}
                        type="button"
                        onClick={() => useMapViewStore.getState().toggleFilter(`container-${c.file}`)}
                        title={c.label}
                        aria-pressed={on}
                        className={`flex size-9 items-center justify-center rounded border transition-colors ${
                          on ? 'border-(--primary)' : 'border-lines-hover hover:border-(--primary)/40'
                        }`}
                      >
                        <img src={`${CONTAINER_WEBP}${c.file}.webp`} alt="" className="size-8 object-contain" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className={SECTION}>Случайная добыча</p>
                <div className="flex flex-wrap gap-2">
                  {LOOT_15.map((l) => {
                    const on = !!activeFilters[`loose-${l.key}`];
                    return (
                      <button
                        key={l.key}
                        type="button"
                        onClick={() => useMapViewStore.getState().toggleFilter(`loose-${l.key}`)}
                        title={l.label}
                        aria-pressed={on}
                        className={`flex size-9 items-center justify-center rounded border bg-card-menu transition-colors ${
                          on ? 'border-(--primary)' : 'border-lines-hover hover:border-(--primary)/40'
                        }`}
                      >
                        <span className={`icon-mask ${l.icon} h-4 w-4 ${on ? 'text-(--primary)' : 'text-text-secondary'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>

        {/* ─────────────── ЗАДАНИЯ ─────────────── */}
        <section className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2">
            <div className="flex h-9 items-center gap-3.5 rounded-xs border border-lines-hover bg-(--color-base) px-3.5">
              <span className="icon-mask icon-eft-quests h-4 w-4 shrink-0 text-text-muted" />
              <input
                value={qQuests}
                onChange={(e) => setQQuests(e.target.value)}
                placeholder="ВВЕДИТЕ НАЗВАНИЕ ЗАДАНИЯ"
                className="w-full bg-transparent font-blender-medium text-type-caption uppercase tracking-wide text-text-primary outline-none placeholder:text-text-muted"
              />
              {qQuests && (
                <button type="button" onClick={() => setQQuests('')} aria-label="Очистить" className="shrink-0 text-text-muted transition-colors hover:text-(--primary)">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="font-blender-medium text-[10px] text-text-secondary">
              Поддерживается мульти поиск, например: LEDX, Bitcoin, Ключ-карта
            </p>
          </div>

          {/* Чипы фильтров: ВСЕ / СЮЖЕТ / Смотритель% / Каппа% */}
          <div className="flex gap-2">
            <FilterChip active={qf === 'all'} color="var(--color-text-secondary)" onClick={() => setQf('all')} maskIcon="icon-eft-quests" label="Все" />
            <FilterChip active={qf === 'story'} color="#6096a6" onClick={() => pickFilter('story')} icon={<Bookmark className="h-3 w-3" />} label="Сюжет" />
            <FilterChip active={qf === 'lightkeeper'} color="var(--color-lightkeeper)" onClick={() => pickFilter('lightkeeper')} maskIcon="icon-eft-profile-lightkeeper" label={`${lkPct}%`} />
            <FilterChip active={qf === 'kappa'} color="var(--color-kappa)" onClick={() => pickFilter('kappa')} maskIcon="icon-eft-profile-kappa" label={`${kappaPct}%`} />
          </div>

          {/* Лента торговцев */}
          {traders.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {traders.map((t) => {
                const on = traderFilter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTraderFilter((cur) => (cur === t ? null : t))}
                    title={t}
                    className={`size-6 shrink-0 overflow-hidden rounded-xs border transition-colors ${on ? 'border-(--primary)' : 'border-transparent hover:border-lines-hover'}`}
                  >
                    <img src={traderImg(t)} alt="" className="size-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Список квестов */}
          <div className="flex flex-col gap-1">
            {shownQuests.length === 0 ? (
              <p className="px-1 py-4 text-center font-blender-book text-xs text-text-muted">Заданий не найдено</p>
            ) : (
              shownQuests.map((q) => (
                <QuestRow key={q.id} q={q} query={qQuests} active={selectedId === q.id} onSelect={setSelectedId} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>

      {/* «Подробности задания» — master-detail: десктоп рядом (left+348), мобилка боттом-шитом поверх. */}
      {open && selectedTask && (
        <div
          className="absolute inset-x-0 bottom-0 z-[545] flex max-h-[92svh] flex-col rounded-t-xl border-t border-lines-hover backdrop-blur-md lg:inset-x-auto lg:top-0 lg:left-87 lg:bottom-auto lg:h-full lg:max-h-none lg:w-87 lg:rounded-t-none lg:border-t-0 lg:border-l"
          style={{
            background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, var(${traderCssVar(selectedTask.trader.normalizedName)}, transparent) 15%, transparent), rgba(0,0,0,0.92))`,
          }}
        >
          <QuestDetail task={selectedTask} variant="drawer" onClose={() => setSelectedId(null)} />
        </div>
      )}
    </>
  );
}

function FilterChip({
  active,
  color,
  label,
  icon,
  maskIcon,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  icon?: React.ReactNode;
  maskIcon?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? { backgroundColor: color, color: 'var(--color-base)' } : { borderColor: color, color }}
      className={`flex h-6 flex-1 items-center justify-center gap-1.5 rounded border-[0.5px] font-blender-medium text-[10px] uppercase transition-colors ${
        active ? 'border-transparent' : ''
      }`}
    >
      {maskIcon ? (
        <span className={`icon-mask ${maskIcon} h-4 w-4`} style={{ backgroundColor: active ? 'var(--color-base)' : color }} />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}

function QuestRow({ q, query, active, onSelect }: { q: MapQuestLite; query: string; active: boolean; onSelect: (id: string) => void }) {
  const tint = `var(${traderCssVar(q.trader)}, var(--color-lines-hover))`;
  return (
    <button
      type="button"
      onClick={() => onSelect(q.id)}
      title={q.name}
      className={`flex h-9 w-full items-center justify-between rounded border-[0.5px] px-3.5 text-left transition-shadow ${active ? 'ring-1 ring-(--primary)' : ''}`}
      style={{
        borderColor: tint,
        background: `radial-gradient(140% 160% at 0% 50%, color-mix(in srgb, ${tint} 38%, transparent), transparent 55%)`,
      }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <img src={traderImg(q.trader)} alt="" className="size-4 shrink-0 rounded-xs border border-black/50 object-cover" />
        <span className="min-w-0 truncate font-blender-medium text-xs text-text-primary">
          {query ? <HighlightedText text={q.name} query={query} /> : q.name}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-blender-medium text-[10px] uppercase text-text-secondary">ур. {q.minPlayerLevel}+</span>
        {q.lightkeeperRequired && (
          <span className="flex size-4 items-center justify-center rounded-xs" style={{ backgroundColor: 'color-mix(in srgb, var(--color-lightkeeper) 12%, transparent)' }}>
            <span className="icon-mask icon-eft-profile-lightkeeper h-3 w-3" />
          </span>
        )}
        {q.kappaRequired && <span className="icon-mask icon-eft-profile-kappa h-4 w-4" />}
      </span>
    </button>
  );
}
