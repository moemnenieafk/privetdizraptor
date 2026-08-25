"use client";

// Редактор тиров: список в порядке rank, инлайн-правка name/price/rank/perks/archived,
// создание нового тира, удаление (кнопка скрыта для free и тиров с записями в леджере —
// сервер всё равно проверит). free помечен «защищён» и его нельзя удалить/сделать платным.
// → /api/admin/tiers (POST/PATCH/DELETE). После мутации — router.refresh (сервер сбросил кеш).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Trash2, Archive } from "lucide-react";

export interface EditableTier {
  slug: string;
  name: string;
  price: number;
  rank: number;
  archived: boolean;
  perks: string[] | null;
  protected: boolean;
  hasLedgerRefs: boolean;
}

const field =
  "rounded-xs border border-white/15 bg-white/5 px-2 py-1 font-blender-book text-xs outline-none focus:border-(--primary)";
const label = "font-blender-medium text-xs uppercase tracking-widest text-white/50";
const btn =
  "rounded-xs border border-(--primary) px-3 py-1 font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-40";

export function TierEditorClient({ tiers }: { tiers: EditableTier[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Форма нового тира.
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("0");
  const [newRank, setNewRank] = useState("1");

  async function send(
    method: "POST" | "PATCH" | "DELETE",
    payload: Record<string, unknown> | string,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    const url =
      method === "DELETE" ? `/api/admin/tiers?slug=${encodeURIComponent(payload as string)}` : "/api/admin/tiers";
    const res = await fetch(url, {
      method,
      headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const data: unknown = await res.json().catch(() => null);
      const msg =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Ошибка запроса";
      setError(msg);
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveTier(t: EditableTier, patch: Partial<EditableTier>) {
    const merged = { ...t, ...patch };
    await send("PATCH", {
      slug: merged.slug,
      name: merged.name,
      price: merged.price,
      rank: merged.rank,
      archived: merged.archived,
      perks: merged.perks,
    });
  }

  async function createTier(e: React.FormEvent) {
    e.preventDefault();
    const ok = await send("POST", {
      slug: newSlug.trim(),
      name: newName.trim(),
      price: Number(newPrice) || 0,
      rank: Number(newRank) || 0,
    });
    if (ok) {
      setNewSlug("");
      setNewName("");
      setNewPrice("0");
      setNewRank("1");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="font-blender-book text-xs text-danger">{error}</p>}

      <div className="flex flex-col divide-y divide-white/5 border border-white/10">
        {tiers.map((t) => (
          <TierRow key={t.slug} tier={t} busy={busy} onSave={saveTier} onDelete={(slug) => send("DELETE", slug)} />
        ))}
      </div>

      <form onSubmit={createTier} className="flex flex-col gap-3 border border-white/10 px-4 py-4">
        <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          Новый тир
        </span>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className={label}>slug</span>
            <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} required className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Название</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Цена ₽</span>
            <input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className={`${field} w-24`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Ранг</span>
            <input
              type="number"
              value={newRank}
              onChange={(e) => setNewRank(e.target.value)}
              className={`${field} w-20`}
            />
          </label>
          <button type="submit" disabled={busy} className={`${btn} self-end`}>
            Создать
          </button>
        </div>
      </form>
    </div>
  );
}

function TierRow({
  tier,
  busy,
  onSave,
  onDelete,
}: {
  tier: EditableTier;
  busy: boolean;
  onSave: (t: EditableTier, patch: Partial<EditableTier>) => void;
  onDelete: (slug: string) => void;
}) {
  const [name, setName] = useState(tier.name);
  const [price, setPrice] = useState(tier.price.toString());
  const [rank, setRank] = useState(tier.rank.toString());
  const [perks, setPerks] = useState((tier.perks ?? []).join("\n"));

  const canDelete = !tier.protected && !tier.hasLedgerRefs;
  const perksArr = perks
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <span className="flex items-center gap-1 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
            {tier.slug}
            {tier.protected && <Lock className="h-3 w-3" aria-label="защищён" />}
            {tier.archived && <Archive className="h-3 w-3 text-white/40" aria-label="архивирован" />}
          </span>
          {tier.hasLedgerRefs && (
            <span className="font-blender-book text-xs text-white/30">есть записи в леджере</span>
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className={label}>Название</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Цена ₽</span>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={tier.protected}
            className={`${field} w-24 disabled:opacity-40`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Ранг</span>
          <input
            type="number"
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            disabled={tier.protected}
            className={`${field} w-20 disabled:opacity-40`}
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onSave(tier, {
                name,
                price: Number(price) || 0,
                rank: Number(rank) || 0,
                perks: perksArr.length > 0 ? perksArr : null,
              })
            }
            className={btn}
          >
            Сохранить
          </button>
          {!tier.protected && !tier.archived && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave(tier, { archived: true })}
              className="rounded-xs border border-white/20 px-3 py-1 font-blender-medium text-xs uppercase tracking-widest text-white/60 disabled:opacity-40"
            >
              Архивировать
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(tier.slug)}
              className="flex items-center gap-1 rounded-xs border border-danger/40 px-3 py-1 font-blender-medium text-xs uppercase tracking-widest text-danger disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
              Удалить
            </button>
          )}
        </div>
      </div>
      <label className="flex flex-col gap-1">
        <span className={label}>Перки (по строке)</span>
        <textarea
          value={perks}
          onChange={(e) => setPerks(e.target.value)}
          rows={2}
          className={`${field} max-w-xl`}
        />
      </label>
    </div>
  );
}
