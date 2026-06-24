"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "saving" | "done" | "error";

const MIN_LEN = 8;

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Фолбэк для дефолтного PKCE-шаблона: ссылка приводит сюда с ?code=, который
  // нужно обменять на recovery-сессию. token_hash-шаблон приводит уже с сессией
  // (через /auth/confirm), и тогда ?code= просто отсутствует.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    createClient()
      .auth.exchangeCodeForSession(code)
      .finally(() => {
        // Чистим code из URL, чтобы повторный обмен не сломался.
        window.history.replaceState({}, "", window.location.pathname);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LEN) {
      setError(`Пароль не короче ${MIN_LEN} символов`);
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }

    setStatus("saving");
    const { error: upErr } = await createClient().auth.updateUser({ password });
    if (upErr) {
      setStatus("error");
      // Чаще всего: ссылка устарела / нет recovery-сессии.
      setError("Ссылка устарела или недействительна. Запросите сброс заново.");
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/account"), 1200);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <h1 className="font-blender-medium text-xl uppercase tracking-widest text-(--primary)">
        Новый пароль
      </h1>

      {status === "done" ? (
        <p className="font-blender-book text-sm text-green-400">
          Пароль обновлён. Перенаправляю в кабинет…
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Новый пароль"
            className="rounded-xs border border-lines-hover bg-(--color-base) px-3 py-2 font-blender-book text-sm text-text-primary outline-none focus:border-(--primary)"
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Повторите пароль"
            className="rounded-xs border border-lines-hover bg-(--color-base) px-3 py-2 font-blender-book text-sm text-text-primary outline-none focus:border-(--primary)"
          />
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-xs border border-(--primary) px-3 py-2 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-(--primary)/10 disabled:opacity-50"
          >
            {status === "saving" ? "Сохраняю…" : "Сохранить пароль"}
          </button>
          {error && <p className="font-blender-book text-sm text-danger">{error}</p>}
        </form>
      )}
    </div>
  );
}
