'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckSquare, ChevronRight, MapPin, Square, Target, X } from 'lucide-react';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { useMyKeysStore } from '@/store/useMyKeysStore';
import { useLootFilterStore } from '@/store/useLootFilterStore';
import { useStoryFilterStore } from '@/store/useStoryFilterStore';
import { QuestDetail } from '@/components/features/quests/QuestDetail';
import { markerIconUrl, markerColor, LINK_KIND_COLOR, containerFile, type MarkerIconInput } from '@/data/map-marker-icons';
import { LOOT_15 } from '@/data/map-markers/loot-15';
import { storiesForMap, type StoryOnMap } from '@/lib/story-map-link';
import type { EditorialMarkerData } from './EditorialMarkerCard';
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
 * Тогглы/чипы/трейдеры фильтруют карту (vis↔activeFilters), master-detail квеста и loot-15 —
 * сделаны. Чип СЮЖЕТ — ЧЕРНОВИК фазы A (storiesForMap по mapIcon → строки историй, линк на
 * walkthrough; точные пины чекпоинтов = фаза B). Визуал строки истории — под Figma-итерацию.
 */

const SECTION = 'font-blender-medium text-type-caption uppercase tracking-widest text-text-muted';
const CONTAINER_WEBP = '/images/maps/eft/markers/loot-containers/loot-container-';
// Цвет сюжетной истории — единый источник LINK_KIND_COLOR.story (сталь), как чип СЮЖЕТ.
const STORY_TINT = LINK_KIND_COLOR.story;

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
  slug: string;
  markers: MapViewMarker[];
  quests: MapQuestLite[];
  questTasks: TaskRaw[];
  editorialMarkers?: EditorialMarkerData[];
  apiRef: React.RefObject<MapViewerApi | null>;
}

