"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, X, LayoutGrid, List, Eye, EyeOff, Check, ChevronDown } from "lucide-react";
import {
  type AchievementView,
  rarityMeta,
  sideLabel,
  RARITY_RANK,
} from "@/lib/achievement-visuals";
import { achievementIconUrl, ACHIEVEMENT_ICON_FALLBACK } from "@/lib/achievement-icon";
import { useAchievementStore } from "@/store/useAchievementStore";
import { AchievementTrackToggle } from "@/components/features/achievements/AchievementTrackToggle";
import { AchievementResetControl } from "@/components/features/achievements/AchievementResetControl";

interface AchievementsClientProps {
  initialData: AchievementView[];
}

type RarityFilter = "any" | "legendary" | "rare" | "common";
type SideFilter = "any" | "pmc" | "scavs" | "all";
type Visibility = "all" | "visible" | "hidden";
type SortOrder = "tier" | "rarest" | "common";

function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src.endsWith(ACHIEVEMENT_ICON_FALLBACK)) return;
  img.src = ACHIEVEMENT_ICON_FALLBACK;
}

const RARITY_OPTS: readonly { key: RarityFilter; label: string }[] = [
  { key: "any", label: "Редкость: все" },
  { key: "legendary", label: "Легендарное" },
  { key: "rare", label: "Редкое" },
  { key: "common", label: "Обычное" },
];
const SIDE_OPTS: readonly { key: SideFilter; label: string }[] = [
  { key: "any", label: "Фракция: все" },
  { key: "pmc", label: "ЧВК" },
  { key: "scavs", label: "Дикие" },
  { key: "all", label: "Общие" },
];
const VIS_OPTS: readonly { key: Visibility; label: string }[] = [
  { key: "all", label: "Все типы" },
  { key: "visible", label: "Открытые" },
  { key: "hidden", label: "Скрытые" },
];
const SORT_OPTS: readonly { key: SortOrder; label: string }[] = [
  { key: "tier", label: "По редкости" },
  { key: "rarest", label: "Сначала редчайшие" },
  { key: "common", label: "Сначала частые" },
];

