"use client";

// Фаза 2 — тоггл трекинга достижения: «выполнено» ✓ + «отслеживаю» ☆.
// compact — угол плитки (внутри Link → stopPropagation); full — кнопки на детали.
// mounted-гард: до маунта показываем «не отмечено» (== SSR), после — реальное состояние
// стора (persist в браузере гидратируется синхронно, иначе был бы hydration mismatch).
import { useEffect, useState } from "react";
import { Check, Star } from "lucide-react";
import { useAchievementStore } from "@/store/useAchievementStore";

interface Props {
  id: string;
  variant?: "compact" | "full";
}

export function AchievementTrackToggle({ id, variant = "compact" }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const completed = useAchievementStore((s) => s.completedIds.includes(id));
  const tracked = useAchievementStore((s) => s.trackedIds.includes(id));
  const toggleCompleted = useAchievementStore((s) => s.toggleCompleted);
  const toggleTracked = useAchievementStore((s) => s.toggleTracked);

  const isCompleted = mounted && completed;
  const isTracked = mounted && tracked;

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (variant === "full") {
    return (
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            toggleCompleted(id);
          }}
          className={`flex h-10 items-center gap-2 rounded border px-4 text-type-label uppercase tracking-widest transition-colors ${
            isCompleted
              ? "border-success/60 bg-success/10 text-success"
              : "border-lines-hover text-text-secondary hover:border-(--primary) hover:text-text-primary"
          }`}
        >
          <Check className="h-4 w-4" />
          {isCompleted ? "Выполнено" : "Отметить выполненным"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            toggleTracked(id);
          }}
          className={`flex h-10 items-center gap-2 rounded border px-4 text-type-label uppercase tracking-widest transition-colors ${
            isTracked
              ? "border-(--primary)/60 bg-primary/10 text-(--primary)"
              : "border-lines-hover text-text-secondary hover:border-(--primary) hover:text-text-primary"
          }`}
        >
          <Star className={`h-4 w-4 ${isTracked ? "fill-current" : ""}`} />
          {isTracked ? "Отслеживается" : "Отслеживать"}
        </button>
      </div>
    );
  }

  // compact (шапка плитки) — только «выполнено»; «отслеживаю» — на детали.
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={isCompleted ? "Снять отметку «выполнено»" : "Отметить выполненным"}
      title={isCompleted ? "Выполнено" : "Отметить выполненным"}
      onClick={(e) => {
        stop(e);
        toggleCompleted(id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          stop(e);
          toggleCompleted(id);
        }
      }}
      className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
        isCompleted
          ? "border-success bg-success/15 text-success"
          : "border-text-primary/50 text-text-primary/50 hover:border-success hover:text-success"
      }`}
    >
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}
