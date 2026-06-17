"use client";

import { useState, useEffect } from "react";

interface TraderCountdownProps {
  traderName: string;
  resetTime: string;
}

function formatHMS(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

export function TraderCountdown({ traderName, resetTime }: TraderCountdownProps) {
  const [remaining, setRemaining] = useState(() => {
    const target = new Date(resetTime).getTime();
    return Math.max(0, target - Date.now());
  });

  useEffect(() => {
    const tick = () => {
      const target = new Date(resetTime).getTime();
      setRemaining(Math.max(0, target - Date.now()));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetTime]);

  const isUrgent = remaining < 60_000;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-blender-medium text-[9px] tracking-[0.3em] uppercase text-text-muted">
        {traderName.toUpperCase()}
      </span>
      <span
        className={`font-blender-medium text-xs tracking-widest tabular-nums ${
          isUrgent ? "text-danger animate-pulse" : "text-tactical-amber"
        }`}
      >
        {formatHMS(remaining)}
      </span>
    </div>
  );
}
