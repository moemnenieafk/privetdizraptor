"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const supabase = createClient();

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setStatus(error ? "error" : "sent");
  }

  async function oauth(provider: "discord" | "twitch") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <h1 className="font-blender-medium text-xl uppercase tracking-widest text-(--primary)">
        Вход в ЦТА
      </h1>

      {/* Magic-link по email */}
      <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-xs border border-white/15 bg-white/5 px-3 py-2 font-blender-book text-sm outline-none focus:border-(--primary)"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-xs border border-(--primary) px-3 py-2 font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-50"
        >
          {status === "sending" ? "Отправляю…" : "Получить ссылку для входа"}
        </button>
        {status === "sent" && (
          <p className="font-blender-book text-sm text-green-400">
            Письмо со ссылкой отправлено на {email}. Проверьте почту.
          </p>
        )}
        {status === "error" && (
          <p className="font-blender-book text-sm text-red-400">
            Не удалось отправить. Проверьте email и попробуйте снова.
          </p>
        )}
      </form>

      <div className="flex items-center gap-3 font-blender-book text-xs text-white/40">
        <span className="h-px flex-1 bg-white/10" />
        или
        <span className="h-px flex-1 bg-white/10" />
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
