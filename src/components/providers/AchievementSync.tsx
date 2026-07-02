"use client";

// Фаза 2 достижений — мост между облачным трекингом и useAchievementStore (в layout).
// На логине: грузит трекинг из БД в стор (или, если в облаке пусто, заливает локальный).
// При изменении — debounced-сохранение в БД. Зеркало ProgressSync (квесты).
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAchievementStore } from "@/store/useAchievementStore";
import {
  getCtaAchievementProgress,
  saveCtaAchievementProgress,
  type AchievementProgressPayload,
} from "@/lib/cta-api";

const snapshot = (): AchievementProgressPayload => {
  const s = useAchievementStore.getState();
  return { completedIds: s.completedIds, trackedIds: s.trackedIds };
};

const isEmpty = (p: AchievementProgressPayload): boolean =>
  p.completedIds.length === 0 && p.trackedIds.length === 0;

export function AchievementSync() {
  const supabaseRef = useRef(createClient());
  const loggedIn = useRef(false);
  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = supabaseRef.current;
    let active = true;

    async function hydrate(userPresent: boolean) {
      loggedIn.current = userPresent;
      if (!userPresent) {
        hydrated.current = false;
        return;
      }
      const server = await getCtaAchievementProgress();
      if (!active || server === null) return;

      if (isEmpty(server)) {
        // В облаке пусто — засеваем текущим локальным трекингом.
        await saveCtaAchievementProgress(snapshot());
      } else {
        // Сервер главнее — грузим в стор.
        useAchievementStore.getState().loadProgress(server.completedIds, server.trackedIds);
      }
      hydrated.current = true; // ПОСЛЕ загрузки — чтобы не сейвить только что загруженное
    }

    supabase.auth.getUser().then(({ data }) => hydrate(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      hydrate(Boolean(session?.user)),
    );

    const unsub = useAchievementStore.subscribe((s, prev) => {
      if (!loggedIn.current || !hydrated.current) return;
      if (s.completedIds === prev.completedIds && s.trackedIds === prev.trackedIds) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveCtaAchievementProgress(snapshot()), 1200);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return null;
}
