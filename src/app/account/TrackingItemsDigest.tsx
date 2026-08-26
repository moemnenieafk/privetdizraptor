'use client';

// Домен «Предметы» вкладки «Трекинг» — дайджест нужных КВЕСТОВЫХ предметов.
// Активные требования (без выполненных квестов), топ-N ближайших к завершению со
// строками X/Y, «Найдено в рейде» и ± (пишет в useQuestStore.itemProgress — синк
// с /eft/progress/tracker и needed автоматический). Валюта/патроны — «стек за 1 шт.».
// Предметы убежища живут в домене «Убежище» (TrackingHideoutDigest).
// Гибрид: быстрый инкремент тут, полный список — /eft/progress/needed.
// Решение: docs/decisions/tracking-needed-items.md.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, ArrowRight, PackageCheck } from 'lucide-react';
import { useQuestStore } from '@/store/useQuestStore';
import { itemIconUrl } from '@/lib/item-icon';
import type { QuestItemReq } from '@/lib/tracking-digest';
import { ResetControl } from '@/components/features/tracking/ResetControl';
import { FoundInRaidBadge } from '@/components/ui/FoundInRaidBadge';

const TOP_QUEST_ITEMS = 6;

interface QuestItemAgg {
  itemId: string;
  name: string;
  short: string;
  fir: boolean;
  needed: number;
  found: number;
  /** требования-источники для маппинга ± на objectives */
  reqs: QuestItemReq[];
}

// Метка-заголовок блока с линией (rule-micro-labels).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
      <span className="h-px w-6 bg-lines-hover" />
      {children}
    </h3>
  );
}

export function TrackingItemsDigest({ itemRequirements }: { itemRequirements: QuestItemReq[] }) {
  // mounted-гард: persist-сторы только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const completedQuests = useQuestStore((s) => s.completedQuests);
  const itemProgress = useQuestStore((s) => s.itemProgress);
  const setItemCount = useQuestStore((s) => s.setItemCount);

  const completedSet = useMemo(() => new Set(mounted ? completedQuests : []), [mounted, completedQuests]);

  // ── Квестовые: агрегация активных требований по предмету ──
  // Валюта/патроны (stackAsOne): «весь стек = 1 шт.» — не суммируем рубли и пачки
  // патронов в счётчиках, требование бинарное (собрал сумму целиком или нет).
  const questAgg = useMemo(() => {
    const map = new Map<string, QuestItemAgg>();
    for (const r of itemRequirements) {
      if (completedSet.has(r.questId)) continue;
      const raw = mounted ? (itemProgress[r.questId]?.[r.objectiveId] ?? 0) : 0;
      const unitNeeded = r.stackAsOne ? 1 : r.count;
      const unitFound = r.stackAsOne ? (raw >= r.count ? 1 : 0) : Math.min(raw, r.count);
      const a = map.get(r.itemId) ?? { itemId: r.itemId, name: r.name, short: r.short, fir: false, needed: 0, found: 0, reqs: [] };
      a.needed += unitNeeded;
      a.found += unitFound;
      a.fir = a.fir || r.fir;
      a.reqs.push(r);
      map.set(r.itemId, a);
    }
    return [...map.values()];
  }, [itemRequirements, completedSet, itemProgress, mounted]);

  const questTotals = useMemo(() => {
    const items = questAgg.length;
    const done = questAgg.filter((a) => a.found >= a.needed).length;
    const unitsLeft = questAgg.reduce((n, a) => n + Math.max(0, a.needed - a.found), 0);
    return { items, done, unitsLeft };
  }, [questAgg]);

  // Топ-N незавершённых, ближайших к завершению (по % сбора).
  const questTop = useMemo(
    () =>
      questAgg
        .filter((a) => a.found < a.needed)
        .sort((a, b) => b.found / b.needed - a.found / a.needed || a.needed - b.needed)
        .slice(0, TOP_QUEST_ITEMS),
    [questAgg],
  );

  // ± на уровне предмета → конкретная objective: + в первую незаполненную, − из последней
  // ненулевой. stackAsOne (валюта/патроны) — бинарно: + кладёт весь стек, − обнуляет.
  const increment = (a: QuestItemAgg) => {
    const r = a.reqs.find((x) => (itemProgress[x.questId]?.[x.objectiveId] ?? 0) < x.count);
    if (r) setItemCount(r.questId, r.objectiveId, r.stackAsOne ? r.count : (itemProgress[r.questId]?.[r.objectiveId] ?? 0) + 1);
  };
  const decrement = (a: QuestItemAgg) => {
    const r = [...a.reqs].reverse().find((x) => (itemProgress[x.questId]?.[x.objectiveId] ?? 0) > 0);
    if (r) setItemCount(r.questId, r.objectiveId, r.stackAsOne ? 0 : (itemProgress[r.questId]?.[r.objectiveId] ?? 0) - 1);
  };

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Квесты: <span className="text-success">{questTotals.done}</span>
          <span className="text-text-muted"> / {questTotals.items} предметов</span>
          {' · осталось '}
          <span className="font-blender-medium text-text-primary/70">{questTotals.unitsLeft} шт.</span>
        </span>
        <div className="flex items-center gap-2">
          <ResetControl
            buttonLabel="СБРОС ПРЕДМЕТОВ"
            buttonTitle="Сбросить счётчики собранных предметов"
            modalTitle="Подтверждение сброса предметов"
            onConfirm={() => useQuestStore.setState({ itemProgress: {} })}
          >
            <p>Вы действительно хотите сбросить прогресс сбора предметов?</p>
            <p>
              Обнулятся <span className="text-zinc-100">счётчики собранных предметов</span> по всем
              заданиям. Выполненные задания, закреплённые и построенные уровни убежища не
              затрагиваются.
            </p>
            <p className="text-text-muted">Для залогиненных изменение синхронизируется с облаком</p>
          </ResetControl>
          <Link
            href="/eft/progress/needed"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-lines-hover px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Весь список
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Топ квестовых предметов ── */}
      <SectionLabel>Ближайшие к завершению</SectionLabel>

      {questTop.length > 0 ? (
        <div className="flex flex-col gap-2">
          {questTop.map((a) => {
            const pct = Math.round((a.found / a.needed) * 100);
            return (
              <div key={a.itemId} className="flex items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-3">
                <div className="h-10 w-10 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={itemIconUrl(a.itemId)} alt={a.name} loading="lazy" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="truncate font-blender-medium text-sm text-text-primary">{a.name}</span>
                    {a.fir && <FoundInRaidBadge className="shrink-0" />}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-xs bg-card-menu">
                    <div className="h-full rounded-xs bg-(--primary) transition-[width] duration-300" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="w-14 shrink-0 text-right font-blender-medium text-xs text-text-primary/70">
                  {a.found} / {a.needed}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Убавить"
                    onClick={() => decrement(a)}
                    disabled={a.found <= 0}
                    className="flex h-7 w-7 items-center justify-center rounded border border-lines-hover text-text-muted transition-colors hover:border-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Прибавить"
                    onClick={() => increment(a)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-lines-hover text-text-muted transition-colors hover:border-success hover:text-success"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-8 text-center">
          <PackageCheck className="h-6 w-6 text-success" />
          <p className="max-w-90 text-sm text-text-secondary">
            Все квестовые предметы собраны — либо активных требований нет. Отмечайте выполненные
            квесты на карте, чтобы список оставался актуальным.
          </p>
        </div>
      )}

    </div>
  );
}
