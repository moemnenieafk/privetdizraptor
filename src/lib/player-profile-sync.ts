// Мост снапшот ⇄ клиентские сторы (Слой B). Слой B ведёт ТОЛЬКО рич-вью ЧВК (usePmcStatsStore) +
// ручные оверрайды (useManualProfileStore, Слой C). Идентичность (usePlayerStore) синкает СЛОЙ 4d
// (PlayerProfileSync) — здесь не трогаем, чтобы системы не конкурировали. Серверная запись —
// savePlayerProfileAction. Спека: docs/decisions/player-profile-persistence.md.
import { usePlayerStore } from "@/store/usePlayerStore";
import { usePmcStatsStore } from "@/store/usePmcStatsStore";
import { useManualProfileStore, currentManualOverrides } from "@/store/useManualProfileStore";
import type {
  PlayerManualOverrides,
  PlayerProfileSnapshot,
  ProfileSource,
} from "@/types/eft-player";

/** Снимок текущего состояния сторов → снапшот для сохранения (сервер/localStorage).
 *  manual по умолчанию берётся из useManualProfileStore (Слой C); передать явно можно для override. */
export function buildSnapshot(source: ProfileSource, manual?: PlayerManualOverrides): PlayerProfileSnapshot {
  const overrides = manual ?? currentManualOverrides();
  return {
    view: usePmcStatsStore.getState().view,
    ...(overrides ? { manual: overrides } : {}),
    source,
  };
}

/** Применить снапшот к сторам (сервер = точка истины для рич-вью + оверрайдов). */
export function applySnapshot(snapshot: PlayerProfileSnapshot): void {
  usePmcStatsStore.getState().setView(snapshot.view);

  // Ручные оверрайды (Слой C) → гидрируем manual-стор (заменяем, сервер = истина).
  useManualProfileStore.getState().replaceAll(snapshot.manual ?? {});

  // Ручные трейдеры — write-through в traderLevels (их читает весь сайт; сам traderLevels синкает 4d).
  applyManualTraders(snapshot.manual?.traders);
}

/** Write-through ручных уровней трейдеров в usePlayerStore.traderLevels (их читает весь сайт). */
function applyManualTraders(traders?: Record<string, number>): void {
  if (!traders || Object.keys(traders).length === 0) return;
  const ps = usePlayerStore.getState();
  const active = ps.profiles.find((p) => p.id === ps.activeProfileId) ?? ps.profiles[0];
  if (!active) return;
  ps.updateProfile(active.id, { traderLevels: { ...active.traderLevels, ...traders } });
}

/** Есть ли что мигрировать в облако: локально загружена рич-вью. */
export function hasLocalProfile(): boolean {
  return usePmcStatsStore.getState().view != null;
}
