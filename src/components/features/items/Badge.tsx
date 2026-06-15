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
    blue: "text-blue-400",
    gray: "text-text-secondary",
    red: "text-red-400",
    emerald: "text-emerald-400",
    amber: "text-amber-500",
    purple: "text-purple-400",
  };

  return (
    <div
      title={title}
      className={`flex items-center justify-center gap-1 rounded px-1.5 py-0.5 whitespace-nowrap ${colorStyles[color]} ${className || ''}`}
    >
      {iconClass && <span className={`${iconSizeClass || 'w-3 h-3'} shrink-0 bg-current mask-contain mask-no-repeat mask-center ${iconClass}`} />}
      <span className={`font-blender-medium text-[12px] ${isStrike ? "opacity-50 line-through" : ""}`}>
        {label}
      </span>
    </div>
  );
};