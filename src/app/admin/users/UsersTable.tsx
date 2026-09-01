"use client";

// Таблица игроков (/admin/users): поиск + построчное управление подпиской.
// Пишем через существующий POST /api/admin/subscriptions ({username,tier,months,action}).
// После успеха — router.refresh() перечитывает серверный список (свежие tier/срок).
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import type { AdminUserRow } from "@/db/admin-users";

interface TierOpt {
  slug: string;
  name: string;
}

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const roleLabel = (r: string): string => ROLE_LABELS[r as Role] ?? r;

export function UsersTable({ rows, tiers }: { rows: AdminUserRow[]; tiers: TierOpt[] }) {
  const router = useRouter();
  const paid = useMemo(() => tiers.filter((t) => t.slug !== "free"), [tiers]);
  const tierName = (slug: string) => tiers.find((t) => t.slug === slug)?.name ?? slug;

  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.username ?? "").toLowerCase().includes(s) || (r.email ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  return (
    <div className="flex flex-col gap-4">
      {/* Поиск */}
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по нику или email…"
          className="w-full rounded border border-lines-hover bg-(--color-base) py-2.5 pl-9 pr-3 font-blender-book text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-(--primary) focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-lines-hover bg-card-menu">
        {/* Заголовок таблицы (десктоп) */}
        <div className="hidden grid-cols-[1.6fr_1.8fr_0.9fr_1.1fr_0.9fr_auto] items-center gap-3 border-b border-lines-hover px-4 py-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted lg:grid">
          <span>Игрок</span>
          <span>Email</span>
          <span>Роль</span>
          <span>Подписка</span>
          <span>Регистрация</span>
          <span className="text-right">Действие</span>
        </div>

        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center font-blender-book text-sm text-text-muted">
            Ничего не найдено.
          </p>
        )}

        {filtered.map((u) => {
          const isPro = u.tier !== "free";
          const open = openId === u.id;
          return (
            <div key={u.id} className="border-b border-lines-hover last:border-b-0">
              <div className="grid grid-cols-1 items-center gap-3 px-4 py-3 lg:grid-cols-[1.6fr_1.8fr_0.9fr_1.1fr_0.9fr_auto]">
                {/* Игрок */}
                <div className="flex min-w-0 items-center gap-2.5">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded border border-lines-hover object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-lines-hover bg-(--color-base)">
                      <span className="h-4 w-4 icon-mask icon-account_profile_icon bg-text-muted" />
                    </span>
                  )}
                  <span className="truncate font-blender-medium text-sm text-text-primary">
                    {u.username ?? <span className="text-text-muted">(без ника)</span>}
                  </span>
                </div>
                {/* Email */}
                <span className="truncate font-blender-book text-xs text-text-secondary">{u.email ?? "—"}</span>
                {/* Роль */}
                <span>
                  <span
                    className={`inline-flex items-center rounded-xs border px-1.5 py-0.5 font-blender-medium text-type-micro uppercase leading-none tracking-widest ${
                      u.role === "admin"
                        ? "border-(--primary)/40 bg-(--primary)/10 text-(--primary)"
                        : u.role === "user"
                          ? "border-lines-hover text-text-muted"
                          : "border-text-secondary/40 text-text-secondary"
                    }`}
                  >
                    {roleLabel(u.role)}
                  </span>
                </span>
                {/* Подписка */}
                <span className="flex flex-wrap items-center gap-1.5">
                  {isPro ? (
                    <span className="flex items-center gap-1 rounded-xs border border-tactical-amber/30 bg-tactical-amber/10 px-1.5 py-0.5">
                      <span className="h-3.5 w-3.5 icon-mask icon-account_pro-subscribe-icon bg-tactical-amber" />
                      <span className="font-blender-medium text-type-micro uppercase leading-none tracking-wider text-tactical-amber">
                        {tierName(u.tier)}
                      </span>
                    </span>
                  ) : (
                    <span className="font-blender-book text-xs text-text-muted">Free</span>
                  )}
                  {isPro && (
                    <span className="font-blender-book text-type-caption text-text-muted">
                      {u.validUntil ? `до ${fmtDate(u.validUntil)}` : "бессрочно"}
                    </span>
                  )}
                </span>
                {/* Регистрация */}
                <span className="font-blender-book text-xs text-text-muted">{fmtDate(u.createdAt)}</span>
                {/* Действие */}
                <div className="flex justify-start lg:justify-end">
                  <button
                    type="button"
                    disabled={!u.username}
                    onClick={() => setOpenId(open ? null : u.id)}
                    title={u.username ? "Управление подпиской" : "У игрока нет ника — управление недоступно"}
                    className="flex items-center gap-1 rounded-xs border border-lines-hover px-2.5 py-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Подписка <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {open && u.username && (
                <SubEditor
                  username={u.username}
                  currentTier={u.tier}
                  paid={paid}
                  onDone={() => {
                    setOpenId(null);
                    router.refresh();
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Инлайн-редактор подписки одной строки. POST /api/admin/subscriptions.
function SubEditor({
  username,
  currentTier,
  paid,
  onDone,
}: {
  username: string;
  currentTier: string;
  paid: TierOpt[];
  onDone: () => void;
}) {
  const [tier, setTier] = useState(currentTier !== "free" ? currentTier : (paid[0]?.slug ?? ""));
  const [months, setMonths] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Защита от случайного клика: первый клик «взводит» действие, второй — исполняет.
  const [pending, setPending] = useState<null | "grant" | "extend" | "revoke">(null);

  // Клик по действию: 1-й раз — взвести подтверждение, 2-й раз (то же действие) — выполнить.
  function arm(action: "grant" | "extend" | "revoke") {
    if (pending === action) {
      setPending(null);
      void submit(action);
    } else {
      setErr(null);
      setPending(action);
    }
  }

  async function submit(action: "grant" | "extend" | "revoke") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          tier: action === "revoke" ? "free" : tier,
          months: action === "revoke" ? 0 : Number(months) || 0,
          action,
        }),
      });
      if (!res.ok) {
        const d: unknown = await res.json().catch(() => null);
        setErr((d as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setErr("Ошибка сети");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-lines-hover bg-(--color-base)/40 px-4 py-3">
      <label className="flex flex-col gap-1">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">Тир</span>
        <select
          value={tier}
          onChange={(e) => {
            setTier(e.target.value);
            setPending(null);
          }}
          className="rounded border border-lines-hover bg-(--color-base) px-2 py-1.5 font-blender-book text-sm text-text-primary focus:border-(--primary) focus:outline-none"
        >
          {paid.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">Месяцев</span>
        <input
          type="number"
          min={1}
          value={months}
          onChange={(e) => {
            setMonths(e.target.value);
            setPending(null);
          }}
          className="w-20 rounded border border-lines-hover bg-(--color-base) px-2 py-1.5 font-blender-book text-sm text-text-primary focus:border-(--primary) focus:outline-none"
        />
      </label>
      <button
        type="button"
        disabled={busy || !tier}
        onClick={() => arm("grant")}
        className={`rounded-xs border px-3 py-2 font-blender-medium text-type-caption uppercase tracking-widest transition-colors disabled:opacity-40 ${
          pending === "grant"
            ? "border-(--primary) bg-(--primary)/25 text-(--primary)"
            : "border-(--primary) bg-(--primary)/10 text-(--primary) hover:bg-(--primary)/20"
        }`}
      >
        {pending === "grant" ? "Подтвердить?" : "Выдать"}
      </button>
      <button
        type="button"
        disabled={busy || !tier}
        onClick={() => arm("extend")}
        className={`rounded-xs border px-3 py-2 font-blender-medium text-type-caption uppercase tracking-widest transition-colors disabled:opacity-40 ${
          pending === "extend"
            ? "border-(--primary) bg-(--primary)/25 text-(--primary)"
            : "border-lines-hover text-text-secondary hover:border-(--primary) hover:text-(--primary)"
        }`}
      >
        {pending === "extend" ? "Подтвердить?" : "Продлить"}
      </button>
      <button
        type="button"
        disabled={busy || currentTier === "free"}
        onClick={() => arm("revoke")}
        className={`rounded-xs border px-3 py-2 font-blender-medium text-type-caption uppercase tracking-widest text-danger transition-colors disabled:opacity-40 ${
          pending === "revoke" ? "border-danger bg-danger/20" : "border-danger/40 hover:bg-danger/10"
        }`}
      >
        {pending === "revoke" ? "Подтвердить?" : "Снять"}
      </button>
      {pending && !busy && (
        <button
          type="button"
          onClick={() => setPending(null)}
          className="font-blender-book text-xs text-text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-text-secondary"
        >
          отмена
        </button>
      )}
      {err && <span className="font-blender-book text-xs text-danger">{err}</span>}
      {busy && <span className="font-blender-book text-xs text-text-muted">…</span>}
    </div>
  );
}
