'use client';

// Сводка сборки: УКЛОН (что она даёт) + АКТУАЛЬНАЯ цена + шаринг снэпшота.
//
// Три боли игрока за один экран:
//   1. «Что это вообще за сборка» → уклон с реальными числами, а не список из 15 модулей.
//   2. «Сколько она стоит СЕЙЧАС» → цены из последнего синка, ствол и обвес раздельно.
//   3. «Скинуть другу» → всё дерево кодируется в ссылку, БД не нужна: друг открывает
//      и видит ту же сборку с ЕГО актуальными ценами.
import { useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';
import { buildFocus } from '@/lib/build-focus';
import { buildTotal, formatRub, type BuildPrice } from '@/lib/build-price';
import { buildShareUrl } from '@/lib/build-share';
import type { BuildItemIndex, BuildNode, BuildResult, BuildStatsDelta } from '@/lib/weapon-build';

interface BuildSummaryProps {
  baseItemId: string;
  baseName: string;
  tree: BuildNode;
  result: BuildResult;
  delta: BuildStatsDelta;
  index: BuildItemIndex;
  prices: Record<string, BuildPrice>;
  nameOf: (itemId: string) => string;
  /** Имя сборки — уедет в ссылку и в заголовок снэпшота. */
  buildName?: string;
  /** На странице снэпшота кнопка шаринга не нужна — ссылка уже открыта. */
  shareable?: boolean;
}

export function BuildSummary({
  baseItemId,
  baseName,
  tree,
  result,
  delta,
  index,
  prices,
  nameOf,
  buildName,
  shareable = true,
}: BuildSummaryProps) {
  const [copied, setCopied] = useState(false);

  const total = buildTotal(baseItemId, result, prices);
  const focus = buildFocus(result, delta, index, total.total > 0 ? total.total : null);

  const share = async () => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_SITE_URL ?? '');

    const url = buildShareUrl(origin, tree, buildName ?? baseName);
    const title = buildName ?? `${baseName} — сборка`;
    const text = `${title} · ${focus.label} · ${formatRub(total.total)} — собрано в ЦТА`;

    // Web Share есть на мобилках — открывает нативный шит (Telegram, Discord…).
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // Пользователь закрыл шит — не ошибка, просто молча падаем в копирование.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Буфер недоступен (http, старый браузер) — показываем ссылку в prompt.
      window.prompt('Скопируйте ссылку на сборку:', url);
    }
  };

  return (
    <section className="flex w-full flex-col gap-4 rounded-sm border border-lines-hover bg-(--color-base) p-4">
      {/* Уклон */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xs border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
            {focus.label}
          </span>

          {focus.tags.map((t) => (
            <span
              key={t.id}
              className="rounded-xs border border-lines-hover px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-text-secondary"
            >
              {t.label}
            </span>
          ))}
        </div>

        <p className="font-blender-book text-sm text-text-secondary">{focus.hint}</p>
      </div>

      {/* Цена */}
      <div className="flex flex-col gap-2 border-t border-lines-hover pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            Стоимость сборки
          </span>
          <span className="font-blender-medium text-lg text-(--primary)">
            {formatRub(total.total)}
          </span>
        </div>

        <div className="flex flex-wrap gap-4 font-blender-medium text-xs text-text-secondary">
          <span>
            Ствол:{' '}
            <span className="text-text-primary">
              {total.weapon != null ? formatRub(total.weapon) : 'нет в продаже'}
            </span>
          </span>
          <span>
            Обвес: <span className="text-text-primary">{formatRub(total.mods)}</span>
          </span>
          <span>
            Модулей: <span className="text-text-primary">{result.stats.modCount}</span>
          </span>
        </div>

        {total.unpricedIds.length > 0 && (
          <p className="font-blender-book text-xs text-text-secondary">
            Не в продаже и не учтено в цене: {total.unpricedIds.map(nameOf).join(', ')}.
          </p>
        )}

        <p className="font-blender-book text-xs text-text-secondary/70">
          Цены по последнему синку: дешёвейшее из торговцев и барахолки.
        </p>
      </div>

      {/* Шаринг */}
      {shareable && (
        <button
          type="button"
          onClick={share}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Ссылка скопирована
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Поделиться сборкой
            </>
          )}
        </button>
      )}

      {shareable && (
        <p className="flex items-center gap-1.5 font-blender-book text-xs text-text-secondary/70">
          <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          Вся сборка кодируется в ссылку — друг откроет её без регистрации.
        </p>
      )}
    </section>
  );
}
