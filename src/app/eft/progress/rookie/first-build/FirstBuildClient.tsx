'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';

// Этап 10 «Твой первый билд»: собираешь оружие из модулей, стата меняется вживую.
// Учим базовую философию: контроль + магазин + лазер; компенсатор — отдача, глушитель — CQB.

interface Opt {
  id: string;
  name: string;
  ergo: number;
  recoil: number;
  note?: string;
}
interface Slot {
  id: string;
  label: string;
  options: Opt[];
}

const SLOTS: Slot[] = [
  {
    id: 'muzzle',
    label: 'Дульное',
    options: [
      { id: 'comp', name: 'Компенсатор', ergo: -3, recoil: -18, note: 'гасит отдачу' },
      { id: 'supp', name: 'Глушитель', ergo: -6, recoil: -10, note: 'тихий, для CQB' },
      { id: 'none-m', name: 'Ничего', ergo: 0, recoil: 0 },
    ],
  },
  {
    id: 'mag',
    label: 'Магазин',
    options: [
      { id: 'big', name: 'Ёмкий', ergo: -5, recoil: 0, note: '+патроны' },
      { id: 'std', name: 'Стандарт', ergo: 0, recoil: 0 },
    ],
  },
  {
    id: 'tac',
    label: 'Тактика',
    options: [
      { id: 'laser', name: 'Лазер', ergo: 2, recoil: 0, note: 'точность в движении' },
      { id: 'light', name: 'Фонарь', ergo: 0, recoil: 0, note: 'видно ночью' },
    ],
  },
  {
    id: 'stock',
    label: 'Приклад',
    options: [
      { id: 'adj', name: 'Регулируемый', ergo: 8, recoil: -8, note: 'контроль' },
      { id: 'none-s', name: 'Фиксированный', ergo: 0, recoil: 0 },
    ],
  },
];

const BASE_ERGO = 45;
const BASE_RECOIL = 70;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function FirstBuildClient() {
  const [sel, setSel] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  let ergo = BASE_ERGO;
  let recoil = BASE_RECOIL;
  let quiet = false;
  for (const slot of SLOTS) {
    const opt = slot.options.find((o) => o.id === sel[slot.id]);
    if (opt) {
      ergo += opt.ergo;
      recoil += opt.recoil;
      if (opt.id === 'supp') quiet = true;
    }
  }
  ergo = clamp(ergo);
  recoil = clamp(recoil);

  const ready = ['muzzle', 'mag', 'tac'].every((s) => sel[s]);

  const save = () => {
    setSaved(true);
    complete('first-build');
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Живая стата */}
      <div className="flex flex-col gap-3 rounded-xs border border-lines-hover bg-(--color-base) p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">Эргономика</span>
            <span className="font-blender-medium text-xs text-text-primary">{ergo}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-xs bg-lines-hover">
            <div className="h-full rounded-xs bg-(--primary) transition-all duration-300" style={{ width: `${ergo}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">Отдача</span>
            <span className="font-blender-medium text-xs text-text-primary">{recoil}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-xs bg-lines-hover">
            <div className={`h-full rounded-xs transition-all duration-300 ${recoil <= 45 ? 'bg-(--primary)' : 'bg-danger'}`} style={{ width: `${recoil}%` }} />
          </div>
          <span className="text-type-label font-blender-book text-text-secondary">Ниже — лучше{quiet ? ' · тихий выстрел' : ''}</span>
        </div>
      </div>

      {/* Слоты */}
      {SLOTS.map((slot) => (
        <div key={slot.id} className="flex flex-col gap-2">
          <span className="text-type-label font-blender-medium uppercase tracking-widest text-text-secondary">{slot.label}</span>
          <div className="flex flex-wrap gap-2">
            {slot.options.map((o) => {
              const active = sel[slot.id] === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setSel((prev) => ({ ...prev, [slot.id]: o.id }))}
                  className={`flex flex-col items-start rounded-xs border px-3 py-2 transition-colors ${
                    active ? 'border-(--primary)' : 'border-lines-hover hover:border-text-secondary'
                  }`}
                >
                  <span className={`font-blender-medium text-xs uppercase tracking-wide ${active ? 'text-(--primary)' : 'text-text-primary'}`}>
                    {o.name}
                  </span>
                  {o.note && <span className="text-type-label font-blender-book text-text-secondary">{o.note}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!saved ? (
        <button
          onClick={save}
          disabled={!ready}
          className={`flex h-11 items-center justify-center rounded-xs border px-4 font-blender-medium text-xs uppercase tracking-wide transition-colors ${
            ready ? 'border-(--primary) text-(--primary) hover:bg-(--primary) hover:text-(--color-base)' : 'cursor-not-allowed border-lines-hover text-text-secondary opacity-50'
          }`}
        >
          {ready ? 'Сохранить сборку' : 'Выбери дуло, магазин и тактику'}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="border-l-2 border-(--primary) pl-3 text-sm font-blender-book leading-5 text-text-primary">
            База сборки: контроль + ёмкий магазин + лазер для точности в движении. Компенсатор гасит отдачу, глушитель —
            для ближнего боя и скрытности. Дальше — настоящий конструктор с сотнями модулей и решателем Gunsmith.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/eft/progress/loadouts"
              className="flex h-11 items-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-colors hover:bg-(--primary) hover:text-(--color-base)"
            >
              В конструктор сборок
            </Link>
            <Link
              href="/eft/progress/rookie/path"
              className="flex h-11 items-center rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-wide text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              К Пути Новобранца
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
