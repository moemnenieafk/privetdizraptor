"use client";

// Очередь заявок на подтверждение ЧВК-профиля (для модераторов). Открывается только
// при role=admin|moderator — решает сервер. Модератор сверяет ник в кадре скрина с
// заявленным и подтверждает/отклоняет. Approve → у игрока появляется галочка в анкете.
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Check, ExternalLink, Loader2, Users, X } from "lucide-react";
import type { VerificationQueueItem } from "@/db/verification";

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function VerificationQueueClient() {
  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/eft/verification/queue");
    if (res.ok) {
      const data = (await res.json()) as { items: VerificationQueueItem[] };
      setItems(data.items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (userId: string, decision: "approved" | "rejected") => {
    let note = "";
    if (decision === "rejected") {
      note = window.prompt("Причина отклонения (увидит игрок):")?.trim() ?? "";
      if (note.length < 3) return;
    }
    setBusyId(userId);
    await fetch("/api/eft/verification", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId, decision, note }),
    });
    setBusyId(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 w-full animate-pulse rounded-sm bg-card-menu" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-sm border border-lines-hover bg-(--color-base) px-6 py-14 text-center">
        <Check className="h-8 w-8 text-success" aria-hidden="true" />
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Очередь пуста
        </h2>
        <p className="font-blender-book text-sm text-text-secondary">
          Заявок на подтверждение профиля нет.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((it) => (
        <article
          key={it.userId}
          className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4"
        >
          {/* Шапка: аккаунт → заявленный ник */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-lines-hover bg-(--color-darkbase)">
              {it.avatarUrl ? (
                <img src={it.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Users className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
                {it.username}
              </span>
              <span className="font-blender-book text-xs text-text-secondary">
                заявлен ЧВК-ник{" "}
                <span className="text-text-primary">«{it.claimedNickname}»</span> · {fmtDate(it.createdAt)}
              </span>
            </div>
            <span className="ml-auto flex items-center rounded-xs border border-(--primary)/50 bg-(--color-darkbase) px-3 py-1 font-blender-medium text-sm tracking-widest text-(--primary)">
              {it.code}
            </span>
          </div>

          {it.accountRef && (
            <a
              href={it.accountRef}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1 font-blender-book text-xs text-(--primary) hover:underline"
            >
              {it.accountRef}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}

          {/* Пруф */}
          {it.proof ? (
            <a
              href={`data:${it.proof.mime};base64,${it.proof.dataBase64}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xs border border-lines-hover"
              title="Открыть в полном размере"
            >
              <img
                src={`data:${it.proof.mime};base64,${it.proof.dataBase64}`}
                alt="Скриншот профиля"
                className="max-h-96 w-full object-contain bg-(--color-darkbase)"
              />
            </a>
          ) : (
            <p className="font-blender-book text-xs text-text-secondary">Скрин не приложен.</p>
          )}

          <p className="font-blender-book text-xs text-text-secondary">
            Сверь: ник на скрине = «{it.claimedNickname}», код <span className="text-text-primary">{it.code}</span> виден в кадре.
          </p>

          {/* Действия */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyId === it.userId}
              onClick={() => void review(it.userId, "approved")}
              className="flex h-11 items-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-40"
            >
              {busyId === it.userId ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              )}
              Подтвердить
            </button>
            <button
              type="button"
              disabled={busyId === it.userId}
              onClick={() => void review(it.userId, "rejected")}
              className="flex h-11 items-center gap-2 rounded-xs border border-danger px-4 font-blender-medium text-xs uppercase tracking-widest text-danger disabled:opacity-40"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Отклонить
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
