'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Полноэкранный режим для фрейм-вью (карты, в перспективе — questmap).
 * Ставит атрибут на <body> (его наблюдают виджеты хедера, напр. StreamStatus,
 * чтобы спрятаться под z-[100]-оверлеем фрейма) и снимается по Esc на стороне вызова.
 *
 * Сам контейнер фрейма переключает классы `fixed inset-0 z-[100]` по `isFullscreen`.
 */
export function useFullscreen(bodyAttr = 'data-app-fullscreen') {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isFullscreen) document.body.setAttribute(bodyAttr, '');
    else document.body.removeAttribute(bodyAttr);
    return () => document.body.removeAttribute(bodyAttr);
  }, [isFullscreen, bodyAttr]);

  const toggle = useCallback(() => setIsFullscreen((v) => !v), []);
  const exit = useCallback(() => setIsFullscreen(false), []);

  return { isFullscreen, setIsFullscreen, toggle, exit };
}
