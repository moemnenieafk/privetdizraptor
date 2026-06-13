import { useEffect, RefObject } from 'react';

/**
 * Единый кастомный хук для отслеживания кликов вне элемента.
 * Поддерживает мышь и тач-события.
 * @param ref Ссылка на DOM-элемент
 * @param handler Функция-обработчик закрытия
 * @param enabled Флаг активности хука (для оптимизации и поддержки вложенных модалок)
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, enabled]);
}