export function MapSearchDrawer({ slug, markers, quests, questTasks, editorialMarkers, apiRef }: Props) {
  const open = useMapUiStore((s) => s.searchOpen);
  const setOpen = useMapUiStore((s) => s.setSearchOpen);
  // Видимость слоёв — общий стор: тогглы фильтруют карту и синхронны с правой легендой (GRILL-2 §3).
  const activeFilters = useMapViewStore((s) => s.activeFilters);
  // Контейнеры ЭТОЙ карты — из РЕАЛЬНЫХ маркеров (не статик-список): группа по containerFile;
  // оруж.ящики всех размеров → одна группа «Оружейный ящик». Иконка = самый частый размер;
  // fileKeys — ключи слоёв карты (container-<file>): и для фильтра (ЛКМ), и для ПКМ-цикла (cycleToLayer).
  const containerGroups = useMemo(() => {
    const g = new Map<
      string,
      { key: string; label: string; fileCount: Map<string, number>; fileKeys: Set<string>; count: number }
    >();
    for (const m of markers) {
      if ((m.type !== 'loot_container' && m.type !== 'container') || !m.position) continue;
      const file = containerFile(m as unknown as MarkerIconInput);
      const weapon = file.startsWith('weaponbox');
      const key = weapon ? 'weaponbox' : file;
      let e = g.get(key);
      if (!e) {
        e = { key, label: weapon ? 'Оружейный ящик' : m.label ?? file, fileCount: new Map(), fileKeys: new Set(), count: 0 };
        g.set(key, e);
      }
      e.fileCount.set(file, (e.fileCount.get(file) ?? 0) + 1);
      e.fileKeys.add(`container-${file}`);
      e.count++;
    }
    return [...g.values()]
      .map((e) => ({
        key: e.key,
        label: e.label,
        iconFile: [...e.fileCount.entries()].sort((a, b) => b[1] - a[1])[0][0],
        fileKeys: [...e.fileKeys],
        count: e.count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [markers]);
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
  // Лут-фильтр: подсвеченные label'ы предметов (постоянный оверлей на карте).
  const lootLabels = useLootFilterStore((s) => s.labels);
  const toggleLoot = useLootFilterStore((s) => s.toggle);
  const clearLoot = useLootFilterStore((s) => s.clear);

  const focus = (positions: { x: number; z: number }[]) => {
    if (positions.length) apiRef.current?.focusPoints(positions);
  };

  // ── Ключи (реверс Ключ→Двери): ключи этой карты из lock-маркеров, сгруппированы по id. ──
  const myKeys = useMyKeysStore((s) => s.keys);
  const toggleMyKey = useMyKeysStore((s) => s.toggle);
  const [qKeys, setQKeys] = useState('');
  const keysOnMap = useMemo(() => {
    const byKey = new Map<string, { keyId: string; name: string; slug: string | null; itemBg: string | undefined; doors: { x: number; z: number }[]; count: number }>();
    for (const m of markers) {
      if (m.type !== 'lock' || !m.linkedItemId || !m.position) continue;
      const p = { x: m.position.x, z: m.position.z };
      const g = byKey.get(m.linkedItemId);
      if (g) {
        g.count += 1;
        g.doors.push(p);
      } else {
        byKey.set(m.linkedItemId, { keyId: m.linkedItemId, name: m.label ?? 'Ключ', slug: m.itemSlug ?? null, itemBg: m.itemBg ?? undefined, doors: [p], count: 1 });
      }
    }
    return [...byKey.values()].sort((a, b) => b.count - a.count);
  }, [markers]);
  const kq = qKeys.trim().toLowerCase();
  const keyHits = kq ? keysOnMap.filter((k) => k.name.toLowerCase().includes(kq)) : keysOnMap;

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

  // ЧЕРНОВИК чипа СЮЖЕТ (фаза A гибрида): истории, у которых чекпоинт на этой карте
  // (storiesForMap по condition.mapIcon). Текстовый фильтр — по названию истории.
  const stories = useMemo(() => {
    const tq = qQuests.trim().toLowerCase();
    return storiesForMap(slug).filter((s) => !tq || s.title.toLowerCase().includes(tq));
  }, [slug, qQuests]);
  // Story/lore-слой: выбранная история → подсветка маршрута на карте.
  const selectedStory = useStoryFilterStore((s) => s.slug);
  const selectStory = useStoryFilterStore((s) => s.select);

  // Фаза B: реальные пины сюжетки — editorial-маркеры с linkKind='story' → координаты по slug истории.
  const storyPins = useMemo(() => {
    const m = new Map<string, { x: number; z: number }[]>();
    for (const e of editorialMarkers ?? []) {
      if (e.linkKind === 'story' && e.linkId) {
        const arr = m.get(e.linkId) ?? [];
        arr.push({ x: e.x, z: e.z });
        m.set(e.linkId, arr);
      }
    }
    return m;
  }, [editorialMarkers]);

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

          {lootLabels.length > 0 && (
            <div className="flex items-center justify-between rounded-xs border-[0.5px] border-accent-frago/40 bg-accent-frago/10 px-2 py-1.5">
              <span className="flex items-center gap-1.5 font-blender-medium text-type-micro uppercase tracking-wide text-accent-frago">
                <Target className="h-3.5 w-3.5" /> Подсвечено спавнов: {lootLabels.length}
              </span>
              <button type="button" onClick={clearLoot} className="font-blender-medium text-type-micro uppercase tracking-wide text-text-muted transition-colors hover:text-danger">
                Сброс
              </button>
            </div>
          )}

          {iq.length >= 2 ? (
            itemHits.length === 0 ? (
              <p className="px-1 py-4 text-center font-blender-book text-xs text-text-muted">Ничего не найдено</p>
            ) : (
              <div className="flex flex-col">
                {itemHits.map((g) => {
                  const lit = lootLabels.includes(g.label);
                  return (
                    <div key={g.label} className="flex items-center gap-1 border-b border-lines-hover">
                      <button
                        type="button"
                        onClick={() => toggleLoot(g.label)}
                        aria-pressed={lit}
                        title={lit ? 'Убрать подсветку спавнов' : 'Подсветить все спавны на карте'}
                        className={`flex h-9 w-7 shrink-0 items-center justify-center transition-colors ${lit ? 'text-accent-frago' : 'text-text-muted hover:text-accent-frago'}`}
                      >
                        <Target className="h-4 w-4" />
                      </button>
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
                  );
                })}
              </div>
            )
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p className={SECTION}>Контейнеры</p>
                <div className="flex flex-wrap gap-[9px]">
                  {containerGroups.map((c) => {
                    const on = c.fileKeys.every((k) => activeFilters[k]);
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => useMapViewStore.getState().setGroupFilters(c.fileKeys, !on)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          apiRef.current?.cycleToLayer(c.fileKeys);
                        }}
                        title={`${c.label} · ${c.count} на карте — ЛКМ: фильтр, ПКМ: перелёт по циклу`}
                        aria-pressed={on}
                        className={`flex size-9 items-center justify-center rounded border transition-colors ${
                          on ? 'border-(--primary)' : 'border-lines-hover hover:border-(--primary)/40'
                        }`}
                      >
                        <img src={`${CONTAINER_WEBP}${c.iconFile}.webp`} alt="" className="size-8 object-contain" />
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

        {/* ─────────────── КЛЮЧИ (реверс Ключ→Двери) ─────────────── */}
        {keysOnMap.length > 0 && (
          <section className="flex flex-col gap-3.5">
            {myKeys.length > 0 && (
              <span className="text-right font-blender-medium text-type-micro tabular-nums text-(--primary)">
                Моих здесь: {keysOnMap.filter((k) => myKeys.includes(k.keyId)).length}
              </span>
            )}
            <div className="flex h-9 items-center gap-3.5 rounded-xs border border-lines-hover bg-(--color-base) px-3.5">
              <span className="icon-mask icon-eft-eq-keys h-4 w-4 shrink-0" style={{ backgroundColor: 'var(--color-text-muted)' }} />
              <input
                value={qKeys}
                onChange={(e) => setQKeys(e.target.value)}
                placeholder="ПОИСК КЛЮЧА"
                className="w-full bg-transparent font-blender-medium text-type-caption uppercase tracking-wide text-text-primary outline-none placeholder:text-text-muted"
              />
              {qKeys && (
                <button type="button" onClick={() => setQKeys('')} aria-label="Очистить" className="shrink-0 text-text-muted transition-colors hover:text-(--primary)">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="font-blender-medium text-[10px] text-text-secondary">
              Отметь «есть» — двери ключа подсветятся на карте. Клик по строке — подлёт к дверям.
            </p>
            {keyHits.length === 0 ? (
              <p className="px-1 py-4 text-center font-blender-book text-xs text-text-muted">Ничего не найдено</p>
            ) : (
              <div className="flex flex-col">
                {keyHits.slice(0, 60).map((k) => {
                  const owned = myKeys.includes(k.keyId);
                  return (
                    <div key={k.keyId} className="flex items-center gap-1 border-b border-lines-hover">
                      <button
                        type="button"
                        onClick={() => toggleMyKey(k.keyId)}
                        aria-pressed={owned}
                        title={owned ? 'Убрать из «Моих ключей»' : 'У меня есть этот ключ'}
                        className={`flex h-9 w-7 shrink-0 items-center justify-center transition-colors ${owned ? 'text-(--primary)' : 'text-text-muted hover:text-(--primary)'}`}
                      >
                        {owned ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      <button type="button" onClick={() => focus(k.doors)} className="flex h-9 min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:bg-card-menu">
                        <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-xs border border-lines-hover">
                          <span className="absolute inset-0 bg-(--color-darkbase)" />
                          <span className="absolute inset-0" style={{ backgroundColor: getTarkovBackgroundColor(k.itemBg) }} />
                          <img src={itemIconUrl(k.keyId)} alt="" className="absolute inset-0 h-full w-full object-contain p-0.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-primary">
                          <HighlightedText text={k.name} query={qKeys} />
                        </span>
                        <span className="shrink-0 font-blender-medium text-type-micro tabular-nums text-text-muted">{k.count} дв.</span>
                      </button>
                      {k.slug && (
                        <Link href={`/eft/items/item/${k.slug}`} title="Открыть страницу ключа" className="flex h-9 w-7 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-(--primary)">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

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
            <FilterChip active={qf === 'story'} color={STORY_TINT} onClick={() => pickFilter('story')} maskIcon="icon-eft-quests-lore" label="Сюжет" />
            <FilterChip active={qf === 'lightkeeper'} color="var(--color-lightkeeper)" onClick={() => pickFilter('lightkeeper')} maskIcon="icon-eft-profile-lightkeeper" label={`${lkPct}%`} />
            <FilterChip active={qf === 'kappa'} color="var(--color-kappa)" onClick={() => pickFilter('kappa')} maskIcon="icon-eft-profile-kappa" label={`${kappaPct}%`} />
          </div>

          {/* Лента торговцев (сюжетные истории — без торговцев, лента скрыта) */}
          {qf !== 'story' && traders.length > 0 && (
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

          {/* Список: сюжетные истории (чип СЮЖЕТ) ИЛИ квесты */}
          <div className="flex flex-col gap-1">
            {qf === 'story' ? (
              stories.length === 0 ? (
                <p className="px-1 py-4 text-center font-blender-book text-xs text-text-muted">Сюжетных историй на этой карте нет</p>
              ) : (
                stories.map((s) => {
                  const pins = storyPins.get(s.slug);
                  return (
                    <StoryRow
                      key={s.slug}
                      s={s}
                      query={qQuests}
                      pins={pins}
                      active={selectedStory === s.slug}
                      onFocus={() => {
                        // Toggle: подлетаем к пинам только при ВЫБОРЕ, не при снятии.
                        const willSelect = selectedStory !== s.slug;
                        selectStory(s.slug);
                        if (willSelect && pins?.length) focus(pins);
                      }}
                    />
                  );
                })
              )
            ) : shownQuests.length === 0 ? (
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

// ЧЕРНОВИК строки сюжетной истории (по образцу QuestRow — для итерации в Figma).
// Тинт = стальной STORY_TINT; слева иконка-маска истории, справа сложность (черепа) +
// число этапов НА ЭТОЙ карте; клик → walkthrough /eft/quests/<slug>. Пинов пока нет (фаза B).
function StoryRow({ s, query, pins, active, onFocus }: { s: StoryOnMap; query: string; pins?: { x: number; z: number }[]; active?: boolean; onFocus?: () => void }) {
  const skullColor = s.difficulty.skulls >= 5 ? 'var(--color-danger)' : s.difficulty.skulls >= 3 ? 'var(--primary)' : 'var(--color-nvg-green)';
  const hasPins = !!pins && pins.length > 0;
  const cls = `flex h-9 w-full items-center justify-between rounded border-[0.5px] px-3.5 transition-shadow hover:ring-1 hover:ring-(--primary) ${
    active ? 'ring-1 ring-(--primary)' : ''
  }`;
  const style = {
    borderColor: `color-mix(in srgb, ${STORY_TINT} 55%, transparent)`,
    background: `radial-gradient(140% 160% at 0% 50%, color-mix(in srgb, ${STORY_TINT} 30%, transparent), transparent 55%)`,
  };
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span className={`icon-mask ${s.iconClass} h-4 w-4 shrink-0`} style={{ backgroundColor: STORY_TINT }} />
        <span className="min-w-0 truncate font-blender-medium text-xs text-text-primary">
          {query ? <HighlightedText text={s.title} query={query} /> : s.title}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {hasPins && (
          <span className="flex items-center gap-0.5 font-blender-medium text-[10px] tabular-nums text-(--primary)">
            <MapPin className="h-3 w-3" />
            {pins.length}
          </span>
        )}
        <span className="flex items-center gap-0.5 font-blender-medium text-[10px] tabular-nums" style={{ color: skullColor }}>
          <span className="icon-mask icon-eft-difficulty-skull h-3 w-3" style={{ backgroundColor: skullColor }} />
          {s.difficulty.skulls}
        </span>
        <span className="font-blender-medium text-[10px] uppercase text-text-secondary">{s.stepHits} эт.</span>
        <ChevronRight className="h-4 w-4 text-text-muted" />
      </span>
    </>
  );
  // Есть пины на карте → клик подсвечивает маршрут (toggle); иначе → walkthrough истории.
  return hasPins ? (
    <button type="button" onClick={onFocus} aria-pressed={active} title={active ? `${s.title} — скрыть маршрут` : `${s.title} — показать маршрут на карте (${pins.length})`} className={cls} style={style}>
      {inner}
    </button>
  ) : (
    <Link href={`/eft/quests/${s.slug}`} title={`${s.title} — чекпоинты на карте не размечены, открыть гайд`} className={cls} style={style}>
      {inner}
    </Link>
  );
}
