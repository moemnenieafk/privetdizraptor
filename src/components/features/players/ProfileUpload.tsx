"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileWarning } from "lucide-react";
import { parseProfile, normalizeProfile } from "@/lib/tarkov/player-stats";
import { ProfileStats } from "@/components/features/players/ProfileStats";
import { SyncPmcButton } from "@/components/features/players/SyncPmcButton";
import type { PlayerView } from "@/types/eft-player";

const MAX_BYTES = 5 * 1024 * 1024; // профиль ~30–100 КБ; 5 МБ с большим запасом

export function ProfileUpload() {
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
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
  }, []);

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

      {view && (
        <>
          <SyncPmcButton view={view} />
          <ProfileStats view={view} />
        </>
      )}
    </div>
  );
}
