"use client";

// Карточка «Публичная страница» — opt-in тумблер для /u/[username]. Самодостаточна:
// сама тянет статус из /api/account/public-profile. Пока выключено — профиль анонимам
// не отдаётся (приватность соц-раздела). Включено — показываем ссылку для шэринга.
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Globe, Loader2 } from "lucide-react";

interface State {
  public: boolean;
  username: string | null;
}

export function PublicProfileCard() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/public-profile");
      if (res.ok) setState((await res.json()) as State);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async () => {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/public-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public: !state.public }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const url = state?.username ? `${typeof window !== "undefined" ? window.location.origin : ""}/u/${state.username}` : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Ссылка:", url);
    }
  };

  if (loading) {
    return <div className="h-28 w-full animate-pulse rounded-sm bg-card-menu" aria-hidden="true" />;
  }
  if (!state) return null;

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-(--primary)" aria-hidden="true" />
        <h3 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Публичная страница
        </h3>
      </div>

      <p className="font-blender-book text-xs leading-relaxed text-text-secondary">
        Включи, чтобы твой профиль был доступен по ссылке всем — с подтверждёнными ЧВК-профилями,
        анкетами и статой. Выключено — виден только тебе.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className={`flex h-11 w-fit items-center gap-2 rounded-xs border px-4 font-blender-medium text-xs uppercase tracking-widest transition-colors disabled:opacity-40 ${
          state.public
            ? "border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)"
            : "border-lines-hover text-text-secondary hover:border-(--primary) hover:text-(--primary)"
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {state.public ? "Профиль публичный — выключить" : "Сделать профиль публичным"}
      </button>

      {error && <p className="font-blender-book text-xs text-danger">{error}</p>}

      {state.public && url && (
        <div className="flex items-center gap-2">
          <span className="flex h-11 min-w-0 flex-1 items-center truncate rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 font-blender-book text-xs text-text-primary">
            {url}
          </span>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            aria-label="Скопировать ссылку"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  );
}
