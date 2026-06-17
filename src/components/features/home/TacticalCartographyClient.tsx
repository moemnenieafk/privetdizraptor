"use client";

import { useState } from "react";
import Link from "next/link";
import type { CartographyTask, CartographyMap } from "@/actions/tarkov-cartography";

interface TacticalCartographyClientProps {
  tasks: CartographyTask[];
  maps: CartographyMap[];
}

export function TacticalCartographyClient({ tasks, maps }: TacticalCartographyClientProps) {
  const [hoveredTask, setHoveredTask] = useState<CartographyTask | null>(null);

  const tasksOnHoveredMap = hoveredTask
    ? tasks.filter((t) => t.mapNormalizedName === hoveredTask.mapNormalizedName)
    : [];

  const hoveredMap = hoveredTask
    ? maps.find((m) => m.normalizedName === hoveredTask.mapNormalizedName)
    : null;

  return (
    <section className="w-full px-4 md:px-8 pb-16">
      {/* Section heading */}
      <div className="flex items-center justify-center w-full gap-4 md:gap-7 mb-2">
        <div className="hidden md:block h-px flex-1 max-w-40 lg:max-w-87 bg-linear-to-l from-lines-hover to-transparent" />
        <h3 className="font-blender-medium uppercase tracking-widest text-text-primary shrink-0 text-xl sm:text-2xl md:text-3xl lg:text-[32px]">
          ТАКТИЧЕСКАЯ КАРТОГРАФИЯ
        </h3>
        <div className="hidden md:block h-px flex-1 max-w-40 lg:max-w-87 bg-linear-to-r from-lines-hover to-transparent" />
      </div>
      <p className="text-center font-blender-medium text-[10px] tracking-[0.3em] uppercase text-text-muted mb-8">
        // КВЕСТЫ КАППА · МАРШРУТИЗАЦИЯ РЕЙДА
      </p>

      {/* Split layout */}
      <div className="max-w-480 mx-auto border border-lines-hover flex flex-col lg:flex-row">
        {/* LEFT — task list */}
        <div className="lg:w-[45%] shrink-0 border-b lg:border-b-0 lg:border-r border-lines-hover">
          <div className="px-3 py-2 border-b border-lines-hover bg-lines-hover/30">
            <p className="font-blender-medium text-[9px] tracking-[0.3em] uppercase text-text-muted">
              АКТИВНЫЕ ЗАДАНИЯ // КАППА ТРЕКЕР
            </p>
          </div>

          <div className="divide-y divide-lines-hover">
            {tasks.length === 0 ? (
              <SkeletonTaskList />
            ) : (
              tasks.map((task) => (
                <button
                  key={task.id}
                  className={`w-full text-left px-3 py-3 group transition-none ${
                    hoveredTask?.id === task.id
                      ? "bg-(--primary)/5 border-l-2 border-l-(--primary)"
                      : "border-l-2 border-l-transparent hover:bg-lines-hover/40"
                  }`}
                  onMouseEnter={() => setHoveredTask(task)}
                  onMouseLeave={() => setHoveredTask(null)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`font-blender-medium text-[11px] uppercase tracking-wide leading-tight ${
                        hoveredTask?.id === task.id ? "text-(--primary)" : "text-text-primary group-hover:text-(--primary)"
                      } transition-none`}
                    >
                      {task.name}
                    </p>
                    <span className="font-blender-medium text-[9px] tracking-[0.15em] uppercase text-(--primary)/70 border border-(--primary)/30 px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                      {task.mapName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1">
                      <img
                        src={`/images/traders/eft/${task.traderNormalizedName}.webp`}
                        alt={task.traderName}
                        width={14}
                        height={14}
                        className="w-3.5 h-3.5 object-cover grayscale opacity-50"
                      />
                      <span className="font-blender-medium text-[9px] tracking-[0.2em] uppercase text-text-muted">
                        {task.traderName}
                      </span>
                    </span>
                    <span className="font-blender-medium text-[9px] text-text-secondary tabular-nums">
                      {task.experience.toLocaleString("ru-RU")} XP
                    </span>
                  </div>


                  {task.primaryObjective && (
                    <p className="font-blender-medium text-[9px] text-text-muted mt-1 line-clamp-1 leading-tight">
                      › {task.primaryObjective}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT — map context */}
        <div className="lg:flex-1 flex flex-col">
          <div className="px-3 py-2 border-b border-lines-hover bg-lines-hover/30">
            <p className="font-blender-medium text-[9px] tracking-[0.3em] uppercase text-text-muted">
              КОНТЕКСТ ЛОКАЦИИ
            </p>
          </div>

          {hoveredTask ? (
            <div className="flex-1 p-5 flex flex-col gap-4">
              {/* Map name */}
              <div>
                <div className="w-px h-8 bg-(--primary) opacity-40 mb-3" />
                <h4 className="font-blender-medium text-2xl md:text-3xl uppercase tracking-widest text-text-primary leading-none">
                  {hoveredTask.mapName}
                </h4>
                <p className="font-blender-medium text-[10px] tracking-[0.3em] uppercase text-text-muted mt-1">
                  // {hoveredTask.mapNormalizedName}
                </p>
              </div>

              {/* Tasks on this map */}
              <div>
                <p className="font-blender-medium text-[9px] tracking-[0.25em] uppercase text-text-muted mb-2">
                  ЗАДАНИЯ НА ЛОКАЦИИ · {tasksOnHoveredMap.length}
                </p>
                <div className="flex flex-col gap-1.5">
                  {tasksOnHoveredMap.map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 shrink-0 ${t.id === hoveredTask.id ? "bg-(--primary)" : "bg-lines-hover"}`} />
                      <p
                        className={`font-blender-medium text-[10px] uppercase tracking-wide ${
                          t.id === hoveredTask.id ? "text-(--primary)" : "text-text-secondary"
                        }`}
                      >
                        {t.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href="/eft/questmap"
                className="self-start font-blender-medium text-[9px] tracking-[0.2em] uppercase text-text-muted border border-lines-hover px-3 py-1.5 hover:border-(--primary)/50 hover:text-(--primary) transition-none"
              >
                [ КАРТА КВЕСТОВ ]
              </Link>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-px h-12 bg-lines-hover mb-4" />
              <p className="font-blender-medium text-[9px] tracking-[0.4em] uppercase text-text-muted">
                НАВЕДИТЕ НА ЗАДАНИЕ
              </p>
              <p className="font-blender-medium text-[9px] tracking-[0.3em] uppercase text-lines-hover mt-1">
                ДЛЯ КОНТЕКСТА ЛОКАЦИИ
              </p>
              <div className="w-px h-12 bg-lines-hover mt-4" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="max-w-480 mx-auto mt-px border-x border-b border-lines-hover flex items-center justify-between px-4 py-2.5">
        <p className="font-blender-medium text-[9px] tracking-[0.25em] uppercase text-text-muted">
          {tasks.length > 0 ? `ПОКАЗАНО ${tasks.length} ИЗ ВСЕХ КАППА КВЕСТОВ` : "ЗАГРУЗКА ДАННЫХ..."}
        </p>
        <Link
          href="/eft/questmap"
          className="font-blender-medium text-[10px] tracking-[0.25em] uppercase text-(--primary) hover:text-text-primary transition-none flex items-center gap-1.5"
        >
          ПОЛНАЯ КАРТА КВЕСТОВ <span className="text-text-muted">→</span>
        </Link>
      </div>
    </section>
  );
}

function SkeletonTaskList() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-3 py-3 border-l-2 border-l-transparent">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="h-3 bg-lines-hover animate-pulse w-32" />
            <div className="h-4 bg-lines-hover animate-pulse w-16" />
          </div>
          <div className="h-2.5 bg-lines-hover animate-pulse w-20" />
        </div>
      ))}
    </>
  );
}
