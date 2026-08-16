'use client';

import Link from 'next/link';
import { FEATURE_CATALOG, type PortalFeature } from '@/data/feature-catalog';
import { useFeedback } from '@/components/providers/FeedbackProvider';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { useXpStore } from '@/store/useXpStore';

// «Избранные разделы архетипа» (Figma 2868-5301): грид иконок слева + список названий справа.
// Заменяет карточки «Разделы архетипа» в Досье. Порядок ячеек И строк — из FEATURE_CATALOG;
// подсветка (амбер) — если фича входит в набор активного архетипа. Логика набора — в data (§4.7).

/** Куда ведёт заглушка для ещё не построенных фич (ready:false). */
const SOON_HREF = '/eft/soon';

export interface ArchetypeFeatureGridProps {
  /** id избранных фич активного архетипа (ARCHETYPE_FEATURES[role]) — задают подсветку. */
  featureIds: readonly string[];
}

/** Целевой маршрут ячейки: готовая → своя страница, будущая → общая заглушка «скоро». */
function hrefFor(feature: PortalFeature): string {
  return feature.ready ? feature.href : SOON_HREF;
}

/** Ячейка грида: квадрат 64px с иконкой-маской 22px по центру. Избранная — амбер.
 *  feedback-фича открывает модалку (button), остальные — навигация (Link). */
function FeatureCell({ feature, active, onFeedback, onUse }: { feature: PortalFeature; active: boolean; onFeedback: () => void; onUse: () => void }) {
  const cls = `group flex aspect-square size-16 items-center justify-center rounded-lg border transition-colors ${
    active
      ? 'border-tactical-amber bg-tactical-amber/10 hover:bg-tactical-amber/20'
      : 'border-lines-hover bg-card-menu hover:border-text-muted'
  }`;
  const icon = (
    <span
      className={`icon-mask size-5.5 transition-colors ${active ? 'bg-tactical-amber' : 'bg-text-muted group-hover:bg-text-secondary'}`}
      style={{
        WebkitMaskImage: `url(${feature.iconPath})`,
        maskImage: `url(${feature.iconPath})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
      aria-hidden
    />
  );

  if (feature.action === 'feedback') {
    return (
      <button type="button" onClick={onFeedback} title={feature.name} className={cls}>
        {icon}
      </button>
    );
  }
  return (
    <Link href={hrefFor(feature)} title={feature.name} className={cls} onClick={onUse}>
      {icon}
    </Link>
  );
}

/** Строка списка названий: избранная — амбер, прочая — вторичный текст.
 *  feedback-фича открывает модалку (button), остальные — навигация (Link). */
function FeatureRow({ feature, active, onFeedback, onUse }: { feature: PortalFeature; active: boolean; onFeedback: () => void; onUse: () => void }) {
  const cls = `flex items-center gap-2 text-type-micro font-blender-medium uppercase leading-none tracking-wide transition-colors ${
    active ? 'text-tactical-amber hover:opacity-80' : 'text-text-secondary hover:text-text-primary'
  }`;
  const inner = (
    <>
      <span className="truncate">{feature.name}</span>
      {!feature.ready && (
        <span className="shrink-0 text-type-micro tracking-widest text-text-muted">Скоро</span>
      )}
    </>
  );

  if (feature.action === 'feedback') {
    return (
      <button type="button" onClick={onFeedback} className={`${cls} text-left`}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={hrefFor(feature)} className={cls} onClick={onUse}>
      {inner}
    </Link>
  );
}

/**
 * Грид+лист избранных фич архетипа. featureIds — набор активного архетипа (подсветка);
 * рендер идёт по всему FEATURE_CATALOG в его порядке. Кликабельно всё: готовое → своя
 * страница (Link), будущее → /eft/soon.
 */
export function ArchetypeFeatureGrid({ featureIds }: ArchetypeFeatureGridProps) {
  const { openFeedback } = useFeedback();
  const onFeedback = () => openFeedback();
  const active = new Set(featureIds);
  const count = featureIds.length;

  // Запись XP клика по фиче: role — активный архетип профиля, множитель ×2 льётся в его под-трек.
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const role = useRoleStore((s) => effectiveRoleFor(s, activeId));
  const recordFeatureUse = useXpStore((s) => s.recordFeatureUse);
  const onUse = (id: string) => () => recordFeatureUse(id, role);

  return (
    <section className="flex flex-col gap-4">
      {/* Микро-заголовок с линией + динамический счётчик набора (§ rule-micro-labels). */}
      <div className="flex items-center gap-3">
        <h2 className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          Избранные разделы архетипа
        </h2>
        <div className="h-px flex-1 bg-lines-hover" />
        <span className="shrink-0 text-type-micro font-blender-medium tabular-nums tracking-widest text-tactical-amber">
          {count}
        </span>
      </div>

      {/* Слева грид иконок, справа список названий. На узких — список уходит под грид. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="grid shrink-0 self-start grid-cols-4 gap-2.5 sm:grid-cols-6">
          {FEATURE_CATALOG.map((feature) => (
            <FeatureCell key={feature.id} feature={feature} active={active.has(feature.id)} onFeedback={onFeedback} onUse={onUse(feature.id)} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-0.5">
          {FEATURE_CATALOG.map((feature) => (
            <FeatureRow key={feature.id} feature={feature} active={active.has(feature.id)} onFeedback={onFeedback} onUse={onUse(feature.id)} />
          ))}
        </div>
      </div>
    </section>
  );
}
