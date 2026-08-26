"use client";

// Матрица «фича/раздел × тир» — иерархичная раскладка в стиле NIGHTFALL. Из HEADER_DICTIONARY
// строится дерево разделов (gate-tree.ts), плоский gates[] несёт эффективные min_tier/behavior/
// enabled и мёржится по ключу. Группы сворачиваемы; листья-гейты — tactical-card с иконкой,
// описанием и рядом контролов. Изменение контрола → PATCH /api/admin/gates (оптимистик + откат),
// после успеха сервер сбрасывает кеш-теги. Показывает эффективное значение (оверрайд ⊕ дефолт).
import { useMemo, useState } from "react";
import { ChevronDown, Lock, Sparkles } from "lucide-react";
import { buildGateTree, type GateTreeNode } from "./gate-tree";

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
  "rounded-xs border border-lines-hover bg-(--color-darkbase) px-2 py-1 font-blender-medium text-xs text-text-secondary outline-none focus:border-(--primary)";

// Паттерн иконки-маски (эталон SectionHubNav): tint bg-(--primary) поверх SVG-маски.
const MASK_BASE = {
  WebkitMaskSize: "contain" as const,
  WebkitMaskPosition: "center" as const,
  WebkitMaskRepeat: "no-repeat" as const,
  maskSize: "contain" as const,
  maskPosition: "center" as const,
  maskRepeat: "no-repeat" as const,
};

