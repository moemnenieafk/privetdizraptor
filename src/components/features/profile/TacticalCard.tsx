import type { ReactNode } from 'react';

// Обёртка-карточка досье с угловыми clip-засечками (срезанные углы + L-скобки), NIGHTFALL.
// Чистый презентационный компонент без состояния — можно рендерить и на сервере.
// Засечки: clip-path срезает 2 угла у подложки, псевдо-L-скобки рисуем углами border.

interface TacticalCardProps {
  children: ReactNode;
  /** Акцент рамки/скобок — токен var(--color-…). По умолчанию нейтральные линии. */
  accent?: string;
  /** Подсветить (активная карточка) — акцентная рамка + слабое свечение. */
  active?: boolean;
  className?: string;
  /** Метка-заголовок блока (text-type-micro) в левом верхнем углу. */
  label?: string;
}

// Срез 10px у левого-верхнего и правого-нижнего углов — «тактический» силуэт панели.
const CLIP =
  'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)';

export function TacticalCard({ children, accent, active = false, className = '', label }: TacticalCardProps) {
  const accentColor = accent ?? 'var(--color-lines-hover)';
  return (
    <div
      className={`relative bg-card-menu p-5 ${className}`}
      style={{
        clipPath: CLIP,
        border: `1px solid ${active ? accentColor : 'var(--color-lines-hover)'}`,
        boxShadow: active
          ? `0 0 16px color-mix(in srgb, ${accentColor} 22%, transparent)`
          : undefined,
      }}
    >
      {/* Угловые L-скобки (правый-верхний + левый-нижний, где нет среза) */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r border-t"
        style={{ borderColor: `color-mix(in srgb, ${accentColor} 60%, transparent)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b border-l"
        style={{ borderColor: `color-mix(in srgb, ${accentColor} 60%, transparent)` }}
      />
      {label && (
        <span className="mb-3 block text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
