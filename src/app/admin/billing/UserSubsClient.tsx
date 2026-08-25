"use client";

// Ручное управление подписками юзеров: ввод username → выдать (tier+months) /
// продлить / снять (→free). → POST /api/admin/subscriptions (поверх setUserTier,
// пишет леджер). Текущий тир юзера здесь не читаем отдельным гет-эндпоинтом (его нет
// в зоне таска) — после действия показываем подтверждение, леджер ниже отражает запись.
import { useState } from "react";

export interface SubTierOption {
  slug: string;
  name: string;
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
            placeholder="никнейм"
            className={`${field} w-56`}
          />
        </label>
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
