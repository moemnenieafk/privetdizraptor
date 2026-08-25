"use client";

// Ручное управление подписками юзеров: ввод username → выдать (tier+months) /
// продлить / снять (→free). → POST /api/admin/subscriptions (поверх setUserTier,
// пишет леджер). Текущее состояние читаем GET /api/admin/subscriptions?username=…
// (при поиске и после каждого действия) и показываем блоком «Текущий статус».
import { useCallback, useState } from "react";

export interface SubTierOption {
  slug: string;
  name: string;
}

interface CurrentSub {
  tier: string;
  validUntil: string | null;
  source: string;
}
// Форма ответа GET: не найден → { found:false }; найден → user + subscription.
type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "notFound" }
  | { kind: "found"; username: string; sub: CurrentSub }
  | { kind: "error"; text: string };

function fmtValidUntil(iso: string | null): string {
  if (iso === null) return "бессрочно";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "бессрочно";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

const field =
  "rounded-xs border border-white/15 bg-white/5 px-3 py-2 font-blender-book text-sm outline-none focus:border-(--primary)";
const label = "font-blender-medium text-xs uppercase tracking-widest text-white/50";
const btn =
  "rounded-xs border border-(--primary) px-4 py-2 font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-40";

type Msg = { kind: "ok" | "err"; text: string } | null;

export function UserSubsClient({ tiers }: { tiers: SubTierOption[] }) {
  const paid = tiers.filter((t) => t.slug !== "free");
  const [username, setUsername] = useState("");
  const [tier, setTier] = useState(paid[0]?.slug ?? "operative");
  const [months, setMonths] = useState("1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });

  const tierName = useCallback(
    (slug: string) => tiers.find((t) => t.slug === slug)?.name ?? slug,
    [tiers],
  );

  // Читает текущее состояние подписки по username (кнопка «Найти» / Enter / после действия).
  const lookupSub = useCallback(async (login: string) => {
    const name = login.trim();
    if (!name) {
      setLookup({ kind: "idle" });
      return;
    }
    setLookup({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/admin/subscriptions?username=${encodeURIComponent(name)}`,
      );
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || data === null || typeof data !== "object") {
        setLookup({ kind: "error", text: "Ошибка запроса" });
        return;
      }
      const d = data as { found?: unknown; subscription?: unknown };
      if (d.found !== true) {
        setLookup({ kind: "notFound" });
        return;
      }
      const s = d.subscription as Partial<CurrentSub> | undefined;
      setLookup({
        kind: "found",
        username: name,
        sub: {
          tier: typeof s?.tier === "string" ? s.tier : "free",
          validUntil: typeof s?.validUntil === "string" ? s.validUntil : null,
          source: typeof s?.source === "string" ? s.source : "manual",
        },
      });
    } catch {
      setLookup({ kind: "error", text: "Ошибка запроса" });
    }
  }, []);

  async function submit(action: "grant" | "extend" | "revoke") {
    if (!username.trim()) {
      setMsg({ kind: "err", text: "Укажите username" });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        tier: action === "revoke" ? "free" : tier,
        months: action === "revoke" ? 0 : Number(months) || 0,
        action,
      }),
    });
    setBusy(false);
    if (res.ok) {
      const verb = action === "revoke" ? "снят тир" : action === "extend" ? "продлён" : "выдан тир";
      setMsg({ kind: "ok", text: `Готово: ${verb} для @${username.trim()}` });
      void lookupSub(username); // обновить отображение текущего статуса
    } else {
      const data: unknown = await res.json().catch(() => null);
      const text =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Ошибка запроса";
      setMsg({ kind: "err", text });
    }
  }

  return (
    <div className="flex flex-col gap-4 border border-white/10 px-4 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={label}>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void lookupSub(username);
              }
            }}
            placeholder="никнейм"
            className={`${field} w-56`}
          />
        </label>
        <button type="button" onClick={() => void lookupSub(username)} className={btn}>
          Найти
        </button>
        <label className="flex flex-col gap-1">
          <span className={label}>Тир</span>
          <select value={tier} onChange={(e) => setTier(e.target.value)} className={field}>
            {paid.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Месяцев (0 = бессрочно)</span>
          <input
            type="number"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className={`${field} w-32`}
          />
        </label>
      </div>
      {lookup.kind === "loading" && (
        <div className="flex flex-col gap-2 border border-white/10 px-3 py-3">
          <div className="h-3 w-32 animate-pulse rounded-xs bg-white/10" />
          <div className="h-4 w-64 animate-pulse rounded-xs bg-white/10" />
        </div>
      )}
      {lookup.kind === "notFound" && (
        <p className="font-blender-book text-sm text-danger">Пользователь не найден</p>
      )}
      {lookup.kind === "error" && (
        <p className="font-blender-book text-sm text-danger">{lookup.text}</p>
      )}
      {lookup.kind === "found" && (
        <div className="flex flex-col gap-1 border border-white/10 px-3 py-3">
          <span className={label}>Текущий статус</span>
          <p className="font-blender-book text-sm text-text-secondary">
            Тир <span className="text-(--primary)">{tierName(lookup.sub.tier)}</span>, действует
            до <span className="text-(--primary)">{fmtValidUntil(lookup.sub.validUntil)}</span>,
            источник <span className="text-(--primary)">{lookup.sub.source}</span>
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => submit("grant")} className={btn}>
          Выдать
        </button>
        <button type="button" disabled={busy} onClick={() => submit("extend")} className={btn}>
          Продлить
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("revoke")}
          className="rounded-xs border border-danger/40 px-4 py-2 font-blender-medium text-xs uppercase tracking-widest text-danger disabled:opacity-40"
        >
          Снять (→ free)
        </button>
      </div>
      {msg && (
        <p
          className={`font-blender-book text-sm ${msg.kind === "ok" ? "text-(--primary)" : "text-danger"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
