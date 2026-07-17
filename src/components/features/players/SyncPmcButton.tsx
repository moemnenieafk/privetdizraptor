"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Check } from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { playtime } from "@/lib/tarkov/player-stats";
import type { PlayerView } from "@/types/eft-player";

// Синхронизирует загруженный профиль в АКТИВНЫЙ облачный ЧВК-профиль ЦТА.
// Пишем только то, что достоверно есть в экспорте: ник, сторона, престиж, часы,
// рейды (PMC), выживаемость. level/mode/traderLevels не трогаем — их в файле нет.
export function SyncPmcButton({ view }: { view: PlayerView }) {
  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const updateProfile = usePlayerStore((s) => s.updateProfile);
  const [done, setDone] = useState(false);

  const active = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? profiles[0],
    [profiles, activeProfileId],
  );

  const pmc = view.raidStats.find((r) => r.side === "PMC");
  const faction: "BEAR" | "USEC" = view.side.toLowerCase() === "usec" ? "USEC" : "BEAR";
  const hours = playtime(view.totalTimeSeconds).hours;

  const sync = () => {
    if (!active || !pmc) return;
    updateProfile(active.id, {
      nickname: view.nickname,
      level: String(view.level),
      edition: view.edition,
      faction,
      prestige: String(view.prestige),
      hoursPlayed: hours,
      raids: pmc.raids,
      survivalRate: Number(pmc.survivalRate.toFixed(1)),
    });
    setDone(true);
    setTimeout(() => setDone(false), 4000);
  };

  if (!active || !pmc) return null;

  return (
    <div className="flex flex-col gap-2 border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] p-4">
      <p className="font-blender-book text-xs text-text-secondary">
        Синхронизировать в активный ЧВК-профиль{" "}
        <span className="font-blender-medium text-text-primary">«{active.nickname}»</span> ({active.mode}): ник,
        уровень, издание, сторону, престиж, часы, рейды и выживаемость.
      </p>
      <button
        type="button"
        onClick={sync}
        className={`flex h-10 items-center justify-center gap-2 border px-5 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
          done
            ? "border-(--color-success) text-(--color-success)"
            : "border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary) hover:opacity-80"
        }`}
      >
        {done ? (
          <>
            <Check className="h-4 w-4" />
            Профиль ЧВК обновлён
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            Обновить профиль ЧВК
          </>
        )}
      </button>
      {done && (
        <p className="font-blender-book text-xs text-text-secondary">
          Записано: {view.nickname} · ур. {view.level} · {hours} ч · {pmc.raids} рейдов ·{" "}
          {pmc.survivalRate.toFixed(1)}% выживаемость. Синхронизация с облаком — автоматически, если вы вошли в
          аккаунт.
        </p>
      )}
    </div>
  );
}
