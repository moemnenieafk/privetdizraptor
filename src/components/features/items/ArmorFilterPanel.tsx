"use client";

import { type ArmorFilterState } from "./ItemsFilterPanel";

interface ArmorFilterPanelProps {
  filters: ArmorFilterState;
  onChange: (filters: ArmorFilterState) => void;
  isVisible: boolean;
}

const SLIDER_CLASS =
  "h-1 w-full cursor-pointer appearance-none rounded bg-lines-hover [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-(--primary) [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125";

export function ArmorFilterPanel({ filters, onChange, isVisible }: ArmorFilterPanelProps) {
  return (
    <div
      className={`grid transition-all duration-300 ease-out ${
        isVisible ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <div className="flex flex-col gap-4 border-t border-lines-hover pt-4 md:flex-row md:items-center">
          <div className="flex w-full items-center gap-6 md:w-auto">
            <div className="flex w-full flex-col gap-2 md:w-32">
              <span className="font-mono text-[10px] text-text-muted">Мин: {filters.minClass}</span>
              <input
                type="range"
                min="1"
                max="6"
                value={filters.minClass}
                onChange={(e) =>
                  onChange({ ...filters, minClass: Math.min(Number(e.target.value), filters.maxClass) })
                }
                className={SLIDER_CLASS}
              />
            </div>
            <div className="flex w-full flex-col gap-2 md:w-32">
              <span className="font-mono text-[10px] text-text-muted">Макс: {filters.maxClass}</span>
              <input
                type="range"
                min="1"
                max="6"
                value={filters.maxClass}
                onChange={(e) =>
                  onChange({ ...filters, maxClass: Math.max(Number(e.target.value), filters.minClass) })
                }
                className={SLIDER_CLASS}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
