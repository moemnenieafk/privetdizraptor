"use client";

// Слой 4d — мост между облачными игровыми профилями и usePlayerStore (монтируется в layout).
// На логине: грузит профили из БД в стор (или, если в облаке пусто, заливает текущий
// локальный). При изменении профилей — debounced-сохранение в БД. Сервер главнее при
// непустом облаке. Форму стора НЕ переписываем — только синк.
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePlayerStore } from "@/store/usePlayerStore";
import {
  getCtaPlayerProfile,
  saveCtaPlayerProfile,
  type PlayerProfilePayload,
} from "@/lib/cta-api";

const snapshot = (): PlayerProfilePayload => {
  const s = usePlayerStore.getState();
  return { profiles: s.profiles, activeProfileId: s.activeProfileId };
};

// Пусто = в облаке нет строки (локальный стор всегда имеет ≥1 профиль по умолчанию).
const isEmpty = (p: PlayerProfilePayload): boolean => p.profiles.length === 0;

export function PlayerProfileSync() {
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
      const server = await getCtaPlayerProfile();
      if (!active || server === null) return;

      if (isEmpty(server)) {
        // В облаке пусто — засеваем его текущим локальным.
        await saveCtaPlayerProfile(snapshot());
      } else {
        // Сервер главнее ПО СВОИМ полям, но НЕ теряем аддитивную EFT-стату (kills/deaths/kd/killed/
        // survived/experience/memberCategory), которой нет в облачной схеме слоя 4d: мержим облако
        // поверх локального профиля по id. Иначе detailed-стата затиралась при загрузке (bug).
        const local = usePlayerStore.getState().profiles;
        const merged = server.profiles.map((sp) => {
          const lp = local.find((p) => p.id === sp.id);
          return lp ? { ...lp, ...sp } : sp;
        });
        usePlayerStore.setState({ profiles: merged, activeProfileId: server.activeProfileId });
      }
      hydrated.current = true; // ПОСЛЕ загрузки — чтобы не сейвить только что загруженное
    }

    supabase.auth.getUser().then(({ data }) => hydrate(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      hydrate(Boolean(session?.user)),
    );

    const unsub = usePlayerStore.subscribe((s, prev) => {
      if (!loggedIn.current || !hydrated.current) return;
      if (s.profiles === prev.profiles && s.activeProfileId === prev.activeProfileId) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveCtaPlayerProfile(snapshot()), 1200);
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
