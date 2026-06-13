import React from "react";

export type RarityTier = "Common" | "Rare" | "Epic" | "Legendary";

interface RarityBadgeProps {
  rarity: RarityTier;
  label?: string;
  className?: string;
}

const RARITY_CONFIG: Record<RarityTier, { label: string; classes: string }> = {
  Common: {
    label: "Обычное",
    classes: "text-gray-300 bg-gray-900/40 border-gray-500/30",
  },
  Rare: {
    label: "Редкое",
    classes: "text-blue-400 bg-blue-900/40 border-blue-500/30",
  },
  Epic: {
    label: "Эпическое",
    classes: "text-purple-400 bg-purple-900/40 border-purple-500/30",
  },
  Legendary: {
    label: "Легендарное",
    classes: "text-yellow-500 bg-yellow-900/40 border-yellow-500/30",
  },
};

export function RarityBadge({ rarity, label, className = "" }: RarityBadgeProps) {
  const config = RARITY_CONFIG[rarity] || RARITY_CONFIG.Common;

  return (
    <span
      className={`inline-flex items-center justify-center rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest ${config.classes} ${className}`}
    >
      {label || config.label}
    </span>
  );
}