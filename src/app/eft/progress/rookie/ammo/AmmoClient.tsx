'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';
import { BodyMannequin } from '@/components/ui/BodyMannequin';
import { MANNEQUIN_ORDER, type BodyPartLabel } from '@/components/features/bosses/body-mannequin.config';

// Этап 09 «Патрон решает» на реальном манекене (7 зон). Патрон × броня → урон по зонам:
// грудь/живит под бронёй гаснут без пробития, голова летальна всегда.

interface Ammo { id: string; name: string; pen: number; dmg: number; }
interface Armor { id: string; name: string; threshold: number; }

const AMMO: Ammo[] = [
  { id: 'ps', name: 'PS (дешёвый)', pen: 20, dmg: 55 },
  { id: 'bp', name: 'BP (средний)', pen: 40, dmg: 50 },
  { id: 'm995', name: 'M995 (топ)', pen: 55, dmg: 45 },
];
const ARMOR: Armor[] = [
  { id: 'a2', name: 'Класс 2', threshold: 20 },
  { id: 'a4', name: 'Класс 4', threshold: 40 },
  { id: 'a6', name: 'Класс 6', threshold: 58 },
];

// Броня закрывает грудь и живот; голова и конечности — открыты.
function zoneDamage(ammo: Ammo, armor: Armor): Record<BodyPartLabel, number> {
  const pen = ammo.pen >= armor.threshold;
  const d = ammo.dmg;
  return {
    'Голова': d * 2,
    'Грудь': pen ? d : d * 0.15,
    'Живот': pen ? d * 0.9 : d * 0.15,
    'Левая рука': d * 0.55,
    'Правая рука': d * 0.55,
    'Левая нога': d * 0.7,
    'Правая нога': d * 0.7,
  };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function AmmoClient() {
  const [ammoId, setAmmoId] = useState('ps');
  const [armorId, setArmorId] = useState('a4');
  const [active, setActive] = useState<BodyPartLabel | null>(null);
  const [fired, setFired] = useState(false);
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  const ammo = AMMO.find((a) => a.id === ammoId) ?? AMMO[0];
  const armor = ARMOR.find((a) => a.id === armorId) ?? ARMOR[0];

  const { values, max, penChance, shotsToKill } = useMemo(() => {
    const v = zoneDamage(ammo, armor);
    const m = Math.max(...Object.values(v));
    const delta = ammo.pen - armor.threshold;
    const pc = Math.round(clamp(0.5 + delta / 60, 0.05, 0.95) * 100);
    const stk = Math.max(1, Math.ceil(85 / Math.max(1, v['Грудь'])));
    return { values: v, max: m, penChance: pc, shotsToKill: stk };
  }, [ammo, armor]);

  const fire = () => {
    if (!fired) complete('ammo');
    setFired(true);
  };

  const activeDmg = active ? Math.round(values[active]) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Патрон */}
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

      {/* Броня */}
      <div className="flex flex-col gap-2">
        <span className="text-type-label font-blender-medium uppercase tracking-widest text-text-secondary">Броня цели (грудь + живот)</span>
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

      {/* Манекен + разбор зон */}
      <div className="flex flex-col items-center gap-6 rounded-xs border border-lines-hover bg-(--color-base) p-5 sm:flex-row sm:items-start sm:gap-8">
        <div className="w-40 shrink-0">
          <BodyMannequin values={values} max={max} active={active} onEnter={setActive} onLeave={() => setActive(null)} className="h-auto w-full" />
        </div>
        <ul className="flex w-full flex-col gap-2">
          {MANNEQUIN_ORDER.map((label) => {
            const dmg = values[label];
            const isActive = active === label;
            return (
              <li
                key={label}
                className="flex items-center gap-3 transition-opacity"
                style={{ opacity: active !== null && !isActive ? 0.4 : 1 }}
                onMouseEnter={() => setActive(label)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="w-24 shrink-0 text-type-label font-blender-book text-text-secondary">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-xs bg-lines-hover">
                  <div className="h-full rounded-xs bg-(--primary) transition-[width] duration-300" style={{ width: `${max > 0 ? (dmg / max) * 100 : 0}%` }} />
                </div>
                <span className="w-9 shrink-0 text-right font-blender-medium text-xs text-text-primary">{Math.round(dmg)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Хедлайн по бронезоне */}
      <div className="flex items-center justify-between rounded-xs border border-lines-hover bg-(--color-base) px-4 py-3">
        <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">Пробитие груди</span>
        <span className={`font-blender-medium text-sm ${penChance >= 60 ? 'text-(--primary)' : penChance >= 30 ? 'text-text-primary' : 'text-danger'}`}>
          {penChance}% · ≈ {shotsToKill} выстр.{activeDmg !== null ? ` · зона: ${activeDmg}` : ''}
        </span>
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
            Смотри на манекен: без пробития грудь и живот почти гаснут — броня держит, — а голова светится всегда. Отсюда
            вывод: патрон важнее цены ствола. Слабый патрон против высокого класса брони = целься в открытые зоны, либо
            бери пробивной боеприпас.
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
