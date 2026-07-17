"use client";

import { useCallback, useRef, useState } from "react";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { Turnstile } from "@/components/ui/Turnstile";
import { PLAYER_NAME_CHARSET_RE, isValidPlayerName } from "@/lib/tarkov/player-stats";
import { GAME_MODES, type GameMode, type PlayerSearchHit } from "@/types/eft-player";

const MODE_LABEL: Record<GameMode, string> = { regular: "PVP", pve: "PVE" };

export function PlayerSearchForm() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("regular");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);

  const [hits, setHits] = useState<PlayerSearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lastRef = useRef<{ name: string; mode: GameMode }>({ name: "", mode: "regular" });

  const charsetError = name.length > 0 && !PLAYER_NAME_CHARSET_RE.test(name);
  const canSearch = isValidPlayerName(name) && !loading && (!siteKey || captchaToken.length > 0);

  const search = useCallback(async () => {
    if (!isValidPlayerName(name) || loading) return;
    if (lastRef.current.name === name && lastRef.current.mode === mode && hits) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/eft/player-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, gameMode: mode, captchaToken }),
      });
      const data = (await res.json()) as { hits?: PlayerSearchHit[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Ошибка поиска");
        setHits(null);
      } else {
        setHits(data.hits ?? []);
        lastRef.current = { name, mode };
      }
    } catch {
      setError("Сеть недоступна, попробуйте ещё раз");
      setHits(null);
    } finally {
      setLoading(false);
      setCaptchaToken("");
      setCaptchaKey((k) => k + 1); // ремаунт виджета → свежий челлендж на след. поиск
    }
  }, [name, mode, captchaToken, loading, hits]);

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Режим игры */}
      <div className="flex gap-2">
        {GAME_MODES.map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`h-9 min-w-24 px-4 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
                active
                  ? "border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)"
                  : "border border-lines-hover text-text-secondary hover:text-text-primary"
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          );
        })}
      </div>

      {/* Инпут + кнопка */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Ник игрока — 3–15 символов"
            maxLength={15}
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full border border-lines-hover bg-darkbase pr-3 pl-9 font-blender-book text-sm text-text-primary placeholder:text-text-muted focus:border-(--primary) focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={search}
          disabled={!canSearch}
          className="flex h-11 items-center justify-center gap-2 border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-6 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Найти"}
        </button>
      </div>

      {charsetError && (
        <p className="font-blender-book text-xs text-(--color-danger)">
          Только латиница, цифры, дефис и подчёркивание.
        </p>
      )}

      {siteKey && <Turnstile key={captchaKey} siteKey={siteKey} onToken={setCaptchaToken} />}

      {/* Результаты */}
      {loading && <SearchSkeleton />}

      {!loading && error && (
        <p className="border border-(--color-danger)/40 bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-4 py-3 font-blender-book text-sm text-(--color-danger)">
          {error}
        </p>
      )}

      {!loading && !error && hits !== null && (
        <div className="flex flex-col gap-2">
          {hits.length === 0 && (
            <p className="font-blender-book text-sm text-text-secondary">Игроков с таким ником не найдено.</p>
          )}
          {hits.length >= 5 && (
            <p className="font-blender-book text-xs text-text-muted">
              Показаны первые совпадения — уточните ник для точного результата.
            </p>
          )}
          {hits.length > 0 && (
            <p className="font-blender-book text-xs text-text-muted">
              Профиль со статистикой открывается на tarkov.dev в новой вкладке.
            </p>
          )}
          {hits.map((hit) => (
            <a
              key={hit.aid}
              href={`https://tarkov.dev/players/${mode}/${hit.aid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between border border-lines-hover bg-card-menu px-4 py-3 transition-colors hover:border-(--primary)"
            >
              <span className="font-blender-medium text-sm text-text-primary">{hit.name}</span>
              <ExternalLink className="h-4 w-4 text-text-muted transition-colors group-hover:text-(--primary)" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 w-full animate-pulse border border-lines-hover bg-card-menu" />
      ))}
    </div>
  );
}
