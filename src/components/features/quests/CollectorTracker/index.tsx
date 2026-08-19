'use client';

// Трекер предметов квеста «Коллекционер» (разблокировка контейнера Kappa).
// Модель (грилл V4DYA): клик красит предмет «найдено» НА МЕСТЕ (список не прыгает); через ~1с простоя
// свежеотмеченные ФЕЙД-КОЛЛАПСОМ уезжают вниз в секцию «Собрано» (разделитель-заголовок). Ненайденные
// сверху по имени, собранные снизу по имени. Прогресс единый с квест-трекером: пишем в
// useQuestStore.itemProgress[questId][objId] (count 1) → отметка видна в /eft/progress/tracker и в квесте.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw, Search, X } from 'lucide-react';
import { useQuestStore } from '@/store/useQuestStore';
import { getTarkovCellColor } from '@/lib/tarkov-colors';
// Аутентичная ячейка предмета EFT — тот же атом, что в трекере баттлпасса (design-to-code V4DYA):
// рарити-фон + линейный блик + внутренняя тень + тёмная обводка #0D0D0E. Переиспользуем 1:1.
import { EFT_CELL_SHADOW, EFT_CELL_BORDER } from '@/components/features/seasons/battlepassVisual';

export interface CollectorItem {
  objectiveId: string;
  item: { id: string; name: string; shortName: string; image512pxLink: string };
  /** Цвет редкости предмета (имя из зеркала цен) для фона ячейки. */
  backgroundColor?: string;
}

interface Props {
  questId: string;
  items: CollectorItem[];
}

const SINK_DELAY = 900; // мс простоя после последней отметки до уезда вниз
const ENTER_MS = 400; // длительность fade-in перегруппированных ячеек

