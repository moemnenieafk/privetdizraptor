'use client';

// Walkthrough-гайд сюжетной истории (Figma: story-boreas-step01/02/03).
// Композиция:
//  1. Hero-панель: арт + СЛОЖНОСТЬ (шкала 7 черепов) + «Карта квеста» + ТРЕБОВАНИЯ.
//  2. Лестница шагов (348px) | контент (gap 28px): лестница трёхфазная — пройденные
//     зелёные с зачёркиванием, активный primary со стрелкой-маркером, будущие muted.
//     ВЛОЖЕННОСТЬ: у шага могут быть под-шаги (substeps) и развилки (branches) —
//     игрок выбирает путь, раскрывается ТОЛЬКО выбранная ветка (выбор можно сменить).
//  3. Контент шага/под-шага: медиа-карточка, «ВЫПОЛНЕНИЕ», условия = ноды <QuestNode>;
//     на шаге-развилке — карточки выбора пути.
//  4. Автопереход: условия закрыты → следующий под-шаг выбранного пути → следующий шаг.
// Чеки — useStoryProgressStore (общие с картой истории); убежище авто-чекается.
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Play, ChevronLeft, ChevronRight, ZoomIn, Check, AlertTriangle, GitBranch } from 'lucide-react';
import { useHideoutStore } from '@/store/useHideoutStore';
import {
  useStoryProgressStore,
  storyConditionKey,
  storyBranchKey,
} from '@/store/useStoryProgressStore';
import { stationIconClass } from '@/components/features/hideout/HideoutBuildTracker';
import { ResetControl } from '@/components/features/tracking/ResetControl';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { QuestNode } from '@/components/features/quests/QuestNode';
import { itemIconUrl } from '@/lib/item-icon';
import type { TaskRaw, TaskObjective, QuestNodeData } from '@/types/quest';
import type {
  StoryWalkthrough,
  WalkthroughCondition,
  WalkthroughStep,
  WalkthroughSubStep,
  WalkthroughBlock,
} from '@/data/story-walkthroughs/types';

const fmtRub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

// ── Условие шага → псевдо-TaskRaw для QuestNode ──────────────────────────────
function conditionToTask(cond: WalkthroughCondition, key: string, slug: string): TaskRaw {
  const objectives: TaskObjective[] = [];
  if (cond.kind === 'hideout' && cond.station) {
    objectives.push({
      id: `${key}-build`,
      __typename: 'TaskObjectiveBasic',
      type: 'findQuestItem',
      description: `Постройка: ${cond.station.name}, Уровень ${cond.station.level}`,
    } as TaskObjective);
  }
  if (cond.kind === 'item' && cond.item) {
    objectives.push({
      id: `${key}-item`,
      __typename: 'TaskObjectiveItem',
      type: 'giveItem',
      description: cond.item.name,
      item: {
        id: cond.item.id,
        name: cond.item.name,
        shortName: cond.item.name,
        image512pxLink: itemIconUrl(cond.item.id),
      },
      count: cond.item.count,
      foundInRaid: Boolean(cond.item.fir),
    } as TaskObjective);
  }
  if (cond.kind === 'story' && cond.story) {
    objectives.push({
      id: `${key}-note`,
      __typename: 'TaskObjectiveBasic',
      type: 'findQuestItem',
      description: cond.story.note,
    } as TaskObjective);
  }
  return {
    id: `sb-${key}`,
    name: cond.label,
    normalizedName: `sb-${key}`,
    kappaRequired: false,
    lightkeeperRequired: false,
    minPlayerLevel: 0,
    experience: 0,
    // Торговец в условии → его normalizedName (фото webp в шапке + фирменный цвет ноды).
    trader: { name: cond.label, normalizedName: cond.trader ?? slug },
    taskRequirements: [],
    objectives,
    finishRewards: { items: [], traderStanding: [] },
  } as unknown as TaskRaw;
}

// Иконка шапки ноды: торговец → undefined (QuestNode отрисует фото), локация → icon-eft-maps-*.
function conditionHeaderIcon(cond: WalkthroughCondition): string | undefined {
  if (cond.trader) return undefined;
  if (cond.mapIcon) return cond.mapIcon;
  if (cond.kind === 'hideout') return 'icon-eft-prog-hideout';
  if (cond.kind === 'item') return 'icon-eft-currency-ruble';
  return cond.story?.iconClass;
}

// Активный элемент лестницы: главный шаг (sub: null) или под-шаг.
interface ActiveSel {
  n: number;
  sub: string | null;
}

