import type { CSSProperties } from 'react';
import type { PerkKind } from '@/data/eft-seasons';

// Единый визуальный словарь перков: цвет иконки-маски по типу.
// Баф → зелёный (success), дебаф → красный (danger), сезонный/глобальный → lightkeeper.
// Классы дают background-color для CSS-маски (перекрашивают монохромный SVG в цвет темы).
export const perkIconColor: Record<PerkKind, string> = {
  positive: 'bg-(--color-success)',
  negative: 'bg-(--color-danger)',
  season: 'bg-(--color-lightkeeper)',
};

// Стиль CSS-маски: монохромный SVG превращается в перекрашиваемую форму.
// currentColor/bg-* заливает силуэт, сам файл цвет не диктует.
export const perkMaskStyle = (url: string): CSSProperties => ({
  maskImage: `url(${url})`,
  WebkitMaskImage: `url(${url})`,
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
});
