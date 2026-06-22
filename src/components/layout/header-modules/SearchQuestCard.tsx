"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { traderImg, traderCssVar } from "@/lib/trader-utils";
import { itemIconUrl } from "@/lib/item-icon";
import type { QuestSearchResult } from "@/types/search";

interface SearchQuestCardProps {
  item: QuestSearchResult;
  isSelected: boolean;
  onSelect: () => void;
}

export const SearchQuestCard = ({ item, isSelected, onSelect }: SearchQuestCardProps) => {
  const nn = item.trader.normalizedName;
  const traderColor = `var(${traderCssVar(nn)})`;
  const avatar = item.id.startsWith("story-")
    ? `/icons/eft/02-quests/${item.id}.svg`
    : traderImg(nn);

  return (
    <Link
      href={`/eft/questmap?quest=${item.id}`}
      onClick={onSelect}
      style={
        {
          "--tc": traderColor,
          boxShadow: isSelected
            ? `0 0 12px color-mix(in srgb, ${traderColor} 25%, transparent)`
            : undefined,
        } as CSSProperties
      }
      className={`group/quest relative flex items-center overflow-hidden rounded-md border px-3 py-2 transition-colors hover:border-(--tc) ${
        isSelected ? "border-(--tc)" : "border-lines-hover"
      }`}
    >
      {/* Подложка + радиальный градиент торговца */}
      <div aria-hidden className="absolute inset-0 z-0 bg-black/20" />
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 18%, transparent), transparent 70%)`,
        }}
      />

      <div className="relative z-10 flex w-full items-center gap-3">
        {/* Аватар торговца / иконка стори-квеста */}
        <img
          src={avatar}
          alt={item.trader.name}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-xs object-cover"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />

        {/* Торговец + название квеста */}
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary">
            {item.trader.name}
          </span>
          <span className="truncate font-blender-medium text-sm text-text-primary">
            {item.name}
          </span>
        </div>

        {/* Правый блок: уровень + предметы + бейджи */}
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          {item.minPlayerLevel > 0 && (
            <span className="shrink-0 font-blender-medium text-xs text-text-secondary">
              УР. {item.minPlayerLevel}+
            </span>
          )}

          {item.items.length > 0 && (
            <div className="flex items-center gap-1">
              {item.items.map((qi) => (
                <div
                  key={qi.id}
                  className="relative h-7 w-7 shrink-0"
                  title={`${qi.shortName}${qi.count > 1 ? ` ×${qi.count}` : ""}`}
                >
                  <div className="absolute inset-0 overflow-hidden rounded-xs border border-lines-hover">
                    <div className="absolute inset-0 bg-(--color-darkbase)" />
                    <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />
                    <img
                      src={itemIconUrl(qi.id)}
                      alt={qi.shortName}
                      width={28}
                      height={28}
                      className="absolute inset-0 z-10 h-full w-full object-contain p-0.5"
                      onError={(e) => {
                        const t = e.currentTarget;
                        if (!t.dataset.tried) {
                          t.dataset.tried = "1";
                          t.src = qi.image512pxLink || "/images/placeholder.webp";
                        } else {
                          t.src = "/images/placeholder.webp";
                        }
                      }}
                    />
                  </div>
                  {qi.count > 1 && (
                    <span className="absolute -bottom-0.5 -right-0.5 z-20 rounded-xs bg-black/70 px-0.5 text-type-micro font-blender-medium leading-none text-text-primary">
                      {qi.count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {item.lightkeeperRequired && (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs"
              style={{ background: "color-mix(in srgb, var(--trader-lightkeeper) 10%, transparent)" }}
              title="Требуется для Смотрителя"
            >
              <span className="icon-bg icon-eft-profile-lightkeeper h-4 w-4" />
            </span>
          )}
          {item.kappaRequired && (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs"
              style={{ background: "color-mix(in srgb, var(--color-nvg-green) 10%, transparent)" }}
              title="Требуется для Каппы"
            >
              <span className="icon-bg icon-eft-profile-kappa h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};
