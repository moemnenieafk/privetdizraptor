'use client';

import { useEffect, useState } from 'react';

/**
 * Статус трансляции Twitch (fullkamen): LIVE / OFFLINE. Пуллит наш роут /api/twitch-status
 * (первый запрос через 3с, далее раз в 5 мин). Общий для плавающего StreamStatus (десктоп) и
 * header-кнопки (мобилка) — чтобы логика не дублировалась.
 */
export function useStreamLive(): { isLive: boolean; isLoading: boolean } {
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/twitch-status', { cache: 'no-store' });
        const data = await res.json();
        if (mounted) setIsLive(Boolean(data.isLive));
      } catch {
        // silent
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    const initialDelay = setTimeout(fetchStatus, 3000);
    const interval = setInterval(fetchStatus, 300_000);

    return () => {
      mounted = false;
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  return { isLive, isLoading };
}
