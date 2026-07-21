import type { ReactNode } from 'react';

/**
 * Заголовок секции по макету: иконка 16, подпись 16px Muted, линия на всю
 * оставшуюся ширину. Отличается от SectionPanel тем, что не рисует карточку —
 * блоки в колонках карточки предмета сидят прямо на фоне страницы.
 */
export function SectionRule({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <div className="flex h-4 items-center gap-3.5">
      {icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center text-text-muted">{icon}</span>}
      <span className="shrink-0 font-blender-medium text-base uppercase leading-none text-text-muted">
        {title}
      </span>
      <span className="h-px min-w-0 flex-1 bg-text-muted/40" />
    </div>
  );
}
