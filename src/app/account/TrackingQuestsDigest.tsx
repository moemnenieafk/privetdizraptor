'use client';

// Домен «Задания» вкладки «Трекинг» — дайджест побочных (трейдерских) квестов.
// Вотчлист = закреплённые (pinnedQuests из useQuestStore — механика карты квестов),
// мини-карточки с тогглом ✓ (toggleQuest: выполнение снимает пин — логика стора).
// Обзор = полосы прогресса по торговцам (считается впервые) + Каппа/Смотритель.
// Гибрид: быстрые действия тут, детали — /eft/questmap. БД/сторы не трогаем.
// Решение: docs/decisions/tracking-side-quests.md.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Paperclip, ArrowRight, Maximize2 } from 'lucide-react';
import { useQuestStore } from '@/store/useQuestStore';
import type { QuestsDigestData } from '@/lib/tracking-digest';
import { ResetControl } from '@/components/features/tracking/ResetControl';

// Фото торговца. Имена файлов без дефисов: normalizedName «btr-driver» → btrdriver.webp.
const traderPhoto = (nn: string) => `/images/traders/eft/${nn.replace(/-/g, '')}.webp`;

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
      <div className={`h-full rounded-xs transition-[width] duration-500 ${fillClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TrackingQuestsDigest({ digest }: { digest: QuestsDigestData }) {
  // mounted-гард: persist-стор только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const completedQuests = useQuestStore((s) => s.completedQuests);
  const pinnedQuests = useQuestStore((s) => s.pinnedQuests);
  const toggleQuest = useQuestStore((s) => s.toggleQuest);

  const completedSet = useMemo(() => new Set(mounted ? completedQuests : []), [mounted, completedQuests]);

  // Вотчлист: закреплённые квесты, знакомые нашему словарю (защита от стейл-id после вайпа).
  const pinned = useMemo(
    () =>
      (mounted ? pinnedQuests : [])
        .map((id) => ({ id, q: digest.questLite[id] }))
        .filter((x): x is { id: string; q: NonNullable<(typeof digest.questLite)[string]> } => Boolean(x.q)),
    [mounted, pinnedQuests, digest.questLite],
  );

  // Прогресс по торговцам: done = выполненные квесты этого торговца.
  const traderRows = useMemo(() => {
    const done = new Map<string, number>();
    for (const id of completedSet) {
      const t = digest.questLite[id]?.trader;
      if (t) done.set(t, (done.get(t) ?? 0) + 1);
    }
    return digest.traders.map((t) => ({ ...t, done: done.get(t.normalizedName) ?? 0 }));
  }, [completedSet, digest]);

  const kappaDone = useMemo(
    () => [...completedSet].reduce((n, id) => n + (digest.questLite[id]?.kappa ? 1 : 0), 0),
    [completedSet, digest.questLite],
  );
  const lkDone = useMemo(
    () => [...completedSet].reduce((n, id) => n + (digest.questLite[id]?.lk ? 1 : 0), 0),
    [completedSet, digest.questLite],
  );
  const doneTotal = [...completedSet].filter((id) => digest.questLite[id]).length;

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Задания: <span className="text-success">{doneTotal}</span>
          <span className="text-text-muted"> / {digest.totalQuests}</span>
        </span>
        <div className="flex items-center gap-2">
          <ResetControl
            buttonLabel="СБРОС ЗАДАНИЙ"
            buttonTitle="Сбросить прогресс заданий"
            modalTitle="Подтверждение сброса заданий"
            onConfirm={() =>
              useQuestStore.setState({ completedQuests: [], itemProgress: {}, pinnedQuests: [] })
            }
          >
            <p>Вы действительно хотите сбросить прогресс заданий?</p>
            <p>
              Будут очищены <span className="text-zinc-100">выполненные задания</span>, счётчики{' '}
              <span className="text-zinc-100">собранных предметов</span> и{' '}
              <span className="text-zinc-100">закреплённые</span>. Заметки к квестам, достижения и
              убежище не затрагиваются.
            </p>
            <p className="text-text-muted">Для залогиненных изменение синхронизируется с облаком</p>
          </ResetControl>
          <Link
            href="/eft/questmap"
            className="group inline-flex h-9 items-center gap-2 rounded border border-lines-hover px-3.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <span className="h-4.5 w-4.5 shrink-0 icon-mask icon-eft-prog-quest-map bg-text-secondary transition-colors group-hover:bg-(--primary)" />
            Карта квестов
          </Link>
        </div>
      </div>

      {/* ── Вотчлист: закреплённые ── */}
      <SectionLabel>Закреплённые · {pinned.length}</SectionLabel>

      {pinned.length > 0 ? (
        <div className="flex flex-col gap-2">
          {pinned.map(({ id, q }) => (
            <div
              key={id}
              className="flex items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={traderPhoto(q.trader)}
                alt=""
                className="h-9 w-9 shrink-0 rounded-sm border border-lines-hover object-cover"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/eft/quests/task/${id}`}
                  className="block truncate font-blender-medium text-sm uppercase text-text-primary transition-colors hover:text-(--primary)"
                >
                  {q.name}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  {q.kappa && (
                    <span className="flex items-center gap-1 text-type-micro uppercase tracking-widest text-kappa">
                      <span className="h-3 w-3 icon-mask icon-eft-profile-kappa bg-kappa" />
                      Каппа
                    </span>
                  )}
                  {q.lk && (
                    <span className="flex items-center gap-1 text-type-micro uppercase tracking-widest text-lightkeeper">
                      <span className="h-3 w-3 icon-mask icon-eft-profile-lightkeeper bg-lightkeeper" />
                      Смотритель
                    </span>
                  )}
                  {q.lvl && (
                    <span className="text-type-micro uppercase tracking-widest text-text-muted">
                      Уровень {q.lvl}
                    </span>
                  )}
                </div>
              </div>

              <Link
                href={`/eft/questmap?quest=${id}`}
                title="Открыть на карте квестов"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                title="Отметить выполненным"
                onClick={() => toggleQuest(id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-text-primary/50 text-text-primary/50 transition-colors hover:border-success hover:text-success"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-8 text-center">
          <Paperclip className="h-6 w-6 text-text-muted" />
          <p className="max-w-90 text-sm text-text-secondary">
            Нет закреплённых заданий. Закрепляйте квесты на карте квестов — они соберутся здесь.
          </p>
          <Link
            href="/eft/questmap"
            className="inline-flex items-center gap-2 rounded border border-lines-hover px-4 py-2 font-blender-medium text-type-label uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            К карте квестов
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* ── Обзор: Каппа / Смотритель ── */}
      <div className="mt-8">
        <SectionLabel>Прогресс</SectionLabel>

        <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-3">
            <span className="h-9 w-9 shrink-0 icon-mask icon-eft-profile-kappa bg-kappa" />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate font-blender-medium text-type-caption uppercase tracking-widest text-kappa">
                  Каппа
                </span>
                <span className="font-blender-medium text-type-micro text-text-primary/70">
                  {kappaDone} / {digest.kappaTotal}
                </span>
              </div>
              <ProgressBar pct={digest.kappaTotal ? Math.round((kappaDone / digest.kappaTotal) * 100) : 0} fillClass="bg-kappa" />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-3">
            <span className="h-9 w-9 shrink-0 icon-mask icon-eft-profile-lightkeeper bg-lightkeeper" />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate font-blender-medium text-type-caption uppercase tracking-widest text-lightkeeper">
                  Смотритель
                </span>
                <span className="font-blender-medium text-type-micro text-text-primary/70">
                  {lkDone} / {digest.lightkeeperTotal}
                </span>
              </div>
              <ProgressBar pct={digest.lightkeeperTotal ? Math.round((lkDone / digest.lightkeeperTotal) * 100) : 0} fillClass="bg-lightkeeper" />
            </div>
          </div>
        </div>

        {/* ── Полосы по торговцам ── */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {traderRows.map((t) => {
            const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
            return (
              <Link
                key={t.normalizedName}
                href={`/eft/quests/${t.normalizedName}`}
                className="group flex items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-3 transition-colors hover:border-(--primary)"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={traderPhoto(t.normalizedName)}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-sm border border-lines-hover object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary group-hover:text-(--primary)">
                      {t.name}
                    </span>
                    <span className="font-blender-medium text-type-micro text-text-primary/70">
                      {t.done} / {t.total}
                    </span>
                  </div>
                  <ProgressBar pct={pct} fillClass={pct >= 100 ? 'bg-success' : 'bg-(--primary)'} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
