export type BadgeColor = "blue" | "gray" | "red" | "emerald" | "amber" | "purple";

export interface BadgeProps {
  color: BadgeColor;
  label: string;
  title?: string;
  isStrike?: boolean;
  iconClass?: string;
  iconSizeClass?: string;
  className?: string;
}

export function getArmorClassColor(armorClass: number | string): BadgeColor {
  const ac = Number(armorClass);
  if (ac <= 2) return "gray";     // Common
  if (ac <= 4) return "blue";     // Rare
  if (ac === 5) return "purple";  // Epic
  if (ac >= 6) return "amber";    // Legendary
  return "gray";
}

export const Badge = ({ color, label, title, isStrike, iconClass, iconSizeClass, className }: BadgeProps) => {
  const colorStyles = {
    blue: "border-blue-500/30 bg-blue-900/40 text-blue-400",
    gray: "border-lines-hover bg-card-menu text-text-secondary",
    red: "border-red-500/30 bg-red-900/40 text-red-400",
    emerald: "border-emerald-500/30 bg-emerald-900/40 text-emerald-400",
    amber: "border-amber-500/30 bg-amber-900/40 text-amber-500",
    purple: "border-purple-500/30 bg-purple-900/40 text-purple-400",
  };

  return (
    <div
      title={title}
      className={`flex items-center justify-center gap-1 rounded border px-1.5 py-0.5 whitespace-nowrap ${colorStyles[color]} ${className || ''}`}
    >
      {iconClass && <span className={`${iconSizeClass || 'w-3 h-3'} shrink-0 bg-current [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center] ${iconClass}`} />}
      <span className={`font-mono text-[10px] font-bold ${isStrike ? "opacity-50 line-through" : ""}`}>
        {label}
      </span>
    </div>
  );
};