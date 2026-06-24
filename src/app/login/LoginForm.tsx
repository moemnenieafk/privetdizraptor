"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";
import { Turnstile } from "@/components/ui/Turnstile";

type Mode = "login" | "register";
type MagicStatus = "idle" | "sending" | "sent" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_-]{3,15}$/;

// Поле ввода в стиле NIGHTFALL + опциональный глазик для паролей.
function Field({
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword && reveal ? "text" : type;
  return (
    <div className="relative">
      <input
        type={effectiveType}
        required
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded border border-lines-hover bg-(--color-base) px-4 py-3 ${isPassword ? "pr-11" : ""} font-blender-book text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-(--primary) focus:outline-none`}
      />
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? "Скрыть пароль" : "Показать пароль"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-(--primary)"
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function PrimaryButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded border border-(--primary) bg-(--primary)/10 px-4 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary) transition-all hover:bg-(--primary)/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");

  // ── капча (Turnstile) ──
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0); // смена → ремаунт виджета (новый токен)
  const [loginCaptchaRequired, setLoginCaptchaRequired] = useState(false);
  const resetCaptcha = () => {
    setCaptchaToken("");
    setCaptchaKey((k) => k + 1);
  };

  // ── вход ──
  const [identifier, setIdentifier] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [signing, setSigning] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [magic, setMagic] = useState<MagicStatus>("idle");

  // ── регистрация ──
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regPw2, setRegPw2] = useState("");
  const [regError, setRegError] = useState<string | null>(null);
  const [regState, setRegState] = useState<"idle" | "submitting" | "sent">("idle");

  function switchMode(m: Mode) {
    setMode(m);
    setLoginError(null);
    setRegError(null);
    setMagic("idle");
    setLoginCaptchaRequired(false);
    resetCaptcha();
  }

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setSigning(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password: loginPw, captchaToken }),
    });
    if (!res.ok) {
      setSigning(false);
      const json = (await res.json().catch(() => null)) as
        | { error?: string; captchaRequired?: boolean }
        | null;
      setLoginError(json?.error ?? "Не удалось войти");
      if (json?.captchaRequired) {
        setLoginCaptchaRequired(true); // показать капчу со след. попытки
        resetCaptcha(); // токен одноразовый — свежий челлендж
      }
      return;
    }
    window.location.assign(next);
  }

  async function sendMagicLink() {
    if (!EMAIL_RE.test(identifier)) {
      setLoginError("Для ссылки на почту введите e-mail (не имя пользователя)");
      return;
    }
    setLoginError(null);
    setMagic("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: identifier,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
    });
    setMagic(error ? "error" : "sent");
  }

  const regValid =
    EMAIL_RE.test(email) && USERNAME_RE.test(username) && regPw.length >= 8 && regPw === regPw2;

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);
    if (!regValid) {
      setRegError("Проверьте поля: e-mail, логин (3–15), пароль ≥8 и совпадение.");
      return;
    }
    if (siteKey && !captchaToken) {
      setRegError("Пройдите проверку «я не робот»");
      return;
    }
    setRegState("submitting");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password: regPw, captchaToken }),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; needsConfirm?: boolean; error?: string }
      | null;
    if (!res.ok) {
      setRegState("idle");
      setRegError(json?.error ?? "Не удалось зарегистрироваться");
      resetCaptcha(); // токен одноразовый — сбрасываем для повтора
      return;
    }
    if (json?.needsConfirm) {
      setRegState("sent");
    } else {
      window.location.assign(next); // Confirm email ВЫКЛ → сразу вошли
    }
  }

  async function oauth(provider: "discord" | "twitch") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="overflow-hidden rounded border border-lines-hover bg-card-menu">
        {/* Заголовок */}
        <div className="border-b border-lines-hover px-7 pb-5 pt-7">
          <h1 className="font-blender-medium text-xl uppercase tracking-widest text-(--primary)">
            {mode === "login" ? "Вход в ЦТА" : "Регистрация"}
          </h1>
          <p className="mt-1 font-blender-book text-xs text-text-secondary">
            {mode === "login" ? "Войдите по e-mail или логину" : "Создайте аккаунт оператора ЦТА"}
          </p>
        </div>

        {/* Переключатель режимов */}
        <div className="px-7 pt-5">
          <div className="grid grid-cols-2 gap-1 rounded border border-lines-hover bg-(--color-base) p-1">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`rounded-xs py-2 font-blender-medium text-type-caption uppercase tracking-widest transition-colors ${
                  mode === m
                    ? "bg-(--primary)/15 text-(--primary)"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {m === "login" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>
        </div>

        {/* Тело — анимированный swap по mode */}
        <div
          key={mode}
          className="flex animate-[fade-in-up_0.3s_ease-out_both] flex-col gap-4 px-7 pb-7 pt-5"
        >
          {mode === "login" ? (
            <>
              <form onSubmit={signInPassword} className="flex flex-col gap-3">
                <Field
                  value={identifier}
                  onChange={setIdentifier}
                  placeholder="E-mail или имя пользователя"
                  autoComplete="username"
                />
                <Field
                  type="password"
                  value={loginPw}
                  onChange={setLoginPw}
                  placeholder="Пароль"
                  autoComplete="current-password"
                />
                {siteKey && loginCaptchaRequired && (
                  <Turnstile key={captchaKey} siteKey={siteKey} onToken={setCaptchaToken} />
                )}
                <PrimaryButton
                  disabled={signing || (loginCaptchaRequired && !!siteKey && !captchaToken)}
                >
                  {signing ? "Вхожу…" : "Войти"}
                </PrimaryButton>
                {loginError && <p className="font-blender-book text-xs text-danger">{loginError}</p>}
              </form>

              <button
                type="button"
                onClick={sendMagicLink}
                disabled={magic === "sending"}
                className="self-start font-blender-book text-xs text-text-muted underline underline-offset-4 transition-colors hover:text-(--primary) disabled:opacity-50"
              >
                {magic === "sending" ? "Отправляю…" : "Войти по ссылке на e-mail"}
              </button>
              {magic === "sent" && (
                <p className="font-blender-book text-xs text-nvg-green">
                  Письмо со ссылкой отправлено на {identifier}.
                </p>
              )}
              {magic === "error" && (
                <p className="font-blender-book text-xs text-danger">
                  Не удалось отправить ссылку (лимит писем). Войдите по паролю.
                </p>
              )}
            </>
          ) : regState === "sent" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-(--primary)/40 bg-(--primary)/10">
                <MailCheck className="h-5 w-5 text-(--primary)" />
              </div>
              <p className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
                Аккаунт создан
              </p>
              <p className="font-blender-book text-xs leading-relaxed text-text-secondary">
                Мы отправили ссылку для подтверждения на{" "}
                <span className="text-(--primary)">{email}</span>. Перейдите по ней, чтобы завершить
                регистрацию и войти.
              </p>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-blender-book text-xs text-text-muted underline underline-offset-4 hover:text-(--primary)"
              >
                Вернуться ко входу
              </button>
            </div>
          ) : (
            <form onSubmit={register} className="flex flex-col gap-3">
              <Field value={email} onChange={setEmail} type="email" placeholder="E-mail" autoComplete="email" />
              <div className="flex flex-col gap-1">
                <Field value={username} onChange={setUsername} placeholder="Логин" autoComplete="username" />
                <span className="px-1 font-blender-book text-type-micro text-text-muted">
                  3–15 символов: латиница, цифры, _ и -
                </span>
              </div>
              <Field
                type="password"
                value={regPw}
                onChange={setRegPw}
                placeholder="Пароль (мин. 8)"
                autoComplete="new-password"
              />
              <Field
                type="password"
                value={regPw2}
                onChange={setRegPw2}
                placeholder="Повторите пароль"
                autoComplete="new-password"
              />
              {siteKey && <Turnstile key={captchaKey} siteKey={siteKey} onToken={setCaptchaToken} />}
              <PrimaryButton
                disabled={regState === "submitting" || !regValid || (!!siteKey && !captchaToken)}
              >
                {regState === "submitting" ? "Создаю…" : "Зарегистрироваться"}
              </PrimaryButton>
              {regError && <p className="font-blender-book text-xs text-danger">{regError}</p>}
            </form>
          )}
        </div>

        {/* OAuth — оба режима */}
        <div className="flex flex-col gap-2 border-t border-lines-hover px-7 py-5">
          <div className="mb-1 flex items-center gap-3 font-blender-book text-type-caption uppercase tracking-widest text-text-muted">
            <span className="h-px flex-1 bg-lines-hover" />
            или через
            <span className="h-px flex-1 bg-lines-hover" />
          </div>
          <button
            onClick={() => oauth("discord")}
            className="rounded border border-lines-hover px-4 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Discord
          </button>
          <button
            onClick={() => oauth("twitch")}
            className="rounded border border-lines-hover px-4 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Twitch
          </button>
        </div>
      </div>
    </div>
  );
}
