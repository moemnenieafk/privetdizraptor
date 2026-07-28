'use client';

import { useEffect, useRef } from 'react';
import { useMapViewStore } from '@/store/useMapViewStore';

/**
 * Двусторонний синк useMapViewStore ↔ URL search params — фундамент permalink (§7/§18.1).
 * Пишем через window.history.replaceState: без RSC-рефетча (в отличие от router.replace)
 * и без замусоривания истории браузера частыми обновлениями вида.
 *
 * Пока синкается floor (?floor=N). zoom/center/filters — по мере интеграции вьюера и панели.
 */
export function useMapViewUrlSync() {
  const floor = useMapViewStore((s) => s.floor);
  const setFloor = useMapViewStore((s) => s.setFloor);
  const hydrated = useRef(false);

  // Гидрация из URL один раз при маунте.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const f = sp.get('floor');
    // Есть валидный ?floor — honor permalink; иначе сбрасываем в 0 (стор глобальный,
    // не даём протечь этажу с прошлой карты с другим числом уровней).
    setFloor(f != null && f !== '' && !Number.isNaN(Number(f)) ? Number(f) : 0);
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Запись floor → URL (после гидрации, чтобы не затереть входящий permalink).
  useEffect(() => {
    if (!hydrated.current) return;
    const sp = new URLSearchParams(window.location.search);
    if (floor === 0) sp.delete('floor');
    else sp.set('floor', String(floor));
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [floor]);
}
