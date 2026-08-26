'use client';

import { HighlightedText } from '@/components/ui/HighlightedText';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import type { MapQuestLite } from './map-frame-types';

/**
 * Строка квеста для карты (один приём отображения, один источник правды стиля).
 * Переиспользуется левым drawer «Поиск на локации» (MapSearchDrawer) и карточкой квест-маркера
 * (EditorialMarkerCard, таск 02): трейдер-тинт рамка + радиальный градиент, аватар 16px, имя,
 * чип «ур. N+», бейджи Каппа/Смотритель. Клик зовёт onSelect(id) — деталь рисует общая панель.
 */
export function QuestRow({
  q,
  query,
  active,
  onSelect,
}: {
  q: MapQuestLite;
  query?: string;
  active?: boolean;
  onSelect: (id: string) => void;
}) {
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
        <span className="font-blender-medium text-[0.625rem] uppercase text-text-secondary">ур. {q.minPlayerLevel}+</span>
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
