"use client";

// Слой 4b — мост между облачным прогрессом и zustand-стором (монтируется в layout).
// На логине: грузит прогресс из БД в стор (или, если в облаке пусто, заливает
// текущий локальный). При изменении прогресса — debounced-сохранение в БД.
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuestStore } from "@/store/useQuestStore";
import {
  getCtaProgress,
  saveCtaProgress,
  type ProgressPayload,
} from "@/lib/cta-api";

const snapshot = (): ProgressPayload => {
  const s = useQuestStore.getState();
  return {
    completedQuests: s.completedQuests,
    itemProgress: s.itemProgress,
    pinnedQuests: s.pinnedQuests,
    questNotes: s.questNotes,
  };
};

const isEmpty = (p: ProgressPayload): boolean =>
  p.completedQuests.length === 0 &&
  p.pinnedQuests.length === 0 &&
  Object.keys(p.itemProgress).length === 0 &&
  Object.keys(p.questNotes).length === 0;

export function ProgressSync() {
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
      const server = await getCtaProgress();
      if (!active || server === null) return;

      if (isEmpty(server)) {
        // В облаке пусто — засеваем его текущим локальным прогрессом.
        await saveCtaProgress(snapshot());
      } else {
        // Сервер главнее — грузим в стор.
        useQuestStore.getState().loadProgress(server.completedQuests, server.itemProgress);
        useQuestStore.setState({
          pinnedQuests: server.pinnedQuests,
          questNotes: server.questNotes,
        });
      }
      hydrated.current = true; // ставим ПОСЛЕ загрузки — чтобы не сейвить только что загруженное
    }

    supabase.auth.getUser().then(({ data }) => hydrate(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      hydrate(Boolean(session?.user)),
    );

    const unsub = useQuestStore.subscribe((s, prev) => {
      if (!loggedIn.current || !hydrated.current) return;
      // Игнорируем изменения runtime-кэша (tasks) — сейвим только persisted-поля.
      if (
        s.completedQuests === prev.completedQuests &&
        s.itemProgress === prev.itemProgress &&
        s.pinnedQuests === prev.pinnedQuests &&
        s.questNotes === prev.questNotes
      )
        return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveCtaProgress(snapshot()), 1200);
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
