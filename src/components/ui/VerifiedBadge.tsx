// Бейдж «ЧВК-профиль подтверждён» — тупой атом (без клиентского стейта).
// icon — компактная галочка (в шапке карточки рядом с ником); chip — пилюля с
// подписью (в кабинете/на странице профиля). Цвет — акцент проекта.
import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  variant?: "icon" | "chip";
  /** Подпись в chip-варианте. По умолчанию «Подтверждён». */
  label?: string;
  /** tooltip — например подтверждённый ЧВК-ник. */
  title?: string;
  className?: string;
}

export function VerifiedBadge({
  variant = "icon",
  label = "Подтверждён",
  title = "ЧВК-профиль подтверждён модерацией ЦТА",
  className = "",
}: VerifiedBadgeProps) {
  if (variant === "chip") {
    return (
      <span
        title={title}
        className={`flex shrink-0 items-center gap-1.5 rounded-xs border border-(--primary)/50 bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-2 py-1 font-blender-medium text-xs uppercase tracking-widest text-(--primary) ${className}`}
      >
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <span title={title} aria-label={title} className={`inline-flex ${className}`}>
      <BadgeCheck className="h-4 w-4 shrink-0 text-(--primary)" aria-hidden="true" />
    </span>
  );
}
