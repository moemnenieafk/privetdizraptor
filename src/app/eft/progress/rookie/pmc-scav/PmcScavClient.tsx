'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';

// Этап 02 «ЧВК и Дикий»: тумблер двух персонажей. Учим разницу, требуя посмотреть обе стороны.

type Side = 'pmc' | 'scav';

interface Aspect {
  k: string;
  pmc: string;
  scav: string;
}

const ASPECTS: Aspect[] = [
  { k: 'Снаряжение', pmc: 'Твой шмот — сам собрал и купил', scav: 'Случайный набор, что выдали' },
  { k: 'Лут', pmc: 'Полный контроль, но рискуешь своим', scav: 'Что дали и что найдёшь — без вложений' },
  { k: 'Риск', pmc: 'Гибель — потеря своего шмота', scav: 'Терять почти нечего, оно не твоё' },
  { k: 'Цель', pmc: 'Квесты, прокачка, крупная добыча', scav: 'Фарм без риска, добить рейд' },
  { k: 'ИИ-Дикие', pmc: 'Боты враждебны', scav: 'Ты свой среди Диких-ботов' },
  { k: 'Вход в рейд', pmc: 'Когда захочешь', scav: 'По таймеру перезарядки Дикого' },
];

export function PmcScavClient() {
  const [side, setSide] = useState<Side>('pmc');
  const [viewed, setViewed] = useState<Set<Side>>(new Set<Side>(['pmc']));
  const [done, setDone] = useState(false);
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  const choose = (s: Side) => {
    setSide(s);
    setViewed((prev) => new Set(prev).add(s));
  };

  const bothViewed = viewed.has('pmc') && viewed.has('scav');

  const finish = () => {
    setDone(true);
    complete('pmc-scav');
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Тумблер сторон */}
      <div className="flex gap-2">
        {(['pmc', 'scav'] as Side[]).map((s) => {
          const active = side === s;
          return (
            <button
              key={s}
              onClick={() => choose(s)}
              className={`flex h-10 flex-1 items-center justify-center rounded-xs border font-blender-medium text-xs uppercase tracking-widest transition-colors ${
                active
                  ? 'border-(--primary) text-(--primary)'
                  : 'border-lines-hover text-text-secondary hover:border-text-secondary'
              }`}
            >
              {s === 'pmc' ? 'ЧВК' : 'Дикий'}
            </button>
          );
        })}
      </div>

      {/* Сравнение: активная сторона крупно, вторая — приглушённо */}
      <div className="flex flex-col divide-y divide-lines-hover rounded-xs border border-lines-hover bg-(--color-base)">
        {ASPECTS.map((a) => (
          <div key={a.k} className="flex flex-col gap-1 p-3">
            <span className="text-type-label font-blender-medium uppercase tracking-widest text-text-secondary">
              {a.k}
            </span>
            <span className="text-sm font-blender-book leading-4 text-text-primary">
              {side === 'pmc' ? a.pmc : a.scav}
            </span>
            <span className="text-type-label font-blender-book leading-4 text-text-secondary opacity-50">
              {side === 'pmc' ? `Дикий: ${a.scav}` : `ЧВК: ${a.pmc}`}
            </span>
          </div>
        ))}
      </div>

      {/* Итог / CTA */}
      {!done ? (
        <button
          onClick={finish}
          disabled={!bothViewed}
          className={`flex h-11 items-center justify-center rounded-xs border font-blender-medium text-xs uppercase tracking-wide transition-colors ${
            bothViewed
              ? 'border-(--primary) text-(--primary) hover:bg-(--primary) hover:text-(--color-base)'
              : 'cursor-not-allowed border-lines-hover text-text-secondary opacity-50'
          }`}
        >
          {bothViewed ? 'Я понял разницу' : 'Посмотри обе стороны'}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="border-l-2 border-(--primary) pl-3 text-sm font-blender-book leading-5 text-text-primary">
            Коротко: за <span className="text-(--primary)">ЧВК</span> ты растёшь и рискуешь своим. За{' '}
            <span className="text-(--primary)">Дикого</span> — фармишь без риска и вытаскиваешь добро на халяву. Опытные
            качают оба: Дикий кормит ЧВК.
          </p>
          <Link
            href="/eft/progress/rookie/path"
            className="flex h-11 items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-opacity hover:opacity-80"
          >
            К Пути Новобранца
          </Link>
        </div>
      )}
    </div>
  );
}
