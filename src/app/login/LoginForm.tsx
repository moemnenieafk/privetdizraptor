"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";

type MagicStatus = "idle" | "sending" | "sent" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const supabase = createClient();

  const [identifier, setIdentifier] = useState(""); // e-mail ИЛИ имя пользователя
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);

  // Вход по паролю (через серверный роут — резолвит username→email)
  const [signing, setSigning] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Magic-link (запасной вход по ссылке на почту)
  const [magic, setMagic] = useState<MagicStatus>("idle");

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setSigning(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
      setSigning(false);
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setPwError(json?.error ?? "Не удалось войти");
      return;
    }
    // Полный переход — чтобы сервер/middleware сразу увидели свежую сессию в куках.
    window.location.assign(next);
  }

  async function sendMagicLink() {
    if (!EMAIL_RE.test(identifier)) {
      setPwError("Для ссылки на почту введите e-mail (не имя пользователя)");
      return;
    }
    setPwError(null);
    setMagic("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: identifier,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    setMagic(error ? "error" : "sent");
  }

  async function oauth(provider: "discord" | "twitch") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <h1 className="font-blender-medium text-xl uppercase tracking-widest text-(--primary)">
        Вход в ЦТА
      </h1>

      {/* Вход по e-mail/имени + паролю */}
      <form onSubmit={signInPassword} className="flex flex-col gap-3">
        <input
          type="text"
          required
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="E-mail или имя пользователя"
          className="rounded-xs border border-white/15 bg-white/5 px-3 py-2 font-blender-book text-sm outline-none focus:border-(--primary)"
        />
        <div className="relative">
          <input
            type={reveal ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="w-full rounded-xs border border-white/15 bg-white/5 px-3 py-2 pr-10 font-blender-book text-sm outline-none focus:border-(--primary)"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Скрыть пароль" : "Показать пароль"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-(--primary)"
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          type="submit"
          disabled={signing}
          className="rounded-xs border border-(--primary) px-3 py-2 font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-50"
        >
          {signing ? "Вхожу…" : "Войти"}
        </button>
        {pwError && <p className="font-blender-book text-sm text-red-400">{pwError}</p>}
      </form>

      <div className="flex items-center gap-3 font-blender-book text-xs text-white/40">
        <span className="h-px flex-1 bg-white/10" />
        или
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {/* Запасной вход по ссылке на почту */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={sendMagicLink}
          disabled={magic === "sending"}
          className="rounded-xs border border-white/15 px-3 py-2 font-blender-medium text-xs uppercase tracking-widest hover:border-(--primary) disabled:opacity-50"
        >
          {magic === "sending" ? "Отправляю…" : "Войти по ссылке на e-mail"}
        </button>
        {magic === "sent" && (
          <p className="font-blender-book text-sm text-green-400">
            Письмо со ссылкой отправлено на {identifier}. Проверьте почту.
          </p>
        )}
        {magic === "error" && (
          <p className="font-blender-book text-sm text-red-400">
            Не удалось отправить ссылку (лимит писем). Войдите по паролю.
          </p>
        )}
      </div>

      {/* OAuth — заработают после настройки провайдеров в Supabase */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => oauth("discord")}
          className="rounded-xs border border-white/15 px-3 py-2 font-blender-medium text-xs uppercase tracking-widest hover:border-(--primary)"
        >
          Войти через Discord
        </button>
        <button
          onClick={() => oauth("twitch")}
          className="rounded-xs border border-white/15 px-3 py-2 font-blender-medium text-xs uppercase tracking-widest hover:border-(--primary)"
        >
          Войти через Twitch
        </button>
      </div>
    </div>
  );
}
