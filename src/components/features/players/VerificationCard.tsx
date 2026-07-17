"use client";

// Карточка «Подтверждение ЧВК-профиля» — самодостаточна: сама тянет статус и право
// (тир) из /api/eft/verification. Механизм ручной (BSG не отдаёт владение профилем):
// получаем одноразовый код → шлём скрин игрового профиля с кодом в кадре → модератор
// «Связь» сверяет ник и ставит галочку. Доступно только платным тирам.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, Clock, Copy, Loader2, Lock, ShieldQuestion, Upload, X } from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import type { MyVerificationView } from "@/db/verification";

interface ApiState {
  eligible: boolean;
  tier: string;
  minTierName: string;
  verification: MyVerificationView | null;
}

const MAX_FILE = 1_700_000; // ~1.7 МБ — совпадает с серверным капом
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

/** file → base64 без data:-префикса. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = typeof r.result === "string" ? r.result : "";
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
}

export function VerificationCard() {
  const [state, setState] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [accountRef, setAccountRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeNickname = usePlayerStore((s) => {
    const active = s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0];
    return active?.nickname ?? null;
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/eft/verification");
      if (res.ok) setState((await res.json()) as ApiState);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (payload: Record<string, unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/eft/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Ошибка запроса");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (await post({ action: "start" })) await load();
  };

  const submit = async () => {
    if (!file) {
      setError("Прикрепите скриншот профиля");
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      setError("Только PNG, JPEG или WEBP");
      return;
    }
    if (file.size > MAX_FILE) {
      setError("Файл больше 1.7 МБ — сожмите скриншот");
      return;
    }
    const dataBase64 = await fileToBase64(file);
    const ok = await post({
      action: "submit",
      proof: { mime: file.type, dataBase64 },
      accountRef: accountRef.trim() || undefined,
    });
    if (ok) {
      setFile(null);
      setAccountRef("");
      await load();
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Код:", code);
    }
  };

  const status = state?.verification?.status ?? "none";

  const heading = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <BadgeCheck className="h-5 w-5 text-(--primary)" aria-hidden="true" />
        <h3 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Подтверждение ЧВК-профиля
        </h3>
      </div>
    ),
    [],
  );

  if (loading) {
    return <div className="h-40 w-full animate-pulse rounded-sm bg-card-menu" aria-hidden="true" />;
  }
  if (!state) return null;

  /* ─── не тот тир ─── */
  if (!state.eligible) {
    return (
      <div className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4">
        {heading}
        <div className="flex items-start gap-2 rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <p className="font-blender-book text-xs leading-relaxed text-text-secondary">
            Галочка подтверждённого профиля доступна с тира{" "}
            <span className="text-text-primary">«{state.minTierName}»</span>. Она показывает в
            публичной анкете, что ЧВК-профиль реально твой — полезно стримерам и наставникам.
          </p>
        </div>
        <Link
          href="/account"
          className="flex h-11 w-fit items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
        >
          Оформить подписку
        </Link>
      </div>
    );
  }

  /* ─── подтверждён ─── */
  if (status === "approved") {
    return (
      <div className="flex flex-col gap-3 rounded-sm border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] p-4">
        {heading}
        <div className="flex flex-wrap items-center gap-2">
          <VerifiedBadge variant="chip" />
          <p className="font-blender-book text-sm text-text-secondary">
            Профиль{" "}
            <span className="font-blender-medium text-text-primary">
              «{state.verification?.claimedNickname}»
            </span>{" "}
            подтверждён. Галочка видна в твоей анкете в «Связи».
          </p>
        </div>
      </div>
    );
  }

  /* ─── на проверке ─── */
  if (status === "pending") {
    return (
      <div className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4">
        {heading}
        <div className="flex items-center gap-2 rounded-xs border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-3 py-2">
          <Clock className="h-4 w-4 shrink-0 text-(--primary)" aria-hidden="true" />
          <p className="font-blender-book text-xs text-text-secondary">
            Заявка на «{state.verification?.claimedNickname}» на проверке у модератора. Обычно это
            занимает немного времени — галочка появится автоматически.
          </p>
        </div>
      </div>
    );
  }

  /* ─── awaiting / rejected / none — форма подачи ─── */
  const code = state.verification?.code ?? null;
  const rejected = status === "rejected";

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-lines-hover bg-(--color-base) p-4">
      {heading}

      {rejected && state.verification?.note && (
        <div className="flex items-start gap-2 rounded-xs border border-danger/40 bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] px-3 py-2">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <p className="font-blender-book text-xs text-text-secondary">
            Прошлая заявка отклонена: <span className="text-text-primary">{state.verification.note}</span>
          </p>
        </div>
      )}

      {code === null ? (
        <>
          <div className="flex items-start gap-2 rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2">
            <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <p className="font-blender-book text-xs leading-relaxed text-text-secondary">
              Подтвердим, что{" "}
              <span className="text-text-primary">«{activeNickname ?? "твой ЧВК-профиль"}»</span>{" "}
              реально твой. Получи одноразовый код, впиши его в кадр скриншота своего игрового
              профиля и пришли — модератор сверит ник и поставит галочку.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void start()}
            className="flex h-11 w-fit items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {rejected ? "Подать заново" : "Получить код"}
          </button>
        </>
      ) : (
        <>
          {/* Код */}
          <div className="flex flex-col gap-2">
            <p className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
              Твой код — впиши в кадр
            </p>
            <div className="flex items-center gap-2">
              <span className="flex h-11 items-center rounded-xs border border-(--primary)/50 bg-(--color-darkbase) px-4 font-blender-medium text-lg tracking-widest text-(--primary)">
                {code}
              </span>
              <button
                type="button"
                onClick={() => void copyCode(code)}
                className="flex h-11 w-11 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
                aria-label="Скопировать код"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Инструкция */}
          <ol className="flex flex-col gap-1.5 font-blender-book text-xs leading-relaxed text-text-secondary">
            <li>
              1. Открой в игре экран профиля, где виден твой ник{" "}
              <span className="text-text-primary">«{state.verification?.claimedNickname}»</span> и
              уровень.
            </li>
            <li>2. Впиши код в кадр — на бумажке рядом с экраном или в блокноте на втором окне.</li>
            <li>3. Сделай скриншот и прикрепи ниже. По желанию — ссылка на профиль tarkov.dev.</li>
          </ol>

          {/* Ссылка на профиль (опц.) */}
          <input
            type="text"
            value={accountRef}
            onChange={(e) => setAccountRef(e.target.value.slice(0, 200))}
            placeholder="Ссылка на профиль tarkov.dev (необязательно)"
            className="h-11 w-full rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
          />

          {/* Файл */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              setError(null);
              setFile(e.target.files?.[0] ?? null);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {file ? "Заменить скрин" : "Прикрепить скрин"}
            </button>
            {file && (
              <span className="truncate font-blender-book text-xs text-text-secondary">{file.name}</span>
            )}
          </div>

          {error && <p className="font-blender-book text-xs text-danger">{error}</p>}

          <button
            type="button"
            disabled={busy || !file}
            onClick={() => void submit()}
            className="flex h-11 w-fit items-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:opacity-80 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
            Отправить на проверку
          </button>
        </>
      )}

      {error && code === null && <p className="font-blender-book text-xs text-danger">{error}</p>}
    </div>
  );
}
