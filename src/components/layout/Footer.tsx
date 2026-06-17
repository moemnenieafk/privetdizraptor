"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BUILD_VERSION = "v0.2.0-beta";

const NAV_LINKS: { href: string; path: string; label: string }[] = [
  { href: "/",                   path: "/hub/",                 label: "ЦТА ХАБ"       },
  { href: "/eft",                path: "/eft/",                 label: "EFT"            },
  { href: "/eft/items/weapons",  path: "/eft/items/weapons/",   label: "ОРУЖИЕ"         },
  { href: "/eft/items/ammo",     path: "/eft/items/ammo/",      label: "ПАТРОНЫ"        },
  { href: "/eft/barter",         path: "/eft/barter/",          label: "БАРТЕР"         },
  { href: "/eft/progress",       path: "/eft/progress/",        label: "ПРОГРЕСС"       },
  { href: "/eft/questmap",       path: "/eft/questmap/",        label: "КАРТА КВЕСТОВ"  },
];

type PingState = "idle" | "ok" | "err";

export default function Footer() {
  const [ping, setPing] = useState<number | null>(null);
  const [pingState, setPingState] = useState<PingState>("idle");

  useEffect(() => {
    const t0 = performance.now();
    fetch("https://api.tarkov.dev/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
      signal: AbortSignal.timeout(6000),
    })
      .then(() => {
        setPing(Math.round(performance.now() - t0));
        setPingState("ok");
      })
      .catch(() => setPingState("err"));
  }, []);

  const pingDot =
    pingState === "ok"  ? "bg-nvg-green" :
    pingState === "err" ? "bg-danger" :
                          "bg-text-muted animate-pulse";

  const pingLabel =
    pingState === "ok"  && ping !== null ? `${ping}ms` :
    pingState === "err" ? "ERR" :
                          "···";

  const pingText =
    pingState === "ok"  ? "text-nvg-green" :
    pingState === "err" ? "text-danger" :
                          "text-text-muted";

  return (
    <footer className="w-full border-t border-lines-hover bg-darkbase">

      {/* Top accent tape */}
      <div className="h-px w-full bg-(--primary) opacity-20" />

      <div className="max-w-480 mx-auto px-4 md:px-8 pt-7 pb-6">

        {/* ── Section label ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-px h-4 bg-(--primary) opacity-50" />
            <span className="font-blender-medium text-[9px] tracking-[0.4em] uppercase text-text-muted">
              ПОДСИСТЕМА // НАВИГАЦИЯ
            </span>
          </div>
          <span className="font-blender-medium text-[9px] tracking-[0.3em] uppercase text-text-muted opacity-50">
            BUILD {BUILD_VERSION}
          </span>
        </div>

        {/* ── Three-column grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">

          {/* COL 1 — filesystem nav */}
          <div className="sm:col-span-1 flex flex-col gap-1.5">
            {NAV_LINKS.map(({ href, path, label }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-baseline gap-1.5 transition-none"
              >
                <span className="font-blender-medium text-[10px] uppercase text-text-muted group-hover:text-(--primary) transition-none shrink-0">
                  &gt;
                </span>
                <span className="font-blender-medium text-[10px] tracking-[0.15em] uppercase text-text-secondary group-hover:text-(--primary) transition-none">
                  {path}
                </span>
                <span className="font-blender-medium text-[8px] tracking-[0.15em] uppercase text-text-muted hidden lg:block">
                  {label}
                </span>
              </Link>
            ))}
          </div>

          {/* COL 2 — diagnostics */}
          <div className="flex flex-col gap-3">
            <p className="font-blender-medium text-[9px] tracking-[0.35em] uppercase text-text-muted mb-1">
              ДИАГНОСТИКА
            </p>

            {/* API ping */}
            <div className="flex items-center gap-2">
              <span className={`shrink-0 w-1.5 h-1.5 ${pingDot}`} />
              <span className="font-blender-medium text-[10px] tracking-[0.2em] uppercase text-text-secondary">
                API.TARKOV.DEV
              </span>
              <span className={`font-blender-medium text-[10px] tabular-nums ${pingText}`}>
                {pingLabel}
              </span>
            </div>

            {/* Local sync */}
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-1.5 h-1.5 bg-tactical-amber" />
              <span className="font-blender-medium text-[10px] tracking-[0.2em] uppercase text-text-secondary">
                STORAGE
              </span>
              <span className="font-blender-medium text-[10px] tracking-[0.15em] uppercase text-tactical-amber">
                LOCAL
              </span>
            </div>

            {/* Runtime */}
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-1.5 h-1.5 bg-(--primary) opacity-50" />
              <span className="font-blender-medium text-[10px] tracking-[0.2em] uppercase text-text-secondary">
                CTA RUNTIME
              </span>
              <span className="font-blender-medium text-[10px] tracking-[0.15em] uppercase text-(--primary) opacity-70">
                {BUILD_VERSION}
              </span>
            </div>
          </div>

          {/* COL 3 — protocol / about */}
          <div className="flex flex-col gap-3">
            <p className="font-blender-medium text-[9px] tracking-[0.35em] uppercase text-text-muted mb-1">
              ПРОТОКОЛ
            </p>
            <p className="font-blender-medium text-[10px] tracking-[0.12em] uppercase text-text-secondary leading-5 max-w-52">
              ЦЕНТР ТАКТИЧЕСКОЙ АДАПТАЦИИ — ТАКТИЧЕСКИЙ ТЕРМИНАЛ ДЛЯ ХАРДКОРНЫХ ШУТЕРОВ
            </p>
            <p className="font-blender-medium text-[9px] tracking-[0.15em] uppercase text-text-muted leading-relaxed">
              ДАННЫЕ: TARKOV.DEV · CC BY-NC-SA<br />
              НЕ АФФИЛИРОВАНО С BSG
            </p>
            <div className="flex items-center gap-2 mt-1">
              <a
                href="https://github.com/V4DYATV"
                target="_blank"
                rel="noreferrer"
                className="font-blender-medium text-[9px] tracking-[0.25em] uppercase text-text-muted border border-lines-hover px-2.5 py-1 hover:border-(--primary) hover:text-(--primary) transition-none"
              >
                [ GITHUB ]
              </a>
              <a
                href="https://t.me/fullkamen"
                target="_blank"
                rel="noreferrer"
                className="font-blender-medium text-[9px] tracking-[0.25em] uppercase text-text-muted border border-lines-hover px-2.5 py-1 hover:border-(--primary) hover:text-(--primary) transition-none"
              >
                [ TG ]
              </a>
            </div>
          </div>

        </div>

        {/* ── Bottom copyright band ── */}
        <div className="border-t border-lines-hover pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="font-blender-medium text-[9px] tracking-[0.25em] uppercase text-text-muted opacity-50">
            © 2026 ЦТА · ЦЕНТР ТАКТИЧЕСКОЙ АДАПТАЦИИ · ВСЕ ПРАВА ЗАЩИЩЕНЫ
          </span>
          <span className="font-blender-medium text-[9px] tracking-[0.2em] uppercase text-text-muted opacity-30">
            {BUILD_VERSION} · NIGHTFALL DS
          </span>
        </div>

      </div>
    </footer>
  );
}
