import type { Metadata } from 'next';
import { AdaptiveHubClient, type HubServerProps } from '@/components/features/adaptive/AdaptiveHubClient';
import { getMe } from '@/lib/auth/me';
import { getKarmaMap } from '@/db/comlink';
import { getCompanionKarma } from '@/db/companion-prices';
import { getPlayerProfileSnapshot } from '@/db/player-profile';
import { getKappaObjectiveIds } from '@/lib/kappa-objectives.server';

export const metadata: Metadata = { title: 'Досье игрока | ЦТА' };

// RSC-обёртка досье: карма — серверная (Drizzle owner-role, мимо RLS), клиент её не знает.
// Читаем существующими путями (getMe + getKarmaMap + getCompanionKarma), никаких новых
// сетевых вызовов (§4.11). Аноним → isAuthed:false (серверные части в UI → «войди»). Сбой
// читалок → serverError:true, но досье (localStorage-части) остаётся живым (§4.5).
async function loadServerSignals(): Promise<HubServerProps> {
  const anon: HubServerProps = {
    isAuthed: false,
    karmaComlink: null,
    karmaComlinkTier: null,
    karmaCompanion: null,
  };

  let me;
  try {
    me = await getMe();
  } catch {
    return anon;
  }
  if (!me) return anon;

  try {
    const [karmaMap, companion, profileSnapshot] = await Promise.all([
      getKarmaMap([me.id]),
      getCompanionKarma(me.id),
      getPlayerProfileSnapshot(me.id),
    ]);
    const comlink = karmaMap.get(me.id) ?? null;
    return {
      isAuthed: true,
      karmaComlink: comlink?.total ?? 0,
      karmaComlinkTier: comlink?.tierLabel ?? null,
      karmaCompanion: companion,
      profileSnapshot,
    };
  } catch {
    // Залогинен, но Supabase/Drizzle недоступен — серверные панели в «—», досье живёт.
    return { isAuthed: true, karmaComlink: null, karmaComlinkTier: null, karmaCompanion: null, serverError: true };
  }
}

export default async function AdaptiveHubPage() {
  const server = await loadServerSignals();
  // Набор id'ов Каппы (статичен, из EFT_QUESTS) — чтобы блок и инференс жили на холодном хабе (факт B).
  const kappaObjectiveIds = getKappaObjectiveIds();

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-4 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        {/* Шапка (HubNav) и весь досье-визуал — внутри клиента: заголовок/навигация по разделу
            живут в DossierHubNav. Страница остаётся RSC-обёрткой и прокидывает серверную карму. */}
        <AdaptiveHubClient {...server} kappaObjectiveIds={kappaObjectiveIds} />
      </div>
    </main>
  );
}
