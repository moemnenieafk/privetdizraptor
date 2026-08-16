'use client';

import { ROLE_LABELS, type PlayerRole } from '@/lib/role-inference';
import { ARCHETYPE_VISUALS } from '@/data/archetype-visuals';

// Бейдж архетипа-«класса»: ромб-эмблема (clip-path) с иконкой роли (.icon-mask → акцент),
// primary крупно + secondary мелко, confidence/reasons[] в тултип (прозрачность инференса,
// §3.4). Имена — ROLE_LABELS, визуал — ARCHETYPE_VISUALS. Пустой инференс → rookie «уточняется».

interface ArchetypeBadgeProps {
  primary: PlayerRole;
  secondary?: PlayerRole | null;
  /** 0..1 — уверенность инференса. */
  confidence?: number;
  /** Причины выбора роли (для тултипа). */
  reasons?: string[];
  /** Скрыть тултип-подсказку (напр. в плотных списках). */
  hideTooltip?: boolean;
  className?: string;
}

export function ArchetypeBadge({
  primary,
  secondary,
  confidence,
  reasons = [],
  hideTooltip = false,
  className = '',
}: ArchetypeBadgeProps) {
  const visual = ARCHETYPE_VISUALS[primary];
  const label = ROLE_LABELS[primary];
  const secondaryLabel = secondary ? ROLE_LABELS[secondary] : null;
  const pct = confidence != null ? Math.round(confidence * 100) : null;
  const uncertain = pct != null && pct < 25;

  return (
    <div className={`group/badge relative inline-flex items-center gap-3 ${className}`}>
      {/* Ромб-эмблема с иконкой роли */}
      <span
        className="relative flex size-11 shrink-0 items-center justify-center"
        style={{
          clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
          background: `color-mix(in srgb, ${visual.accent} 18%, transparent)`,
          border: `1px solid color-mix(in srgb, ${visual.accent} 55%, transparent)`,
        }}
      >
        <span
          className="icon-mask size-5"
          style={{
            backgroundColor: visual.accent,
            WebkitMaskImage: `url(${visual.iconClass})`,
            maskImage: `url(${visual.iconClass})`,
          }}
        />
      </span>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span
            className="truncate text-sm font-blender-medium uppercase tracking-widest"
            style={{ color: visual.accent }}
          >
            {label.name}
          </span>
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            {visual.tag}
          </span>
        </span>
        <span className="text-type-micro font-blender-book text-text-secondary">
          {secondaryLabel ? (
            <>
              также: <span className="text-text-primary">{secondaryLabel.name}</span>
            </>
          ) : uncertain ? (
            'уточняется по мере игры'
          ) : pct != null ? (
            <>
              уверенность <span className="tabular-nums text-text-primary">{pct}%</span>
            </>
          ) : (
            'архетип оперативника'
          )}
        </span>
      </div>

      {/* Тултип: confidence + reasons (прозрачность инференса) */}
      {!hideTooltip && (pct != null || reasons.length > 0) && (
        <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-60 opacity-0 transition-opacity duration-300 group-hover/badge:opacity-100">
          <div className="flex flex-col gap-1.5 rounded border border-lines-hover bg-card-menu p-3 shadow-lg">
            <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
              Почему {label.name}
            </span>
            {pct != null && (
              <span className="text-type-caption font-blender-book text-text-secondary">
                Уверенность:{' '}
                <span className="tabular-nums" style={{ color: visual.accent }}>
                  {pct}%
                </span>
              </span>
            )}
            {reasons.length > 0 && (
              <p className="text-type-caption font-blender-book leading-4 text-text-secondary">
                {reasons.join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
