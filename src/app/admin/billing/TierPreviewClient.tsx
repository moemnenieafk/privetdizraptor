"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TierOption } from "./GateMatrixClient";

/**
 * «Просмотр от лица тира» — админ смотрит портал глазами бесплатного пользователя.
 * Нужен потому, что отдельной dev-базы нет: локальная разработка ходит в боевую БД, и
 * «подвинуть порог, чтобы проверить замок» означало бы мигнуть доступом живым юзерам.
 *
 * 🔒 Превью только ПОНИЖАЕТ видимый ранг. Выбор тира выше своего ничего не даёт —
 * ограничение реализовано на сервере (src/lib/gating/preview.ts), не здесь.
 */
export function TierPreviewClient({
  tiers,
  active,
}: {
  tiers: TierOption[];
  active: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function apply(tier: string | null) {
    setBusy(true);
    await fetch("/api/admin/tier-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    setBusy(false);
    // Права считаются на сервере — обновляем RSC-дерево, а не локальный стейт.
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-lines-hover bg-card-menu px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => apply(null)}
          className={`rounded-xs border px-3 py-1.5 font-blender-medium text-xs uppercase tracking-widest transition-colors disabled:opacity-50 ${
            active === null
              ? "border-(--primary) bg-(--primary)/5 text-(--primary)"
              : "border-lines-hover text-text-muted hover:border-(--primary) hover:text-(--primary)"
          }`}
        >
          Свои права
        </button>

        {tiers.map((t) => (
          <button
            key={t.slug}
            type="button"
            disabled={busy}
            onClick={() => apply(t.slug)}
            className={`rounded-xs border px-3 py-1.5 font-blender-medium text-xs uppercase tracking-widest transition-colors disabled:opacity-50 ${
              active === t.slug
                ? "border-(--primary) bg-(--primary)/5 text-(--primary)"
                : "border-lines-hover text-text-muted hover:border-(--primary) hover:text-(--primary)"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <p className="font-blender-book text-xs leading-relaxed text-white/40">
        Понижает видимый уровень доступа для вашей сессии, чтобы проверить замки и апселлы.
        Реальную подписку не меняет; выбрать тир выше собственного нельзя.
      </p>
    </div>
  );
}
