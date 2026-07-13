'use client';

// Список покупок для сборки: что купить, у кого и почём. Группировка по вендору —
// так удобнее ходить по торговцам, а не скакать по списку модулей.
//
// Детали без цены не прячем: показываем отдельным блоком «нет в продаже» — иначе
// человек соберёт ствол и не поймёт, почему итог не сходится.
//
// Цена — из нашей таблицы prices. Уровень лояльности торговца пока не учитывается
// (не зеркалим), поэтому вендор подписан явно: видно, к кому идти.
import { itemIconUrl } from '@/lib/item-icon';
import type { BuildPrice } from '@/db/build-prices';
import type { BuildResult } from '@/lib/weapon-build';

interface ShoppingListProps {
  result: BuildResult;
  prices: Record<string, BuildPrice>;
  nameOf: (itemId: string) => string;
}

interface Line {
  itemId: string;
  quantity: number;
  price: BuildPrice | null;
}

const rub = (n: number): string => `${n.toLocaleString('ru-RU')} ₽`;

export function ShoppingList({ result, prices, nameOf }: ShoppingListProps) {
  // Одинаковые детали (два одинаковых магазина) схлопываем в одну строку.
  const merged = new Map<string, Line>();
  for (const p of result.parts) {
    const cur = merged.get(p.itemId);
    if (cur) cur.quantity += p.quantity;
    else
      merged.set(p.itemId, {
        itemId: p.itemId,
        quantity: p.quantity,
        price: prices[p.itemId] ?? null,
      });
  }

  const lines = [...merged.values()];
  const priced = lines.filter((l) => l.price !== null);
  const unpriced = lines.filter((l) => l.price === null);

  const total = priced.reduce((s, l) => s + (l.price?.rub ?? 0) * l.quantity, 0);

  // Группировка по вендору.
  const byVendor = new Map<string, Line[]>();
  for (const l of priced) {
    const key = l.price?.vendor ?? '—';
    const list = byVendor.get(key) ?? [];
    list.push(l);
    byVendor.set(key, list);
  }

  if (lines.length === 0) {
    return (
      <section className="rounded-sm border border-lines-hover bg-(--color-base) p-4">
        <p className="font-blender-book text-sm text-text-secondary">
          Поставьте модули — здесь появится список покупок.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-lines-hover bg-(--color-base) p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Список покупок
        </h2>
        <span className="font-blender-medium text-base text-(--primary)">{rub(total)}</span>
      </div>

      {[...byVendor.entries()].map(([vendor, items]) => (
        <div key={vendor} className="flex flex-col gap-2">
          <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
            {vendor}
          </span>

          {items.map((l) => (
            <div
              key={l.itemId}
              className="flex min-h-14 items-center gap-3 rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xs bg-(--color-base)">
                <img
                  src={itemIconUrl(l.itemId)}
                  alt={nameOf(l.itemId)}
                  loading="lazy"
                  className="h-full w-full object-contain p-0.5"
                />
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-blender-book text-sm text-text-primary">
                  {nameOf(l.itemId)}
                </span>
                {l.quantity > 1 && (
                  <span className="font-blender-medium text-xs text-text-secondary">
                    ×{l.quantity}
                  </span>
                )}
              </span>

              <span className="shrink-0 font-blender-medium text-sm text-text-primary">
                {rub((l.price?.rub ?? 0) * l.quantity)}
              </span>
            </div>
          ))}
        </div>
      ))}

      {unpriced.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xs border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] p-3">
          <span className="font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
            Нет в продаже — искать в рейде или крафтить
          </span>
          <ul className="flex flex-col gap-1">
            {unpriced.map((l) => (
              <li key={l.itemId} className="font-blender-book text-xs text-text-secondary">
                {nameOf(l.itemId)}
                {l.quantity > 1 ? ` ×${l.quantity}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}