// Кастомный дропдаун в стиле CategoryControlBar раздела «Предметы» (плоский, без коробки).
function FilterDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { key: T; label: string }[];
  onChange: (key: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = options.find((o) => o.key === value) ?? options[0];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 bg-transparent px-3 font-blender-medium text-type-caption uppercase tracking-wider text-zinc-400 transition-colors duration-200 hover:text-zinc-200"
      >
        <span className="whitespace-nowrap">{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded border border-lines-hover bg-card-menu py-1 shadow-lg">
          {options.map((opt) => {
            const isSelected = opt.key === value;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 font-blender-medium text-type-caption uppercase tracking-wider transition-colors duration-150 ${
                  isSelected ? "text-(--primary)" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                <span className="whitespace-nowrap">{opt.label}</span>
                {isSelected && <Check className="ml-auto h-3 w-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AchievementsClient({ initialData }: AchievementsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("any");
  const [sideFilter, setSideFilter] = useState<SideFilter>("any");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("tier");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  // «Зажать глазик» — раскрыть скрытое достижение на карточке, пока удерживаешь.
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  // mounted-гард: трекинг из localStorage применяем только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const completedIds = useAchievementStore((s) => s.completedIds);
  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);
  const completedCount = mounted ? completedIds.length : 0;

  const processed = useMemo(() => {
    let data = [...initialData];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q),
      );
    }
    if (rarityFilter !== "any") data = data.filter((a) => a.normalizedRarity === rarityFilter);
    if (sideFilter !== "any") data = data.filter((a) => a.normalizedSide === sideFilter);
    if (visibility === "visible") data = data.filter((a) => !a.hidden);
    if (visibility === "hidden") data = data.filter((a) => a.hidden);
    if (mounted && hideCompleted) data = data.filter((a) => !completedSet.has(a.id));

    data.sort((a, b) => {
      if (sortOrder === "tier") {
        const ra = RARITY_RANK[a.normalizedRarity] ?? 9;
        const rb = RARITY_RANK[b.normalizedRarity] ?? 9;
        if (ra !== rb) return ra - rb;
        return a.playersCompletedPercent - b.playersCompletedPercent;
      }
      const pa = a.playersCompletedPercent;
      const pb = b.playersCompletedPercent;
      return sortOrder === "rarest" ? pa - pb : pb - pa;
    });

    return data;
  }, [initialData, searchQuery, rarityFilter, sideFilter, visibility, sortOrder, mounted, hideCompleted, completedSet]);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* ── Панель фильтров (стиль раздела «Предметы») ── */}
      <div className="flex w-full flex-wrap items-center gap-2 py-3">
        {/* Поиск — тянется на всё свободное место */}
        <div className="relative flex h-10 min-w-36 flex-1 items-center rounded border border-lines-hover bg-(--color-base) px-3 transition-colors focus-within:border-(--primary)">
          <Search className="mr-2 h-4 w-4 shrink-0 text-text-muted" />
          <input
            type="text"
            placeholder="ФИЛЬТР ДОСТИЖЕНИЙ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent font-blender-medium text-xs uppercase tracking-wider text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="ml-2 shrink-0 text-text-muted hover:text-(--primary)"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <FilterDropdown value={rarityFilter} options={RARITY_OPTS} onChange={setRarityFilter} />
        <FilterDropdown value={sideFilter} options={SIDE_OPTS} onChange={setSideFilter} />
        <FilterDropdown value={visibility} options={VIS_OPTS} onChange={setVisibility} />

        <div className="h-6 w-px shrink-0 bg-lines-hover" />

        <FilterDropdown value={sortOrder} options={SORT_OPTS} onChange={setSortOrder} />

        {/* Скрыть выполненные */}
        <button
          type="button"
          onClick={() => setHideCompleted((v) => !v)}
          title="Скрыть выполненные"
          aria-pressed={hideCompleted}
          className={`flex h-10 shrink-0 items-center gap-1.5 bg-transparent px-3 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-200 ${
            hideCompleted ? "text-success" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Check className="h-4 w-4 shrink-0" />
          <span className="hidden md:block">Скрыть</span>
        </button>

        <div className="h-6 w-px shrink-0 bg-lines-hover" />

        {/* Переключатель вида */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex h-11 w-11 lg:h-8 lg:w-8 items-center justify-center bg-transparent transition-colors duration-200 ${
              viewMode === "grid" ? "text-(--primary)" : "text-zinc-500 hover:text-zinc-300"
            }`}
            title="Сетка"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`flex h-11 w-11 lg:h-8 lg:w-8 items-center justify-center bg-transparent transition-colors duration-200 ${
              viewMode === "table" ? "text-(--primary)" : "text-zinc-500 hover:text-zinc-300"
            }`}
            title="Список"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Счётчик ── */}
      <div className="flex items-center justify-between px-1">
        <span className="text-type-caption uppercase tracking-widest text-text-muted">
          Достижений: <span className="font-blender-medium text-text-secondary">{processed.length}</span> из {initialData.length}
          {completedCount > 0 && (
            <>
              {" · выполнено "}
              <span className="font-blender-medium text-success">{completedCount}</span>
            </>
          )}
        </span>
        <AchievementResetControl />
      </div>

      {processed.length === 0 ? (
        <div className="rounded-lg border border-lines-hover bg-card-menu/40 p-12 text-center text-sm text-text-muted">
          Ничего не найдено — измените фильтры или запрос.
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {processed.map((a) => {
            const r = rarityMeta(a.normalizedRarity);
            const revealed = a.hidden && revealedId === a.id;
            return (
              <Link
                key={a.id}
                href={`/eft/progress/achievements/${a.id}`}
                className={`group relative flex gap-4 overflow-hidden rounded-lg border bg-card-menu p-4 transition-all duration-300 hover:border-(--primary) hover:shadow-[0_6px_28px_rgba(0,0,0,0.45)] ${r.borderClass}`}
              >
                {r.tintClass && <div className={`pointer-events-none absolute inset-0 ${r.tintClass}`} />}

                <div className="relative z-10 h-20 w-20 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={achievementIconUrl(a.id)}
                    alt={a.hidden ? "Скрытое достижение" : a.name}
                    loading="lazy"
                    onError={onImgError}
                    className={`h-full w-full object-contain transition-transform duration-300 group-hover:scale-110 ${a.hidden && !revealed ? "blur-[2px]" : ""}`}
                  />
                </div>

                <div className="relative z-10 flex min-w-0 flex-1 flex-col">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3
                      className={`truncate font-blender-medium text-base uppercase leading-tight text-text-primary transition-colors group-hover:text-(--primary) ${
                        a.hidden && !revealed ? "select-none blur-[3px]" : ""
                      }`}
                    >
                      {a.name}
                    </h3>
                    <div className="flex shrink-0 items-center gap-1">
                    {a.hidden && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Удерживайте, чтобы показать скрытое достижение"
                        title="Удерживайте, чтобы показать"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setRevealedId(a.id);
                        }}
                        onPointerUp={() => setRevealedId(null)}
                        onPointerCancel={() => setRevealedId(null)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            setRevealedId(a.id);
                          }
                        }}
                        onKeyUp={(e) => {
                          if (e.key === " " || e.key === "Enter") setRevealedId(null);
                        }}
                        className="-mr-1 mt-0.5 shrink-0 cursor-pointer touch-none select-none rounded p-1 text-text-primary/50 transition-colors hover:text-text-primary"
                      >
                        {revealed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </span>
                    )}
                      <AchievementTrackToggle id={a.id} variant="compact" />
                    </div>
                  </div>

                  <p className={`line-clamp-2 text-sm text-text-secondary ${a.hidden && !revealed ? "select-none blur-[3px]" : ""}`}>
                    {a.description}
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className={`inline-flex items-center rounded-xs px-1.5 py-0.5 text-type-micro uppercase tracking-widest ${r.badgeClass}`}>
                      {r.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-xs border border-text-primary/25 px-1.5 py-0.5 text-type-micro uppercase tracking-widest text-text-primary/70">
                        {sideLabel(a.normalizedSide)}
                      </span>
                      <span className="font-blender-medium text-type-micro text-text-primary/70">
                        {a.playersCompletedPercent.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-lines-hover bg-card-menu/20">
          <table className="w-full text-sm">
            <thead className="bg-card-menu/50">
              <tr>
                <th scope="col" className="w-16 px-4 py-3 text-center text-type-caption uppercase tracking-widest text-text-muted">
                  Иконка
                </th>
                <th scope="col" className="px-4 py-3 text-left text-type-caption uppercase tracking-widest text-text-muted">
                  Название
                </th>
                <th scope="col" className="hidden px-4 py-3 text-left text-type-caption uppercase tracking-widest text-text-muted md:table-cell">
                  Описание
                </th>
                <th scope="col" className="w-20 px-4 py-3 text-center text-type-caption uppercase tracking-widest text-text-muted">
                  Фракция
                </th>
                <th scope="col" className="w-32 px-4 py-3 text-right text-type-caption uppercase tracking-widest text-text-muted">
                  Редкость
                </th>
              </tr>
            </thead>
            <tbody>
              {processed.map((a) => {
                const r = rarityMeta(a.normalizedRarity);
                return (
                  <tr key={a.id} className="border-b border-lines-hover transition-colors last:border-b-0 hover:bg-card-menu/40">
                    <td className="px-4 py-3">
                      <Link href={`/eft/progress/achievements/${a.id}`} className="mx-auto block h-10 w-10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={achievementIconUrl(a.id)}
                          alt=""
                          loading="lazy"
                          onError={onImgError}
                          className={`h-full w-full object-contain ${a.hidden ? "blur-[2px]" : ""}`}
                        />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/eft/progress/achievements/${a.id}`}
                        className={`flex items-center gap-2 font-blender-medium text-text-primary hover:text-(--primary) ${a.hidden ? "select-none blur-[3px]" : ""}`}
                      >
                        {a.name}
                        {a.hidden && <EyeOff className="h-3 w-3 shrink-0 text-text-primary/50" />}
                      </Link>
                    </td>
                    <td className={`hidden px-4 py-3 text-text-secondary md:table-cell ${a.hidden ? "select-none blur-[3px]" : ""}`}>
                      {a.description}
                    </td>
                    <td className="px-4 py-3 text-center text-type-micro uppercase tracking-widest text-text-primary/70">
                      {sideLabel(a.normalizedSide)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-blender-medium text-type-micro ${r.textClass}`}>{a.playersCompletedPercent.toFixed(1)}%</span>
                        <span className={`text-type-micro uppercase tracking-widest ${r.textClass}`}>{r.label}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
