"use client";

// Слой 4b — мост между облачным прогрессом и zustand-стором (монтируется в layout).
// На логине: грузит прогресс из БД в стор (или, если в облаке пусто, заливает
// текущий локальный). При изменении прогресса — debounced-сохранение в БД.
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuestStore } from "@/store/useQuestStore";
import { migrateHideoutProgressIntoStash } from "@/lib/stash-migration";
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

  // Одноразовая миграция прогресса убежища в схрон (итерация 5). После гидрации persist на клиенте;
  // сама функция идемпотентна по флагу hideoutMerged.
  useEffect(() => {
    if (typeof window === "undefined") return;
    migrateHideoutProgressIntoStash();
  }, []);

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

    // Flush отложенного сейва при уходе со страницы: закрытие вкладки / переход / сворачивание —
    // чтобы отметка, сделанная за <1200мс до ухода, ГАРАНТИРОВАННО дошла до аккаунта (keepalive).
    const flush = () => {
      if (!loggedIn.current || !hydrated.current || !timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      void saveCtaProgress(snapshot(), true);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      unsub();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return null;
}
