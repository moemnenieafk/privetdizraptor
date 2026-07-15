'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';

// Этап 09 «Патрон решает»: выбери патрон и класс брони, стреляй — увидь пробитие и выстрелы до
// нейтрализации. Учим: дешёвый ствол с правильным патроном валит дорогую броню.

interface Ammo {
  id: string;
  name: string;
  pen: number; // условная пробиваемость
  dmg: number;
}
interface Armor {
  id: string;
  name: string;
  cls: number;
  threshold: number; // порог пробития
  hp: number;
}

const AMMO: Ammo[] = [
  { id: 'ps', name: 'PS (дешёвый)', pen: 20, dmg: 55 },
  { id: 'bp', name: 'BP (средний)', pen: 40, dmg: 50 },
  { id: 'm995', name: 'M995 (топ)', pen: 55, dmg: 45 },
];
const ARMOR: Armor[] = [
  { id: 'a2', name: 'Класс 2 (мягкая)', cls: 2, threshold: 20, hp: 40 },
  { id: 'a4', name: 'Класс 4 (средняя)', cls: 4, threshold: 40, hp: 50 },
  { id: 'a6', name: 'Класс 6 (тяжёлая)', cls: 6, threshold: 58, hp: 60 },
];

interface Shot {
  penChance: number;
  shotsToKill: number;
  penetrates: boolean;
}

function simulate(ammo: Ammo, armor: Armor): Shot {
  // Грубая иллюстративная модель: шанс пробития растёт с разницей pen - threshold.
  const delta = ammo.pen - armor.threshold;
  const penChance = Math.round(Math.max(0.05, Math.min(0.95, 0.5 + delta / 60)) * 100);
  // Урон по телу если пробил (35 HP грудина), с учётом шанса — усреднённо.
  const effDmg = ammo.dmg * (penChance / 100) * 0.8 + 3;
  const shotsToKill = Math.max(1, Math.ceil(35 / effDmg));
  return { penChance, shotsToKill, penetrates: ammo.pen >= armor.threshold };
}

export function AmmoClient() {
  const [ammoId, setAmmoId] = useState('ps');
  const [armorId, setArmorId] = useState('a4');
  const [fired, setFired] = useState(false);
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  const ammo = AMMO.find((a) => a.id === ammoId) ?? AMMO[0];
  const armor = ARMOR.find((a) => a.id === armorId) ?? ARMOR[0];
  const shot = simulate(ammo, armor);

  const fire = () => {
    if (!fired) complete('ammo');
    setFired(true);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Выбор патрона */}
      <div className="flex flex-col gap-2">
        <span className="text-type-label font-blender-medium uppercase tracking-widest text-text-secondary">Патрон</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          {AMMO.map((a) => (
            <button
              key={a.id}
              onClick={() => setAmmoId(a.id)}
              className={`flex h-10 flex-1 items-center justify-center rounded-xs border font-blender-medium text-xs uppercase tracking-wide transition-colors ${
                ammoId === a.id ? 'border-(--primary) text-(--primary)' : 'border-lines-hover text-text-secondary hover:border-text-secondary'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Выбор брони */}
      <div className="flex flex-col gap-2">
        <span className="text-type-label font-blender-medium uppercase tracking-widest text-text-secondary">Броня цели</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          {ARMOR.map((a) => (
            <button
              key={a.id}
              onClick={() => setArmorId(a.id)}
              className={`flex h-10 flex-1 items-center justify-center rounded-xs border font-blender-medium text-xs uppercase tracking-wide transition-colors ${
                armorId === a.id ? 'border-(--primary) text-(--primary)' : 'border-lines-hover text-text-secondary hover:border-text-secondary'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Результат */}
      <div className="flex flex-col gap-3 rounded-xs border border-lines-hover bg-(--color-base) p-5">
        <div className="flex items-center justify-between">
          <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">
            Шанс пробития
          </span>
          <span className={`font-blender-medium text-sm ${shot.penChance >= 60 ? 'text-(--primary)' : shot.penChance >= 30 ? 'text-text-primary' : 'text-danger'}`}>
            {shot.penChance}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-xs bg-lines-hover">
          <div className={`h-full rounded-xs ${shot.penChance >= 60 ? 'bg-(--primary)' : 'bg-danger'}`} style={{ width: `${shot.penChance}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">
            Выстрелов до нейтрализации
          </span>
          <span className="font-blender-medium text-sm text-text-primary">≈ {shot.shotsToKill}</span>
        </div>
      </div>

      <button
        onClick={fire}
        className="flex h-11 items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-colors hover:bg-(--primary) hover:text-(--color-base)"
      >
        Стрелять
      </button>

      {fired && (
        <div className="flex flex-col gap-3">
          <p className="border-l-2 border-(--primary) pl-3 text-sm font-blender-book leading-5 text-text-primary">
            Патрон решает больше, чем цена ствола. Дешёвый автомат с пробивным патроном валит дорогую броню, а топ-ствол с
            плохим патроном будет её щекотать. Смотри на пробитие против класса — это отдельная наука на портале.
          </p>
          <Link
            href="/eft/progress/rookie"
            className="flex h-11 items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-opacity hover:opacity-80"
          >
            К Пути Новобранца
          </Link>
        </div>
      )}
    </div>
  );
}
