'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { Check, Lock, Coins } from 'lucide-react';
import { useSaveTheServersStore } from '@/store/useSaveTheServersStore';
import { useArcadeStore } from '@/store/useArcadeStore';
import { playSfx } from '@/lib/sfx';
import { WEAPONS, skinPrice, cursorSrc } from './games/save-the-servers/config';

// Магазин скинов холодного оружия game01. Постоянный кошелёк, цена = index×20.
// Гидрация-гейт по _hasHydrated (SSR-safe), скелетон — не спиннер.
export function SkinShop() {
  const hydrated = useSaveTheServersStore((s) => s._hasHydrated);
  const wallet = useSaveTheServersStore((s) => s.wallet);
  const unlocked = useSaveTheServersStore((s) => s.unlockedSkins);
  const selected = useSaveTheServersStore((s) => s.selectedSkin);
  const buySkin = useSaveTheServersStore((s) => s.buySkin);
  const selectSkin = useSaveTheServersStore((s) => s.selectSkin);

  useEffect(() => {
    void useSaveTheServersStore.persist.rehydrate();
  }, []);

  const beep = (name: 'coins' | 'confirm') => {
    if (!useArcadeStore.getState().muted) playSfx(name);
  };

  const onPick = (id: string, price: number, owned: boolean) => {
    if (owned) {
      selectSkin(id);
      beep('confirm');
      return;
    }
    if (buySkin(id, price)) beep('coins');
  };

  if (!hydrated) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 w-full animate-pulse rounded-xs bg-lines-hover" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          Склад холодного
        </span>
        <span className="flex items-center gap-1.5 font-blender-medium text-xs text-(--primary)">
          <Coins size={13} strokeWidth={1.75} />
          {wallet.toLocaleString('ru-RU')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {WEAPONS.map((w, i) => {
          const price = skinPrice(i);
          const owned = unlocked.includes(w.id);
          const equipped = selected === w.id;
          const affordable = wallet >= price;

          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onPick(w.id, price, owned)}
              disabled={!owned && !affordable}
              aria-pressed={equipped}
              className={`group relative flex flex-col items-center gap-1 rounded-xs border p-2 transition-colors ${
                equipped
                  ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                  : owned
                    ? 'border-lines-hover bg-card-menu hover:border-(--primary)'
                    : affordable
                      ? 'border-lines-hover bg-card-menu hover:border-(--primary)'
                      : 'border-lines-hover bg-card-menu opacity-55'
              }`}
            >
              <div className="relative h-14 w-14">
                <Image
                  src={cursorSrc(w.file, 1)}
                  alt={w.name}
                  fill
                  sizes="56px"
                  className={`object-contain ${owned ? '' : 'opacity-70 grayscale'}`}
                  unoptimized
                />
                {equipped && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--primary) text-(--color-base)">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
                {!owned && (
                  <span className="absolute -top-1 -right-1 text-text-muted">
                    <Lock size={12} />
                  </span>
                )}
              </div>

              <span className="w-full truncate text-center font-blender-medium text-type-micro uppercase tracking-wide text-text-secondary">
                {w.name}
              </span>

              <span
                className={`font-blender-medium text-type-micro uppercase tracking-widest ${
                  equipped
                    ? 'text-(--primary)'
                    : owned
                      ? 'text-text-muted'
                      : affordable
                        ? 'text-(--primary)'
                        : 'text-text-muted'
                }`}
              >
                {equipped ? 'Выбран' : owned ? 'Выбрать' : price === 0 ? 'Даром' : affordable ? `Купить ${price}` : `🔒 ${price}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