/** Иконка узла: SVG-маска (iconUrl) → монохром-класс (iconClass) → lucide-заглушка. */
function NodeIcon({ node, size }: { node: GateTreeNode; size: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-10.5 h-10.5" : "w-5 h-5";
  if (node.iconUrl) {
    return (
      <div
        aria-hidden="true"
        className={`${dim} shrink-0 bg-(--primary)`}
        style={{ WebkitMaskImage: `url(${node.iconUrl})`, maskImage: `url(${node.iconUrl})`, ...MASK_BASE }}
      />
    );
  }
  if (node.iconClass) {
    return <div aria-hidden="true" className={`${dim} shrink-0 bg-(--primary) icon-mask ${node.iconClass}`} />;
  }
  const Icon = node.lucideIcon === "Sparkles" ? Sparkles : Lock;
  return <Icon aria-hidden="true" className={`${dim} shrink-0 text-(--primary)`} strokeWidth={1.5} />;
}

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

  // Плоский gates[] → Map key→GateRow (эффективные значения). Дерево берёт из него меты не знает —
  // только структуру; значения контролов читаются отсюда на рендере карточки.
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  // Дерево групп: строится один раз из статичного HEADER_DICTIONARY. Набор ключей и лейблы фич
  // берём из ИСХОДНОГО gates (не rows) — структура/лейблы стабильны, меняются лишь значения.
  const tree = useMemo(() => {
    const keys = new Set(gates.map((g) => g.key));
    const labels = new Map(gates.map((g) => [g.key, g.label]));
    return buildGateTree(keys, labels);
  }, [gates]);

  // Открытые группы (по label). Первая группа («Функции») открыта по умолчанию.
  const [open, setOpen] = useState<Set<string>>(() => new Set(tree.length ? [tree[0].label] : []));
  const toggle = (label: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

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

  // Ряд контролов гейта (селект тира + behavior + тогл + индикаторы) — общий для карточки.
  function Controls({ row }: { row: GateRow }) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Минимальный тир"
          value={row.minTier}
          onChange={(e) => patch({ ...row, minTier: e.target.value })}
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
          value={row.behavior}
          onChange={(e) => patch({ ...row, behavior: e.target.value })}
          className={field}
        >
          {BEHAVIORS.map((b) => (
            <option key={b} value={b}>
              {BEHAVIOR_LABELS[b]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 font-blender-medium text-xs text-text-muted">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => patch({ ...row, enabled: e.target.checked })}
          />
          вкл
        </label>
        {savingKey === row.key && (
          <span className="h-4 w-4 animate-pulse rounded-xs bg-(--primary)" aria-hidden />
        )}
        {errorKey === row.key && (
          <span className="font-blender-medium text-xs text-danger">ошибка</span>
        )}
      </div>
    );
  }

  // Карточка-гейт (лист или узел-с-детьми, у которого есть свой ключ).
  function GateCard({ node }: { node: GateTreeNode }) {
    const row = node.key ? byKey.get(node.key) : undefined;
    if (!row) return null;
    return (
      <div className="bg-card-menu border border-lines-hover rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-(--color-darkbase)">
            <NodeIcon node={node} size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-blender-book text-sm text-text-primary leading-tight">{node.label}</div>
            {node.description && (
              <p className="mt-1 font-blender-book text-xs text-text-secondary line-clamp-2">
                {node.description}
              </p>
            )}
            <div className="mt-1 font-blender-medium text-xs text-white/25 break-all">{node.key}</div>
          </div>
        </div>
        <Controls row={row} />
      </div>
    );
  }

  // Рекурсивный рендер содержимого группы: листья → сетка карточек; узлы-с-детьми → под-заголовок
  // (метка-разделитель) + своя сетка. Глубина под-заголовков ограничена (depth≤2), глубже — плоско.
  function renderNodes(nodes: GateTreeNode[], depth: number): React.ReactNode {
    const leaves = nodes.filter((n) => n.children.length === 0);
    const branches = nodes.filter((n) => n.children.length > 0);
    return (
      <div className="flex flex-col gap-4">
        {leaves.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {leaves.map((n) => (
              <GateCard key={n.key ?? n.label} node={n} />
            ))}
          </div>
        )}
        {branches.map((branch) => (
          <div key={branch.key ?? branch.label} className="flex flex-col gap-3">
            {depth <= 2 && (
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                  {branch.label}
                </span>
                <div className="flex-1 h-px bg-lines-hover" />
              </div>
            )}
            {/* Свой гейт узла-с-детьми (если есть) — карточкой перед детьми. */}
            {branch.key && byKey.has(branch.key) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <GateCard node={branch} />
              </div>
            )}
            {renderNodes(branch.children, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  // Кол-во реальных гейтов под узлом (для счётчика в шапке группы).
  function countGates(node: GateTreeNode): number {
    let n = node.key && byKey.has(node.key) ? 1 : 0;
    for (const c of node.children) n += countGates(c);
    return n;
  }

  return (
    <div className="flex flex-col gap-4">
      {tree.map((group) => {
        const isOpen = open.has(group.label);
        const total = countGates(group);
        const groupRow = group.key ? byKey.get(group.key) : undefined;
        return (
          <div key={group.label} className="bg-card-menu border border-lines-hover rounded-lg flex flex-col">
            {/* Шапка группы: иконка + название + счётчик + (контролы «весь раздел») + шеврон. */}
            <div className="flex items-center gap-4 p-4">
              <button
                type="button"
                onClick={() => toggle(group.label)}
                aria-expanded={isOpen}
                className="flex flex-1 items-center gap-4 text-left"
              >
                <div className="w-14 h-14 shrink-0 flex items-center justify-center rounded-md bg-(--color-darkbase)">
                  <NodeIcon node={group} size="lg" />
                </div>
                <div className="flex flex-col">
                  <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
                    {group.label}
                  </span>
                  <span className="font-blender-medium text-xs text-text-muted">
                    {total} {total === 1 ? "гейт" : "гейтов"}
                  </span>
                </div>
                <ChevronDown
                  aria-hidden="true"
                  className={`ml-auto w-5 h-5 shrink-0 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                  strokeWidth={1.5}
                />
              </button>
            </div>
            {/* Контролы «весь раздел» (если у группы есть свой gate-ключ, напр. Карты=/eft/maps). */}
            {groupRow && (
              <div className="flex flex-wrap items-center gap-3 border-t border-lines-hover px-4 py-3">
                <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                  Весь раздел
                </span>
                <Controls row={groupRow} />
              </div>
            )}
            {isOpen && (
              <div className="border-t border-lines-hover p-4">
                {renderNodes(
                  // Свой gate группы уже показан контролами «весь раздел» — из детей его не дублируем.
                  group.children,
                  1,
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
