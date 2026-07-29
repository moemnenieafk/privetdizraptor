// Ключ ассета/CSS-var трейдера. В данных tarkov.dev у Водителя БТР нормализованное имя с дефисом
// ("btr-driver"), а файлы аватаров (/images/traders/eft/*.webp) и токены --trader-* объявлены БЕЗ
// дефиса ("btrdriver"). Снимаем дефисы (у остальных трейдеров их в имени нет) — иначе аватар 404-ит,
// а трейдер-тинт слетает в фолбэк. Централизованно, чтобы «проблема БТР-щика с дефисом» не всплывала.
const traderKey = (n: string): string => n.replace(/-/g, '');

export const traderImg    = (n: string) => `/images/traders/eft/${traderKey(n)}.webp`;
export const traderCssVar = (n: string) => `--trader-${traderKey(n)}`;
