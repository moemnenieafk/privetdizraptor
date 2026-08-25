"use client";

// Матрица «фича/раздел × тир»: на каждый gate-def строка с селектом min_tier,
// селектом behavior и тоглом enabled. Изменение → PATCH /api/admin/gates (оптимистик),
// после успеха сервер сбрасывает кеш-теги. Строки сгруппированы по category. Показывает
// эффективное значение (оверрайд из БД поверх дефолта реестра).
import { useMemo, useState } from "react";

export interface GateRow {
  key: string;
  label: string;
  category: string;
  minTier: string;
  behavior: string;
  enabled: boolean;
}

export interface TierOption {
  slug: string;
  name: string;
}

const BEHAVIORS = ["lock", "hide", "teaser"] as const;
const BEHAVIOR_LABELS: Record<string, string> = {
  lock: "Замок (апселл)",
  hide: "Спрятать",
  teaser: "Тизер",
};

const field =
  "rounded-xs border border-white/15 bg-white/5 px-2 py-1 font-blender-book text-xs outline-none focus:border-(--primary)";

export function GateMatrixClient({
  gates,
  tiers,
}: {
  gates: GateRow[];
  tiers: TierOption[];
}) {
  const [rows, setRows] = useState<GateRow[]>(gates);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, GateRow[]>();
    for (const r of rows) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return [...map.entries()];
  }, [rows]);

  async function patch(next: GateRow) {
    const prev = rows;
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

  return (
    <div className="flex flex-col gap-6">
      {grouped.map(([category, list]) => (
        <div key={category} className="flex flex-col gap-2">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            {category}
          </span>
          <div className="flex flex-col divide-y divide-white/5 border border-white/10">
            {list.map((r) => (
              <div
                key={r.key}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col">
                  <span className="font-blender-book text-sm text-text-primary">{r.label}</span>
                  <span className="font-blender-book text-xs text-white/30">{r.key}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Минимальный тир"
                    value={r.minTier}
                    onChange={(e) => patch({ ...r, minTier: e.target.value })}
                    className={field}
                  >
                    {tiers.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Поведение замка"
                    value={r.behavior}
                    onChange={(e) => patch({ ...r, behavior: e.target.value })}
                    className={field}
                  >
                    {BEHAVIORS.map((b) => (
                      <option key={b} value={b}>
                        {BEHAVIOR_LABELS[b]}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 font-blender-book text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => patch({ ...r, enabled: e.target.checked })}
                    />
                    вкл
                  </label>
                  {savingKey === r.key && (
                    <span className="h-4 w-4 animate-pulse rounded-xs bg-white/20" aria-hidden />
                  )}
                  {errorKey === r.key && (
                    <span className="font-blender-book text-xs text-danger">ошибка</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
