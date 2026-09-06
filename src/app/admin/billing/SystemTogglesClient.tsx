"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/Switch";

/**
 * Системные переключатели портала (kind:'system'). Отдельный блок, а НЕ строка в матрице
 * доступа: у них нет порога и поведения замка, значение несёт только вкл/выкл.
 *
 * ⚠️ Семантика здесь ПРЯМАЯ («включено = работает»), тогда как у обычных гейтов
 * enabled=false означает «гейт снят, открыто всем». Поэтому системные ключи не гоняются
 * через requireTier — см. шапку src/data/gate-registry.ts.
 *
 * Переиспользует существующую ручку PATCH /api/admin/gates (она же сбрасывает кеш гейтинга),
 * поэтому изменение видно на сайте сразу, без деплоя.
 */

export interface SystemToggle {
  key: string;
  label: string;
  description?: string;
  enabled: boolean;
  minTier: string;
  behavior: string;
}

export function SystemTogglesClient({ toggles }: { toggles: SystemToggle[] }) {
  const [rows, setRows] = useState(toggles);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function toggle(row: SystemToggle) {
    const prev = rows;
    const next = { ...row, enabled: !row.enabled };
    setRows((rs) => rs.map((r) => (r.key === next.key ? next : r)));
    setSavingKey(next.key);
    setErrorKey(null);
    const res = await fetch("/api/admin/gates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature_key: next.key,
        min_tier: next.minTier,
        behavior: next.behavior,
        enabled: next.enabled,
      }),
    });
    setSavingKey(null);
    if (!res.ok) {
      setRows(prev); // откат оптимистика
      setErrorKey(next.key);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-start justify-between gap-4 rounded border border-lines-hover bg-card-menu px-5 py-4"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-blender-medium text-sm text-text-primary">{row.label}</span>
            {row.description && (
              <span className="font-blender-book text-xs leading-relaxed text-white/40">
                {row.description}
              </span>
            )}
            {errorKey === row.key && (
              <span className="font-blender-medium text-xs text-danger">
                Не сохранилось — попробуйте ещё раз.
              </span>
            )}
          </div>

          <Switch
            checked={row.enabled}
            onChange={() => toggle(row)}
            disabled={savingKey === row.key}
            label={row.label}
          />
        </div>
      ))}
    </div>
  );
}
