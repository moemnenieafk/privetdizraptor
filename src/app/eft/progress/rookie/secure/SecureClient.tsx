'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';

// Этап 03 «Не потеряй всё»: разложи ценное в секур-контейнер (2 слота), затем «погибни»
// и увидь, что спаслось, что вернёт страховка, а что забрал враг.

interface Loot {
  id: string;
  name: string;
  insured: boolean;
}

const LOOT: Loot[] = [
  { id: 'labs', name: 'Красная ключ-карта', insured: false },
  { id: 'key', name: 'Ключ от тайника', insured: false },
  { id: 'gpu', name: 'Графическая карта', insured: false },
  { id: 'armor', name: 'Броня 5 класса', insured: true },
  { id: 'meds', name: 'Аптечка Salewa', insured: true },
  { id: 'ammo', name: 'Пачка патронов', insured: false },
];

const SLOTS = 2;

type Fate = 'saved' | 'insured' | 'lost';

export function SecureClient() {
  const [inContainer, setInContainer] = useState<Set<string>>(new Set());
  const [dead, setDead] = useState(false);
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  const toggle = (id: string) => {
    if (dead) return;
    setInContainer((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < SLOTS) next.add(id);
      return next;
    });
  };

  const die = () => {
    setDead(true);
    complete('secure');
  };

  const reset = () => {
    setDead(false);
    setInContainer(new Set());
  };

  const fateOf = (item: Loot): Fate =>
    inContainer.has(item.id) ? 'saved' : item.insured ? 'insured' : 'lost';

  const fateMeta: Record<Fate, { label: string; cls: string }> = useMemo(
    () => ({
      saved: { label: 'В контейнере — спасено', cls: 'text-(--primary)' },
      insured: { label: 'Застраховано — вернётся', cls: 'text-text-secondary' },
      lost: { label: 'Забрал враг — потеряно', cls: 'text-danger' },
    }),
    [],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Секур-контейнер */}
      <div className="flex items-center gap-3 rounded-xs border border-(--primary) bg-(--color-base) p-3">
        <span className="text-type-label font-blender-medium uppercase tracking-widest text-(--primary)">
          Секур-контейнер
        </span>
        <div className="flex flex-1 justify-end gap-1.5">
          {Array.from({ length: SLOTS }).map((_, i) => {
            const filled = i < inContainer.size;
            return (
              <div
                key={i}
                className={`h-7 w-7 rounded-xs border ${filled ? 'border-(--primary) bg-(--primary)' : 'border-lines-hover'}`}
              />
            );
          })}
        </div>
      </div>

      {!dead && (
        <p className="text-type-label font-blender-book leading-4 text-text-secondary">
          Тапни {SLOTS} самых ценных предмета — они переживут любую смерть. Остальное — на удачу и страховку.
        </p>
      )}

      {/* Инвентарь */}
      <div className="flex flex-col gap-2">
        {LOOT.map((item) => {
          const picked = inContainer.has(item.id);
          const fate = fateOf(item);
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              disabled={dead}
              className={`flex items-center gap-3 rounded-xs border bg-(--color-base) p-3 text-left transition-colors ${
                dead
                  ? 'cursor-default border-lines-hover'
                  : picked
                    ? 'border-(--primary)'
                    : 'border-lines-hover hover:border-text-secondary'
              }`}
            >
              <div
                className={`h-4 w-4 shrink-0 rounded-xs border ${picked ? 'border-(--primary) bg-(--primary)' : 'border-lines-hover'}`}
              />
              <span className="flex-1 font-blender-medium text-xs uppercase tracking-wide text-text-primary">
                {item.name}
              </span>
              {!dead && item.insured && (
                <span className="text-type-label font-blender-book uppercase text-text-secondary opacity-60">
                  застраховано
                </span>
              )}
              {dead && (
                <span className={`text-type-label font-blender-medium uppercase tracking-wide ${fateMeta[fate].cls}`}>
                  {fateMeta[fate].label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!dead ? (
        <button
          onClick={die}
          className="flex h-11 items-center justify-center rounded-xs border border-danger px-4 font-blender-medium text-xs uppercase tracking-wide text-danger transition-colors hover:bg-danger hover:text-(--color-base)"
        >
          Погибнуть в рейде
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="border-l-2 border-(--primary) pl-3 text-sm font-blender-book leading-5 text-text-primary">
            Контейнер спасает что внутри — <span className="text-(--primary)">всегда</span>. Туда суют самое дорогое и
            мелкое: карты, ключи. Страховка вернёт унесённое, только если враг не забрал тело. Крупное в контейнер не
            влезет — в этом вся дилемма Тарко́ва.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={reset}
              className="flex h-11 items-center rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-wide text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              Разложить заново
            </button>
            <Link
              href="/eft/progress/rookie"
              className="flex h-11 items-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-opacity hover:opacity-80"
            >
              К Пути Новобранца
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