export function CollectorTracker({ questId, items }: Props) {
  const itemProgress = useQuestStore((s) => s.itemProgress);
  const setItemCount = useQuestStore((s) => s.setItemCount);
  const resetItemProgress = useQuestStore((s) => s.resetItemProgress);
  const setKappaObjectiveIds = useQuestStore((s) => s.setKappaObjectiveIds);
  const [query, setQuery] = useState('');

  // Засеиваем набор id'ов Каппы в персист-стор (сеттер с гардом) → Досье и инференс роли считают
  // Каппу даже без визита карты заданий и переживают refresh (сверка, факт B).
  useEffect(() => {
    setKappaObjectiveIds(items.map((it) => it.objectiveId));
  }, [items, setKappaObjectiveIds]);
  const [confirmReset, setConfirmReset] = useState(false);

  const progressForQuest = itemProgress[questId];
  const liveFound = (objId: string): boolean => (progressForQuest?.[objId] ?? 0) >= 1;
  const foundCount = items.reduce((n, it) => n + (liveFound(it.objectiveId) ? 1 : 0), 0);
  const total = items.length;

  // committedFound — СНИМОК группировки (что реально лежит в секции «Собрано»). Обновляется не на
  // клик, а на паузе — поэтому список не прыгает под пальцем. leaving — id в процессе фейд-коллапса.
  const [committedFound, setCommittedFound] = useState<Set<string>>(
    () => new Set(items.filter((it) => (itemProgress[questId]?.[it.objectiveId] ?? 0) >= 1).map((it) => it.objectiveId)),
  );
  const [entering, setEntering] = useState<Set<string>>(() => new Set());

  const committedRef = useRef(committedFound);
  useEffect(() => {
    committedRef.current = committedFound;
  });

  const sinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (sinkTimer.current) clearTimeout(sinkTimer.current);
      if (animTimer.current) clearTimeout(animTimer.current);
    },
    [],
  );

  // Реордер по паузе: сравниваем живой прогресс со снимком; если группа менялась — коммитим новый
  // снимок (грид перегруппируется: найденные вниз под разделитель) и помечаем сменившие группу как
  // entering → они мягко проявляются (fade-in) на новом месте. Коллапс высоты в гриде не годится.
  const runReflow = () => {
    const p = useQuestStore.getState().itemProgress[questId];
    const live = new Set(items.filter((it) => (p?.[it.objectiveId] ?? 0) >= 1).map((it) => it.objectiveId));
    const changed = items
      .filter((it) => committedRef.current.has(it.objectiveId) !== live.has(it.objectiveId))
      .map((it) => it.objectiveId);
    if (changed.length === 0) return;
    setCommittedFound(live);
    setEntering(new Set(changed));
    animTimer.current = setTimeout(() => setEntering(new Set()), ENTER_MS);
  };

  const toggle = (objId: string): void => {
    setItemCount(questId, objId, liveFound(objId) ? 0 : 1);
    if (sinkTimer.current) clearTimeout(sinkTimer.current);
    sinkTimer.current = setTimeout(runReflow, SINK_DELAY);
  };

  const doReset = (): void => {
    resetItemProgress(questId);
    if (sinkTimer.current) clearTimeout(sinkTimer.current);
    if (animTimer.current) clearTimeout(animTimer.current);
    setEntering(new Set());
    setCommittedFound(new Set());
    setConfirmReset(false);
  };

  // Порядок: фильтр поиска + группировка по СНИМКУ (ненайденные по имени, затем собранные по имени).
  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter((it) => it.item.name.toLowerCase().includes(q) || it.item.shortName.toLowerCase().includes(q))
      : items;
    return [...list].sort((a, b) => {
      const af = committedFound.has(a.objectiveId) ? 1 : 0;
      const bf = committedFound.has(b.objectiveId) ? 1 : 0;
      if (af !== bf) return af - bf;
      return a.item.name.localeCompare(b.item.name, 'ru');
    });
  }, [items, query, committedFound]);

  const firstFoundIdx = ordered.findIndex((it) => committedFound.has(it.objectiveId));
  const committedFoundVisible = ordered.reduce((n, it) => n + (committedFound.has(it.objectiveId) ? 1 : 0), 0);
  const pct = total ? Math.round((foundCount / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Сводка + поиск + сброс — один ряд; бар прогресса волосяной линией под ним. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-4 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
            <span>
              Собрано: <span className="text-success">{foundCount}</span>
            </span>
            <span className="text-lines-hover">|</span>
            <span>
              Осталось: <span className="text-(--primary)">{total - foundCount}</span>
            </span>
            <span className="text-lines-hover">|</span>
            <span>
              Всего: <span className="text-text-primary">{total}</span>
            </span>
          </div>

          {/* Поиск справа */}
          <div className="relative ml-auto w-full max-w-64 sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск предмета…"
              className="h-8 w-full rounded-xs border border-lines-hover bg-card-menu pr-7 pl-8 font-blender-book text-xs text-text-primary transition-colors placeholder:text-text-muted focus:border-(--primary)/60 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Очистить"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-text-muted transition-colors hover:text-(--primary)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Сброс прогресса — двухшаговое подтверждение */}
          {confirmReset ? (
            <div className="flex items-center gap-1.5">
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">Сбросить всё?</span>
              <button
                type="button"
                onClick={doReset}
                className="flex h-8 items-center rounded-xs border border-danger/50 bg-danger/10 px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-danger transition-colors hover:bg-danger/20"
              >
                Да
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="flex h-8 items-center rounded-xs border border-lines-hover px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors hover:text-text-secondary"
              >
                Нет
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={foundCount === 0}
              title="Снять все отметки"
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors hover:border-danger/50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Сбросить
            </button>
          )}
        </div>

        {/* Волосяная линия прогресса */}
        <div className="h-0.5 w-full rounded-full bg-lines-hover">
          <div
            className="h-full rounded-full bg-(--primary) transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Список предметов — 3 в ряд на десктопе (grid-cols-1 · md:2 · xl:3), мобильный канон 1 в ряд. */}
      {ordered.length === 0 ? (
        <p className="py-16 text-center font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Предметы не найдены
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ordered.map((it, idx) => {
            const found = liveFound(it.objectiveId);
            const cell = (
              <button
                key={it.objectiveId}
                type="button"
                onClick={() => toggle(it.objectiveId)}
                aria-pressed={found}
                className={`flex w-full items-center gap-3 rounded-xs border p-2 text-left transition-colors ${
                  entering.has(it.objectiveId) ? 'animate-[fade-in_0.35s_ease-out]' : ''
                } ${
                  found ? 'border-success/30 bg-success/5' : 'border-lines-hover bg-card-menu hover:border-(--primary)/40'
                }`}
              >
                {/* Ячейка предмета EFT (атом баттлпасс-трекера): рарити-фон + блик + внутр. тень + обводка */}
                <span className="relative h-14 w-14 shrink-0">
                  <span className={`absolute inset-0 overflow-hidden rounded-xs ${EFT_CELL_BORDER}`}>
                    <span aria-hidden className="absolute inset-0" style={{ backgroundColor: getTarkovCellColor(it.backgroundColor) }} />
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/6 to-transparent" />
                    {found && <span aria-hidden className="absolute inset-0 bg-success/25" />}
                    <img
                      src={it.item.image512pxLink}
                      alt={it.item.name}
                      loading="lazy"
                      className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain p-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
                    />
                    <span aria-hidden className={`pointer-events-none absolute inset-0 z-10 ${EFT_CELL_SHADOW}`} />
                  </span>
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={`truncate font-blender-medium text-sm uppercase leading-tight ${
                      found ? 'text-text-muted line-through' : 'text-text-primary'
                    }`}
                  >
                    {it.item.name}
                  </span>
                  <span className="truncate font-blender-book text-type-caption text-text-muted">{it.item.shortName}</span>
                </div>
                {/* Чек-бокс */}
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border transition-colors ${
                    found ? 'border-success bg-success text-(--color-base)' : 'border-lines-hover text-transparent'
                  }`}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              </button>
            );

            // Разделитель-заголовок «Собрано · N / total» перед первым собранным — во всю ширину грида.
            if (idx === firstFoundIdx && firstFoundIdx > 0) {
              return (
                <Fragment key={`sec-${it.objectiveId}`}>
                  <div className="col-span-full flex items-center gap-2 pt-2">
                    <span className="font-blender-medium text-type-micro uppercase tracking-widest text-success">
                      Собрано · {committedFoundVisible} / {total}
                    </span>
                    <span className="h-px flex-1 bg-lines-hover" />
                  </div>
                  {cell}
                </Fragment>
              );
            }
            return cell;
          })}
        </div>
      )}
    </div>
  );
}
