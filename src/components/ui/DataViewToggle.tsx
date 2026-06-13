import React from "react";
import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "grid" | "table";

interface DataViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
  className?: string;
}

export function DataViewToggle({ view, onChange, className = "" }: DataViewToggleProps) {
  const baseButtonClasses = "flex items-center justify-center rounded p-1.5 transition-all duration-300 ease-out hover:scale-105 active:scale-95";
  const activeClasses = "bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary) shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_40%,transparent)]";
  const inactiveClasses = "text-text-muted hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)] hover:text-text-primary";

  return (
    <div className={`inline-flex items-center gap-1 rounded border border-lines-hover bg-(--color-base) p-1 ${className}`}>
      <button
        onClick={() => onChange("grid")}
        className={`${baseButtonClasses} ${view === "grid" ? activeClasses : inactiveClasses}`}
        aria-label="Плиточное отображение"
        aria-pressed={view === "grid"}
      >
        <span title="Плитка">
          <LayoutGrid className="h-4 w-4" />
        </span>
      </button>
      <button
        onClick={() => onChange("table")}
        className={`${baseButtonClasses} ${view === "table" ? activeClasses : inactiveClasses}`}
        aria-label="Табличное отображение"
        aria-pressed={view === "table"}
      >
        <span title="Таблица">
          <List className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}