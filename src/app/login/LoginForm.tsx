"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";

type MagicStatus = "idle" | "sending" | "sent" | "error";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Вход по паролю
  const [signing, setSigning] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Magic-link (запасной вход по ссылке на почту)
  const [magic, setMagic] = useState<MagicStatus>("idle");

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setSigning(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSigning(false);
      setPwError(
        /invalid login credentials/i.test(error.message)
          ? "Неверный e-mail или пароль"
          : "Не удалось войти. Попробуйте снова.",
      );
      return;
    }
    // Полный переход — чтобы сервер/middleware сразу увидели свежую сессию в куках.
    window.location.assign(next);
  }

  async function sendMagicLink() {
    if (!email) {
      setPwError("Введите e-mail для ссылки");
      return;
    }
    setMagic("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
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

      {/* Вход по e-mail + паролю */}
      <form onSubmit={signInPassword} className="flex flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-xs border border-white/15 bg-white/5 px-3 py-2 font-blender-book text-sm outline-none focus:border-(--primary)"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          className="rounded-xs border border-white/15 bg-white/5 px-3 py-2 font-blender-book text-sm outline-none focus:border-(--primary)"
        />
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
            Письмо со ссылкой отправлено на {email}. Проверьте почту.
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