// Под-шаги шага с учётом выбранной ветки развилки.
function subsFor(step: WalkthroughStep, choice: string | undefined): WalkthroughSubStep[] {
  if (step.branches) {
    const br = step.branches.find((b) => b.id === choice);
    return br ? br.substeps : [];
  }
  return step.substeps ?? [];
}

function stepHasContent(s: WalkthroughStep): boolean {
  return s.blocks.length > 0 || Boolean(s.media) || Boolean(s.branches?.length) || Boolean(s.substeps?.length);
}

// ── Главный компонент ────────────────────────────────────────────────────────
export function StoryWalkthroughView({
  story,
  priceByItemId,
}: {
  story: StoryWalkthrough;
  priceByItemId: Record<string, number | null>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [active, setActive] = useState<ActiveSel>({
    n: story.steps.find(stepHasContent)?.n ?? 1,
    sub: null,
  });
  const step = story.steps.find((s) => s.n === active.n) ?? story.steps[0];

  // Галерея: null = постер; i = скриншот.
  const [shot, setShot] = useState<number | null>(null);
  useEffect(() => setShot(null), [active]);

  const levels = useHideoutStore((s) => s.levels);
  const conditionDone = useStoryProgressStore((s) => s.conditionDone);
  const toggleCondition = useStoryProgressStore((s) => s.toggleCondition);
  const branchChoice = useStoryProgressStore((s) => s.branchChoice);
  const setBranch = useStoryProgressStore((s) => s.setBranch);
  const resetStory = useStoryProgressStore((s) => s.resetStory);
  const { openFeedback } = useFeedback();

  const isAutoDone = useCallback(
    (c: WalkthroughCondition) =>
      c.kind === 'hideout' && c.station
        ? (mounted ? (levels[c.station.normalizedName] ?? 0) : 0) >= c.station.level
        : false,
    [levels, mounted],
  );

  // Все condition-блоки списка отмечены? (пустой список условий → vacuous, если allowEmpty)
  const blocksDone = useCallback(
    (blocks: WalkthroughBlock[], n: number, subId: string | undefined, allowEmpty: boolean) => {
      const cond = blocks
        .map((b, idx) => ({ b, idx }))
        .filter(({ b }) => b.condition);
      if (cond.length === 0) return allowEmpty;
      return cond.every(({ b, idx }) => {
        const key = storyConditionKey(story.slug, n, idx, subId);
        return (mounted && conditionDone[key]) || (b.condition ? isAutoDone(b.condition) : false);
      });
    },
    [story.slug, mounted, conditionDone, isAutoDone],
  );

  const subDone = useCallback(
    (s: WalkthroughStep, sub: WalkthroughSubStep) => blocksDone(sub.blocks, s.n, sub.id, false),
    [blocksDone],
  );

  // Готовность шага: свои условия + все под-шаги выбранного пути.
  const stepDone = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const s of story.steps) {
      const choice = mounted ? branchChoice[storyBranchKey(story.slug, s.n)] : undefined;
      const subs = subsFor(s, choice);
      if (s.branches) {
        map.set(
          s.n,
          Boolean(choice) &&
            subs.length > 0 &&
            subs.every((sub) => subDone(s, sub)) &&
            blocksDone(s.blocks, s.n, undefined, true),
        );
      } else if (s.substeps?.length) {
        map.set(s.n, subs.every((sub) => subDone(s, sub)) && blocksDone(s.blocks, s.n, undefined, true));
      } else {
        map.set(s.n, blocksDone(s.blocks, s.n, undefined, false));
      }
    }
    return map;
  }, [story, mounted, branchChoice, subDone, blocksDone]);

  // Выбор ветки: сохранить путь и открыть его первый под-шаг.
  const chooseBranch = useCallback(
    (s: WalkthroughStep, branchId: string) => {
      setBranch(storyBranchKey(story.slug, s.n), branchId);
      const first = s.branches?.find((b) => b.id === branchId)?.substeps[0];
      setActive({ n: s.n, sub: first?.id ?? null });
    },
    [setBranch, story.slug],
  );

  // Следующая цель после текущего выбора: незакрытый под-шаг пути → следующий шаг с контентом.
  const nextTarget = useCallback((): ActiveSel | null => {
    const choice = branchChoice[storyBranchKey(story.slug, active.n)];
    const subs = subsFor(step, choice);
    if (active.sub) {
      const undone = subs.find((x) => x.id !== active.sub && !subDone(step, x));
      if (undone) return { n: active.n, sub: undone.id };
    }
    const next = story.steps.find((s) => s.n > active.n && stepHasContent(s));
    return next ? { n: next.n, sub: null } : null;
  }, [active, step, subDone, branchChoice, story.slug, story.steps]);

  // Контент правой колонки: активный под-шаг или сам шаг.
  const activeChoice = mounted ? branchChoice[storyBranchKey(story.slug, active.n)] : undefined;
  const activeSubs = subsFor(step, activeChoice);
  const activeSub = active.sub ? activeSubs.find((x) => x.id === active.sub) ?? null : null;
  // Активная ветка-выбор (шаг-развилка + выбранный путь) — фолбэк медиа для «выбора».
  const activeBranch = step.branches && activeChoice ? step.branches.find((x) => x.id === activeChoice) : undefined;
  const view = activeSub
    ? { title: activeSub.title, intro: activeSub.intro, blocks: activeSub.blocks, subId: activeSub.id }
    : { title: null, intro: step.intro, blocks: step.blocks, subId: undefined };
  const viewDone = activeSub ? subDone(step, activeSub) : stepDone.get(step.n);
  const viewDoneNow = Boolean(mounted && viewDone);
  const viewDoneRef = useRef(viewDoneNow);
  viewDoneRef.current = viewDoneNow;

  // «Свежесть» закрытия: если этап УЖЕ был выполнен в момент перехода на него —
  // автопереход не дёргаем (возврат на пройденный шаг не должен никуда перекидывать).
  const enteredDone = useRef(false);
  useEffect(() => {
    enteredDone.current = viewDoneRef.current;
  }, [active]);

  // Резюме прогресса при заходе на страницу: открыть первый незакрытый шаг (один раз).
  const resumed = useRef(false);
  useEffect(() => {
    if (!mounted || resumed.current) return;
    resumed.current = true;
    enteredDone.current = true; // программный переход — не считается свежим закрытием
    const first = story.steps.find((s) => stepHasContent(s) && !stepDone.get(s.n));
    if (first && first.n !== active.n) setActive({ n: first.n, sub: null });
  }, [mounted, stepDone, active.n, story.steps]);

  // Автопереход с паузой 4с и отменой — ТОЛЬКО при свежем закрытии этапа.
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledAdvance = useRef<Set<string>>(new Set());
  const selKey = `${active.n}|${active.sub ?? ''}`;
  useEffect(() => {
    if (!viewDoneNow) {
      setPendingAdvance(false); // сняли чек — отменяем переход
      return;
    }
    if (enteredDone.current || cancelledAdvance.current.has(selKey)) return;
    const target = nextTarget();
    if (!target) return;
    setPendingAdvance(true);
    advanceTimer.current = setTimeout(() => {
      setPendingAdvance(false);
      setActive(target);
    }, 4000);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      setPendingAdvance(false);
    };
  }, [viewDoneNow, selKey, nextTarget]);

  const stayHere = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    cancelledAdvance.current.add(selKey);
    setPendingAdvance(false);
  };
  const goNext = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setPendingAdvance(false);
    const target = nextTarget();
    if (target) setActive(target);
  };

  // Медиа по приоритету: под-этап → ветка-выбор → шаг → дефолт (обе заглушки).
  // Фолбэк — арт истории (или CSS-заглушка, если арта нет).
  const media = activeSub?.media ?? activeBranch?.media ?? step.media ?? {
    poster: story.heroImage ?? '',
    posterTitle: story.title,
    posterSub: 'ИСТОРИЯ',
    video: false,
    videoUrl: undefined,
    screenshots: [],
    // Дефолт для шагов/подэтапов без своего медиа: обе заглушки, пока нет контента.
    videoSoon: true,
    screenshotsSoon: true,
  };
  const mediaSrc = shot === null ? media.poster : media.screenshots[shot];
  // Декор постера: свой арт (Борей — якорь) или иконка-маска истории; цвет градиента тайтла.
  const decor = story.posterDecor ?? { image: undefined, gradientTo: 'var(--color-text-secondary)' };

  const nav = (dir: 1 | -1) => {
    const total = media.screenshots.length + 1; // + постер
    const cur = shot === null ? 0 : shot + 1;
    const next = (cur + dir + total) % total;
    setShot(next === 0 ? null : next - 1);
  };

  const noop = useCallback(() => {}, []);
  const noopHover = useCallback((_: string | null) => {}, []);
  const noopSelect = useCallback((_: TaskRaw) => {}, []);

  // Цвет градации сложности: 1-2 черепа — зелёный, 3-4 — оранжевый, 5+ — красный.
  const diff =
    story.difficulty.skulls >= 5
      ? { skull: 'bg-danger', text: 'text-danger' }
      : story.difficulty.skulls >= 3
        ? { skull: 'bg-(--primary)', text: 'text-(--primary)' }
        : { skull: 'bg-success', text: 'text-success' };

  // Рендер блоков (шаг или под-шаг) — единый для обоих уровней.
  const renderBlocks = (blocks: WalkthroughBlock[], n: number, subId: string | undefined) =>
    blocks.map((b, idx) => {
      const key = storyConditionKey(story.slug, n, idx, subId);
      const auto = b.condition ? isAutoDone(b.condition) : false;
      const done = auto || (mounted && Boolean(conditionDone[key]));
      const price = b.priceNote ? priceByItemId[b.priceNote.itemId] : null;
      return (
        <div key={idx} className="flex flex-col gap-3.5">
          {b.text?.map((t) => (
            <div key={t.slice(0, 24)} className="flex items-start gap-3.5">
              <span className="mt-2 h-1.25 w-1.25 shrink-0 bg-(--primary)" />
              <p className="min-w-0 flex-1 text-sm leading-snug text-text-secondary">{t}</p>
            </div>
          ))}
          {b.subList && (
            <ul className="ml-14 list-disc text-sm leading-snug text-text-secondary">
              {b.subList.map((li) => (
                <li key={li.slice(0, 24)}>{li}</li>
              ))}
            </ul>
          )}
          {b.priceNote && (
            <div className="flex items-start gap-3.5">
              <span className="mt-2 h-1.25 w-1.25 shrink-0 bg-(--primary)" />
              <p className="min-w-0 flex-1 text-sm leading-snug text-text-secondary">
                {b.priceNote.template.split('{price}')[0]}
                <span className="text-nvg-green">
                  {price != null ? `${fmtRub(price)} (актуальная цена)` : 'нет на Барахолке'}
                </span>
              </p>
            </div>
          )}
          {b.condition && (
            <div className="mx-auto w-full max-w-87">
              <QuestNode
                data={{
                  task: conditionToTask(b.condition, key, story.slug),
                  status: done ? 'completed' : 'active',
                  pinned: false,
                  hidePin: true,
                  headerIconClass: conditionHeaderIcon(b.condition),
                  onToggle: () => toggleCondition(key),
                  onForceComplete: noop,
                  onSelect: noopSelect,
                  onHover: noopHover,
                  onPin: noop,
                } satisfies QuestNodeData}
              />
            </div>
          )}
          {b.warning && (
            <div className="flex items-start gap-2.5 rounded border border-(--primary)/30 bg-primary/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-(--primary)" />
              <p className="min-w-0 flex-1 text-sm leading-snug text-(--primary)">{b.warning}</p>
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="flex w-full flex-col gap-7">
      {/* ── Hero-панель истории ── */}
      <div className="relative h-49 w-full overflow-hidden rounded-lg">
        <div className="absolute inset-0 bg-(--color-darkbase)" />
        {story.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          // Заглушка hero (арта истории нет): большая иконка-маска истории на darkbase
          <span
            className={`absolute right-10 top-1/2 h-36 w-36 -translate-y-1/2 icon-mask ${story.iconClass} bg-text-primary opacity-10`}
          />
        )}
        <div className="absolute inset-y-0 left-0 flex w-87 flex-col justify-between rounded-l-lg bg-linear-to-r from-(--color-darkbase) from-40% to-transparent p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-2">
              <span className="font-blender-medium text-base uppercase text-text-secondary">Сложность:</span>
              {/* Шкала сложности: 7 слотов; цвет по градации (1-2 зелёный · 3-4 оранжевый · 5+ красный), пустые — lines-hover */}
              <span className="flex items-center gap-1">
                {Array.from({ length: 7 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-4 w-4 icon-mask icon-eft-difficulty-skull ${i < story.difficulty.skulls ? diff.skull : 'bg-lines-hover'}`}
                  />
                ))}
              </span>
              <span className={`font-blender-medium text-type-micro uppercase tracking-widest ${diff.text}`}>
                {story.difficulty.label}
              </span>
            </div>
            {story.hasMap && (
              <Link
                href={`/eft/quests/${story.slug}/map`}
                className="group flex h-9 shrink-0 items-center gap-2 rounded border border-lines-hover bg-card-menu px-3.5 transition-colors hover:border-(--primary)"
              >
                <span className="h-4 w-4 shrink-0 icon-mask icon-eft-prog-quest-map bg-text-secondary transition-colors group-hover:bg-(--primary)" />
                <span className="font-blender-medium text-xs uppercase text-text-secondary transition-colors group-hover:text-(--primary)">
                  Карта квеста
                </span>
              </Link>
            )}
          </div>

          {story.requirement && (
            <div className="flex flex-col gap-2">
              <span className="font-blender-medium text-base uppercase text-text-secondary">Требования:</span>
              <div className="flex items-center gap-3.5">
                {story.requirement.station && (
                  <span className="flex items-center gap-1">
                    <span className={`h-7 w-7 shrink-0 icon-mask ${stationIconClass(story.requirement.station.normalizedName)} bg-mode-pvp`} />
                    <span className="flex flex-col font-blender-medium leading-tight text-mode-pvp">
                      <span className="text-sm">{story.requirement.station.name}</span>
                      <span className="text-xs">УР. 0{story.requirement.station.level}</span>
                    </span>
                  </span>
                )}
                <span className="text-xs leading-tight text-text-secondary">
                  {story.requirement.note.map((l) => (
                    <span key={l} className="block">{l}</span>
                  ))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Лестница | Контент шага ── */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[348px_1fr]">
        {/* Лестница шагов: вложенные под-шаги и ветки раскрываются под активным шагом */}
        <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0 [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--color-lines-hover)_55%,transparent)_transparent]">
          {story.steps.map((s) => {
            const isActiveStep = s.n === active.n;
            const clickable = stepHasContent(s);
            const done = mounted && stepDone.get(s.n);
            const choice = mounted ? branchChoice[storyBranchKey(story.slug, s.n)] : undefined;
            const expanded = isActiveStep && (Boolean(s.branches?.length) || Boolean(s.substeps?.length));

            const subRow = (sub: WalkthroughSubStep, i: number, indent: string) => {
              const isActiveSub = isActiveStep && active.sub === sub.id;
              const sd = mounted && subDone(s, sub);
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActive({ n: s.n, sub: sub.id })}
                  title={sub.title}
                  className={`flex h-10 w-52 shrink-0 items-center gap-2.5 rounded py-2 pr-3 text-left transition-all lg:w-auto ${indent} ${
                    isActiveSub
                      ? 'border border-(--primary) bg-primary/10'
                      : sd
                        ? 'border border-success/40 bg-success/5'
                        : 'border border-lines-hover bg-card-menu hover:border-text-secondary'
                  }`}
                >
                  <span
                    className={`min-w-0 flex-1 truncate font-blender-medium text-xs ${
                      isActiveSub ? 'text-(--primary)' : sd ? 'text-success line-through' : 'text-text-secondary'
                    }`}
                  >
                    {sub.title}
                  </span>
                  <span
                    className={`font-blender-medium text-sm leading-none ${
                      isActiveSub ? 'text-(--primary)' : sd ? 'text-success' : 'text-text-muted'
                    }`}
                  >
                    {String(s.n).padStart(2, '0')}.{i + 1}
                  </span>
                </button>
              );
            };

            return (
              <div key={s.n} className="relative flex shrink-0 gap-1 lg:w-full lg:flex-col">
                {/* Стрелка-маркер активного шага (как в макете) */}
                {isActiveStep && (
                  <span className="absolute -left-4 top-7 hidden -translate-y-1/2 border-y-7 border-l-8 border-y-transparent border-l-(--primary) lg:block" />
                )}
                <button
                  type="button"
                  disabled={!clickable && !isActiveStep}
                  onClick={() => clickable && setActive({ n: s.n, sub: null })}
                  title={clickable ? s.title : `${s.title} — в разработке`}
                  className={`flex h-14 w-full shrink-0 items-center gap-3.5 rounded py-3.5 pl-5 pr-3.5 text-left transition-all ${
                    isActiveStep
                      ? 'border border-(--primary) bg-primary/10'
                      : done
                        ? 'border border-success/50 bg-success/5'
                        : clickable
                          ? 'border border-lines-hover bg-card-menu hover:border-text-secondary'
                          : 'cursor-not-allowed border border-lines-hover bg-card-menu opacity-25'
                  }`}
                >
                  {s.traderPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.traderPhoto} alt="" className="h-5.5 w-5.5 shrink-0 rounded-xs object-cover" />
                  )}
                  {(s.branches?.length ?? 0) > 0 && (
                    <GitBranch className={`h-3.5 w-3.5 shrink-0 ${isActiveStep ? 'text-(--primary)' : 'text-text-muted'}`} />
                  )}
                  <span
                    className={`hidden min-w-0 flex-1 truncate font-blender-medium text-sm lg:block ${
                      isActiveStep ? 'text-(--primary)' : done ? 'text-success line-through' : 'text-text-secondary'
                    }`}
                  >
                    {s.title}
                  </span>
                  <span
                    className={`flex items-center gap-1 font-blender-medium text-2xl uppercase leading-none ${
                      isActiveStep ? 'text-(--primary)' : done ? 'text-success line-through' : 'text-text-muted'
                    }`}
                  >
                    {String(s.n).padStart(2, '0')}
                  </span>
                </button>

                {/* Вложенность: ветки развилки (раскрыт только выбранный путь) или под-шаги */}
                {expanded && s.branches && (
                  <div className="flex gap-1 lg:flex-col lg:border-l lg:border-lines-hover lg:pl-3 lg:ml-4">
                    {s.branches.map((br) => {
                      const chosen = choice === br.id;
                      const brDone =
                        mounted && chosen && br.substeps.length > 0 && br.substeps.every((x) => subDone(s, x));
                      return (
                        <div key={br.id} className="flex shrink-0 gap-1 lg:flex-col">
                          <button
                            type="button"
                            onClick={() => chooseBranch(s, br.id)}
                            title={br.title}
                            className={`flex h-10 w-52 shrink-0 items-center gap-2.5 rounded py-2 pl-3 pr-3 text-left transition-all lg:w-auto ${
                              chosen
                                ? brDone
                                  ? 'border border-success/50 bg-success/5'
                                  : 'border border-(--primary)/60 bg-primary/5'
                                : 'border border-lines-hover bg-card-menu opacity-50 hover:opacity-100 hover:border-text-secondary'
                            }`}
                          >
                            <GitBranch
                              className={`h-3.5 w-3.5 shrink-0 ${chosen ? (brDone ? 'text-success' : 'text-(--primary)') : 'text-text-muted'}`}
                            />
                            <span
                              className={`min-w-0 flex-1 truncate font-blender-medium text-xs uppercase ${
                                chosen ? (brDone ? 'text-success line-through' : 'text-(--primary)') : 'text-text-secondary'
                              }`}
                            >
                              {br.title}
                            </span>
                          </button>
                          {chosen && (
                            <div className="flex gap-1 lg:flex-col lg:border-l lg:border-lines-hover lg:pl-3 lg:ml-3">
                              {br.substeps.map((sub, i) => subRow(sub, i, 'pl-3'))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {expanded && !s.branches && s.substeps && (
                  <div className="flex gap-1 lg:flex-col lg:border-l lg:border-lines-hover lg:pl-3 lg:ml-4">
                    {s.substeps.map((sub, i) => subRow(sub, i, 'pl-3'))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Неприметный сброс прогресса истории — в конце лестницы (та же модалка ДА/НЕТ) */}
          <div className="mt-1 flex shrink-0 lg:mt-3">
            <ResetControl
              buttonLabel="Сброс прогресса"
              buttonTitle={`Сбросить прогресс истории «${story.title}»`}
              modalTitle="Сброс прогресса истории"
              onConfirm={() => {
                resetStory(story.slug);
                setActive({ n: story.steps.find(stepHasContent)?.n ?? 1, sub: null });
              }}
              buttonClassName="flex h-7 w-40 shrink-0 items-center justify-center gap-2 rounded border border-danger bg-danger/10 opacity-50 transition-all hover:bg-danger/20 hover:opacity-100 focus:outline-none"
            >
              <p>
                Весь прогресс прохождения истории «{story.title}» — отметки этапов, выбранные пути
                развилок и под-шаги — будет безвозвратно удалён.
              </p>
              <p>Прогресс других историй и разделов затронут не будет.</p>
            </ResetControl>
          </div>
        </div>

        {/* Контент шага / под-шага */}
        <div className="flex min-w-0 flex-col gap-7">
          {/* Медиа: постер/карточка истории + галерея (у каждого шага) */}
          <div className="flex flex-col gap-3.5 sm:flex-row">
            <div className="relative h-64 w-full overflow-hidden rounded border border-lines-hover bg-(--color-base) sm:h-[18.875rem] sm:flex-1">
              {mediaSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                // Заглушка постера (арта нет): иконка-маска истории по центру darkbase
                <span
                  className={`absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 icon-mask ${story.iconClass} bg-text-primary opacity-15`}
                />
              )}
              {shot === null && (
                <>
                  <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/30" />
                  <div className="absolute bottom-5 left-4 flex items-end gap-3.5">
                    {decor.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={decor.image} alt="" className="h-15 w-auto" />
                    ) : (
                      <span className={`h-15 w-15 shrink-0 icon-mask ${story.iconClass} bg-text-primary opacity-80`} />
                    )}
                    <span className="flex flex-col">
                      <span
                        className="bg-clip-text font-blender-medium text-6xl uppercase leading-[0.8] text-transparent"
                        style={{ backgroundImage: `linear-gradient(to bottom, #fff, ${decor.gradientTo})` }}
                      >
                        {media.posterTitle}
                      </span>
                      <span className="mt-1 font-blender-medium text-sm uppercase tracking-[0.14em] text-(--primary)">
                        {media.posterSub}
                      </span>
                    </span>
                  </div>
                  {media.video &&
                    (media.videoUrl ? (
                      <a
                        href={media.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Смотреть видеогайд"
                        className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 backdrop-blur-xs transition-transform hover:scale-105"
                      >
                        <Play className="h-9 w-9 fill-current text-text-primary" />
                      </a>
                    ) : (
                      <span className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 backdrop-blur-xs transition-transform hover:scale-105">
                        <Play className="h-9 w-9 fill-current text-text-primary" />
                      </span>
                    ))}
                  {/* Заглушка «видео скоро» — пока нет реального video/videoUrl */}
                  {!media.video && media.videoSoon && (
                    <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
                      <span className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-lines-hover bg-black/40 backdrop-blur-xs">
                        <Play className="h-9 w-9 fill-current text-text-muted opacity-40" />
                      </span>
                      <span className="rounded-xs bg-black/50 px-2 py-0.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                        Видео скоро
                      </span>
                    </div>
                  )}
                </>
              )}
              {media.screenshots.length > 0 && (
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <button type="button" aria-label="Назад" onClick={() => nav(-1)} className="flex h-11 w-11 lg:h-9 lg:w-9 items-center justify-center rounded border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" aria-label="Вперёд" onClick={() => nav(1)} className="flex h-11 w-11 lg:h-9 lg:w-9 items-center justify-center rounded border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <a href={mediaSrc ?? '#'} target="_blank" rel="noreferrer" aria-label="Увеличить" className="flex h-11 w-11 lg:h-9 lg:w-9 items-center justify-center rounded border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)">
                    <ZoomIn className="h-5 w-5" />
                  </a>
                </div>
              )}
            </div>

            {/* Миниатюры */}
            {media.screenshots.length > 0 && (
              <div className="flex h-24 gap-2 overflow-x-auto sm:h-[18.875rem] sm:w-44 sm:flex-wrap sm:content-start sm:overflow-y-auto sm:overflow-x-hidden sm:pr-1 [scrollbar-width:thin] [scrollbar-color:color-mix(in_srgb,var(--color-lines-hover)_55%,transparent)_transparent]">
                <button
                  type="button"
                  onClick={() => setShot(null)}
                  className={`relative h-10.5 w-19 shrink-0 overflow-hidden rounded-xs border transition-opacity ${shot === null ? 'border-(--primary)' : 'border-lines-hover opacity-50 hover:opacity-90'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={media.poster} alt="" className="h-full w-full object-cover" />
                </button>
                {media.screenshots.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShot(i)}
                    className={`relative h-10.5 w-19 shrink-0 overflow-hidden rounded-xs border transition-opacity ${shot === i ? 'border-(--primary)' : 'border-lines-hover opacity-50 hover:opacity-90'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {/* Заглушка «скриншоты скоро» — плитки-плейсхолдеры, пока галереи нет */}
            {media.screenshots.length === 0 && media.screenshotsSoon && (
              <div className="flex h-24 flex-col gap-2 sm:h-[18.875rem] sm:w-44">
                <div className="flex flex-1 flex-wrap content-start gap-2 overflow-hidden">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex h-10.5 w-19 shrink-0 items-center justify-center rounded-xs border border-dashed border-lines-hover bg-card-menu"
                    >
                      <span className={`h-5 w-5 icon-mask ${story.iconClass} bg-text-muted opacity-30`} />
                    </div>
                  ))}
                </div>
                <span className="shrink-0 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                  Скриншоты скоро
                </span>
              </div>
            )}
          </div>

          {/* ВЫПОЛНЕНИЕ */}
          {(view.intro || view.blocks.length > 0 || view.title) && (
            <div className="flex flex-col gap-3.5">
              <h2 className="font-blender-medium text-base uppercase text-text-primary">
                Выполнение:
                {view.title && <span className="ml-2 text-(--primary)">{view.title}</span>}
              </h2>
              {view.intro && <p className="text-sm leading-snug text-text-secondary">{view.intro}</p>}
            </div>
          )}

          {/* Блоки активного уровня (шаг или под-шаг) */}
          {renderBlocks(view.blocks, step.n, view.subId)}

          {/* Шаг-развилка: карточки выбора пути (пока путь не выбран или на уровне шага) */}
          {!activeSub && step.branches && (
            <div className="flex flex-col gap-3.5">
              <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                Выберите свой путь
              </span>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {step.branches.map((br) => {
                  const chosen = activeChoice === br.id;
                  return (
                    <button
                      key={br.id}
                      type="button"
                      onClick={() => chooseBranch(step, br.id)}
                      className={`flex flex-col gap-2 rounded border p-4 text-left transition-colors ${
                        chosen
                          ? 'border-(--primary) bg-primary/10'
                          : 'border-lines-hover bg-card-menu hover:border-text-secondary'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <GitBranch className={`h-4 w-4 shrink-0 ${chosen ? 'text-(--primary)' : 'text-text-muted'}`} />
                        <span
                          className={`font-blender-medium text-sm uppercase ${chosen ? 'text-(--primary)' : 'text-text-primary'}`}
                        >
                          {br.title}
                        </span>
                      </span>
                      {br.note && <span className="text-xs leading-snug text-text-secondary">{br.note}</span>}
                      <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                        Под-шагов: {br.substeps.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view.blocks.length === 0 && !step.media && !step.branches && !step.substeps && (
            <p className="rounded-lg border border-lines-hover bg-(--color-base) p-8 text-center text-sm text-text-muted">
              Контент шага «{step.title}» готовится.
            </p>
          )}

          {/* Уровень закрыт — плашка: свежее закрытие → автопереход 4с с «Остаться»;
              возврат на пройденный этап → только ручная кнопка «К следующему». */}
          {viewDoneNow && (
            <div className="flex flex-col items-center gap-3 rounded border border-success/40 bg-success/10 p-4 sm:flex-row sm:justify-between">
              <span className="flex items-center gap-2 font-blender-medium text-sm uppercase tracking-widest text-success">
                <Check className="h-4 w-4 shrink-0" />
                {pendingAdvance ? 'Этап выполнен — переходим к следующему…' : 'Этап выполнен'}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {pendingAdvance && (
                  <button
                    type="button"
                    onClick={stayHere}
                    className="flex h-8 items-center rounded border border-lines-hover bg-card-menu px-3 font-blender-medium text-xs uppercase text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
                  >
                    Остаться
                  </button>
                )}
                {nextTarget() && (
                  <button
                    type="button"
                    onClick={goNext}
                    className="flex h-8 items-center gap-1 rounded border border-success/50 px-3 font-blender-medium text-xs uppercase text-success transition-colors hover:bg-success/10"
                  >
                    К следующему этапу
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </div>
          )}

          {/* Футер актуальности */}
          <div className="flex flex-col gap-3 border-t border-lines-hover pt-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex flex-wrap items-center gap-3.5 text-xs text-mode-pvp">
                <span>{story.verifiedAt.date}</span>
                <span>{story.verifiedAt.time}</span>
                <span>Информация актуальна для версии игры EFT: {story.verifiedAt.gameVersion}</span>
              </span>
              <button
                type="button"
                onClick={() => openFeedback()}
                title="Сообщить об ошибке или неточности данных"
                className="flex h-7 w-40 items-center justify-center gap-1 rounded-xs border border-lines-hover font-blender-medium text-xs uppercase text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                Сообщить об ошибке
              </button>
            </div>
            <p className="flex items-start gap-2 text-type-micro leading-snug text-text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/info-label.svg" alt="" className="mt-px h-3 w-3 shrink-0 opacity-60" />
              Дата и время отображает крайнюю автоматическую сверку данных с информацией доступной в
              глобальной сети касательно текущего раздела “ЦТА”.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
