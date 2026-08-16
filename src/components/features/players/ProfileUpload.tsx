"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileWarning, Check } from "lucide-react";
import { parseProfile, normalizeProfile } from "@/lib/tarkov/player-stats";
import { parseGameProfile } from "@/lib/parse-profile";
import { usePlayerStore } from "@/store/usePlayerStore";
import { ProfileStats } from "@/components/features/players/ProfileStats";
import { SyncPmcButton } from "@/components/features/players/SyncPmcButton";
import type { PlayerView } from "@/types/eft-player";

const MAX_BYTES = 5 * 1024 * 1024; // профиль ~30–100 КБ; 5 МБ с большим запасом

export function ProfileUpload() {
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncedNick, setSyncedNick] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Активный профиль ЧВК — загрузка файла ПИШЕТ EFT-идентичность прямо в него (плуминг).
  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const updateProfile = usePlayerStore((s) => s.updateProfile);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setSyncedNick(null);
      if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
        setError("Нужен .json-файл профиля.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Файл слишком большой — это точно profile.json?");
        return;
      }
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        setError("Не удалось прочитать JSON — файл повреждён или это не он.");
        return;
      }
      const profile = parseProfile(data);
      if (!profile) {
        setError("Это не похоже на profile.json (нет полей aid/info/nickname).");
        return;
      }
      setView(normalizeProfile(profile));

      // Плуминг: плоский разбор → апсерт EFT-идентичности в активный профиль ЧВК.
      // Пишем только достоверно прочитанное; null/отсутствующее не затирает существующее.
      const parsed = parseGameProfile(data);
      const active = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
      if (parsed && active) {
        const faction: "BEAR" | "USEC" = parsed.side.toLowerCase() === "usec" ? "USEC" : "BEAR";
        updateProfile(active.id, {
          nickname: parsed.nickname,
          faction,
          ...(parsed.level != null ? { level: String(parsed.level) } : {}),
          ...(parsed.prestige != null ? { prestige: String(parsed.prestige) } : {}),
          ...(parsed.memberCategory != null ? { memberCategory: parsed.memberCategory } : {}),
          ...(parsed.pmcStats.raids != null ? { raids: parsed.pmcStats.raids } : {}),
          ...(parsed.pmcStats.survivalRate != null ? { survivalRate: parsed.pmcStats.survivalRate } : {}),
          ...(parsed.pmcStats.hoursPlayed != null ? { hoursPlayed: parsed.pmcStats.hoursPlayed } : {}),
          ...(parsed.pmcStats.kills != null ? { kills: parsed.pmcStats.kills } : {}),
          ...(parsed.pmcStats.deaths != null ? { deaths: parsed.pmcStats.deaths } : {}),
          ...(parsed.pmcStats.killed != null ? { killed: parsed.pmcStats.killed } : {}),
          ...(parsed.pmcStats.survived != null ? { survived: parsed.pmcStats.survived } : {}),
          ...(parsed.pmcStats.kd != null ? { kd: parsed.pmcStats.kd } : {}),
        });
        setSyncedNick(active.nickname);
      }
    },
    [profiles, activeProfileId, updateProfile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]" : "border-lines-hover bg-card-menu hover:border-(--primary)"
        }`}
      >
        <Upload className="h-6 w-6 text-(--primary)" />
        <p className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Загрузить profile.json
        </p>
        <p className="max-w-md font-blender-book text-xs text-text-secondary">
          Перетащи сюда файл или нажми для выбора. Файл обрабатывается прямо в браузере и никуда не отправляется.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="flex items-center gap-2 border border-(--color-danger)/40 bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-4 py-3 font-blender-book text-sm text-(--color-danger)">
          <FileWarning className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {syncedNick && !error && (
        <p className="flex items-center gap-2 border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-4 py-3 font-blender-book text-sm text-text-secondary">
          <Check className="h-4 w-4 shrink-0 text-(--primary)" />
          Профиль загружен в активный ЧВК{" "}
          <span className="font-blender-medium text-text-primary">«{syncedNick}»</span>.
        </p>
      )}

      {view && (
        <>
          <SyncPmcButton view={view} />
          <ProfileStats view={view} />
        </>
      )}
    </div>
  );
}
