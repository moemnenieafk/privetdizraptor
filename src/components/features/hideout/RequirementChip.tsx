'use client';

// Переиспользуемый nvg-green чип требования (единообразие с /modules — HideoutBuildTracker).
// Три состояния тона (met=зелёный+✓ / not-met=амбер / null=нейтральный «неизвестно»),
// иконка 28px (`h-7 w-7`), текст `text-type-micro`, без обводки. Стиль зеркалит заинлайненные
// бейджи требований HideoutBuildTracker — вынесен сюда, чтобы карточка рецепта их не дублировала.
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface RequirementChipProps {
  /** Готовая нода иконки (напр. skill-иконка). Приоритет над `iconClass`/`imgSrc`. */
  iconNode?: ReactNode;
  /** Класс маски-иконки (напр. `stationIconClass(nn)`) — красится в тон состояния. */
  iconClass?: string;
  /** Растровая иконка 28px (напр. трейдер) — рисуется как есть, тон не наследует. */
  imgSrc?: string;
  label: string;
  /** true=выполнено (зелёный+✓) · false=не добрано (амбер) · null=неизвестно (нейтральный). */
  met: boolean | null;
  title?: string;
}

export function RequirementChip({ iconNode, iconClass, imgSrc, label, met, title }: RequirementChipProps) {
  const tone =
    met === true
      ? 'bg-nvg-green/10 text-nvg-green'
      : met === false
        ? 'bg-tactical-amber/10 text-tactical-amber'
        : 'bg-card-menu/40 text-text-secondary';
  const iconTone = met === true ? 'bg-nvg-green' : met === false ? 'bg-tactical-amber' : 'bg-text-secondary';

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-blender-medium text-type-micro uppercase tracking-wide ${tone}`}
    >
      {iconNode ? (
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center">
          {iconNode}
        </span>
      ) : imgSrc ? (
        <img src={imgSrc} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded-xs object-cover" />
      ) : iconClass ? (
        <span aria-hidden className={`h-7 w-7 shrink-0 icon-mask ${iconClass} ${iconTone}`} />
      ) : null}
      {label}
      {met === true && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />}
    </span>
  );
}
