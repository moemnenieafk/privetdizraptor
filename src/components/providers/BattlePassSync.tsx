"use client";

// Слой 4e — мост между облачным прогрессом battlepass-трекера и useBattlePassStore
// (монтируется в layout). На логине: грузит прогресс из БД в стор (или, если в облаке пусто,
// заливает текущий локальный). При изменении — debounced-сохранение в БД. Аноним — только
// localStorage (как раньше). Зеркало паттерна ProgressSync/AchievementSync.
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBattlePassStore } from "@/store/useBattlePassStore";
import {
  getCtaBattlePassProgress,
  saveCtaBattlePassProgress,
  type BattlePassProgressPayload,
} from "@/lib/cta-api";

const snapshot = (): BattlePassProgressPayload => {
  const s = useBattlePassStore.getState();
  return { claimed: s.claimed, docCounts: s.docCounts };
};

const isEmpty = (p: BattlePassProgressPayload): boolean =>
  !Object.values(p.claimed).some((a) => a.length > 0) &&
  !Object.values(p.docCounts).some((m) => Object.values(m).some((n) => n > 0));

export function BattlePassSync() {
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
      const server = await getCtaBattlePassProgress();
      if (!active || server === null) return;

      if (isEmpty(server)) {
        // В облаке пусто — засеваем его текущим локальным прогрессом.
        await saveCtaBattlePassProgress(snapshot());
      } else {
        // Сервер главнее — грузим в стор.
        useBattlePassStore.setState({ claimed: server.claimed, docCounts: server.docCounts });
      }
      hydrated.current = true; // ПОСЛЕ загрузки — чтобы не сейвить только что загруженное
    }

    supabase.auth.getUser().then(({ data }) => hydrate(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      hydrate(Boolean(session?.user)),
    );

    const unsub = useBattlePassStore.subscribe((s, prev) => {
      if (!loggedIn.current || !hydrated.current) return;
      if (s.claimed === prev.claimed && s.docCounts === prev.docCounts) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveCtaBattlePassProgress(snapshot()), 1200);
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
