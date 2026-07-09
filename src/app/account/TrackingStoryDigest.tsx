'use client';

// Домен «Истории» вкладки «Трекинг» — дайджест сюжетных walkthrough-гайдов.
// Ридер поверх useStoryProgressStore (+ авто-чек убежища): полоса «шагов N / всего»
// на каждую историю + «продолжить с главы N» (страница гайда авто-резюмит на неё).
// Ноль БД, ноль новых полей стора — облако и пины историй остаются отдельными задачами.
// Решение: docs/decisions/done/tracking-story-quests.md.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, BookOpen, ArrowRight, PlayCircle } from 'lucide-react';
import { useStoryProgressStore } from '@/store/useStoryProgressStore';
import { useHideoutStore } from '@/store/useHideoutStore';
import { STORY_WALKTHROUGHS } from '@/data/story-walkthroughs';
import { computeStoryProgress } from '@/lib/story-progress';
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

function ProgressBar({ pct, fillClass }: { pct: number; fillClass: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-xs bg-(--color-base)">
      <div
        className={`h-full rounded-xs transition-[width] duration-500 ${fillClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function TrackingStoryDigest() {
  // mounted-гард: persist-стор только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const conditionDone = useStoryProgressStore((s) => s.conditionDone);
  const branchChoice = useStoryProgressStore((s) => s.branchChoice);
  const levels = useHideoutStore((s) => s.levels);

  // Строки историй в хронологическом порядке реестра (порядок ключей = хронология глав).
  const rows = useMemo(() => {
    const cd = mounted ? conditionDone : {};
    const bc = mounted ? branchChoice : {};
    const lv = mounted ? levels : {};
    return Object.values(STORY_WALKTHROUGHS).map((w) => ({
      slug: w.slug,
      title: w.title,
      iconUrl: w.iconUrl,
      ...computeStoryProgress(w, cd, bc, lv),
    }));
  }, [mounted, conditionDone, branchChoice, levels]);

  const totalStories = rows.length;
  const storiesDone = useMemo(
    () => rows.filter((r) => r.total > 0 && r.done === r.total).length,
    [rows],
  );
  const stepsDone = useMemo(() => rows.reduce((n, r) => n + r.done, 0), [rows]);
  const stepsTotal = useMemo(() => rows.reduce((n, r) => n + r.total, 0), [rows]);
  const overallPct = stepsTotal ? Math.round((stepsDone / stepsTotal) * 100) : 0;

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Истории: <span className="text-success">{mounted ? storiesDone : 0}</span>
          <span className="text-text-muted"> / {totalStories}</span>
        </span>
        <div className="flex items-center gap-2">
          <ResetControl
            buttonLabel="СБРОС ИСТОРИЙ"
            buttonTitle="Сбросить прогресс сюжетных историй"
            modalTitle="Подтверждение сброса историй"
            onConfirm={() =>
              useStoryProgressStore.setState({ conditionDone: {}, branchChoice: {} })
            }
          >
            <p>Вы действительно хотите сбросить прогресс сюжетных историй?</p>
            <p>
              Будут очищены <span className="text-zinc-100">отметки условий</span> и{' '}
              <span className="text-zinc-100">выбранные ветки</span> во всех историях. Задания,
              достижения и убежище не затрагиваются.
            </p>
            <p className="text-text-muted">Хранится локально в браузере</p>
          </ResetControl>
          <Link
            href="/eft/quests/lore-quests"
            className="group inline-flex h-9 items-center gap-2 rounded border border-lines-hover px-3.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <span className="h-4.5 w-4.5 shrink-0 icon-mask icon-eft-quests-lore bg-text-secondary transition-colors group-hover:bg-(--primary)" />
            К сюжетным
          </Link>
        </div>
      </div>

      {/* ── Обзор: общий прогресс по шагам ── */}
      <SectionLabel>Прогресс</SectionLabel>

      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-primary/50">
          Пройдено шагов
        </span>
        <span className="font-blender-medium text-xs text-text-primary">
          {mounted ? stepsDone : 0} / {stepsTotal}
          <span className="ml-2 text-text-primary/50">{mounted ? overallPct : 0}%</span>
        </span>
      </div>
      <div className="mb-6 h-2 overflow-hidden rounded-xs bg-(--color-base)">
        <div
          className="h-full rounded-xs bg-success transition-[width] duration-500"
          style={{ width: `${mounted ? overallPct : 0}%` }}
        />
      </div>

      {/* ── Полосы по историям + «продолжить с главы N» ── */}
      <SectionLabel>Истории · {totalStories}</SectionLabel>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((r) => {
          const complete = mounted && r.total > 0 && r.done === r.total;
          const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
          return (
            <div
              key={r.slug}
              className="flex items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.iconUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-sm border border-lines-hover object-contain p-1"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Link
                    href={`/eft/quests/${r.slug}`}
                    className="truncate font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-colors hover:text-(--primary)"
                  >
                    {r.title}
                  </Link>
                  <span className="shrink-0 font-blender-medium text-type-micro text-text-primary/70">
                    {mounted ? r.done : 0} / {r.total}
                  </span>
                </div>
                <ProgressBar pct={mounted ? pct : 0} fillClass={complete ? 'bg-success' : 'bg-(--primary)'} />
              </div>

              {complete ? (
                <span
                  title="История пройдена"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-success/50 text-success"
                >
                  <Check className="h-4 w-4" />
                </span>
              ) : (
                <Link
                  href={`/eft/quests/${r.slug}`}
                  title={r.nextStep ? `Продолжить с главы ${r.nextStep}` : 'Открыть историю'}
                  className="flex h-7 shrink-0 items-center gap-1 rounded border border-lines-hover px-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  {mounted && r.nextStep ? `Гл. ${r.nextStep}` : 'Открыть'}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {totalStories === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-8 text-center">
          <BookOpen className="h-6 w-6 text-text-muted" />
          <p className="max-w-90 text-sm text-text-secondary">
            Истории появятся здесь по мере готовности гайдов.
          </p>
          <Link
            href="/eft/quests/lore-quests"
            className="inline-flex items-center gap-2 rounded border border-lines-hover px-4 py-2 font-blender-medium text-type-label uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            К сюжетным
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
