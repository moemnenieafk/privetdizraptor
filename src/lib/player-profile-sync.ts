// Мост снапшот ⇄ клиентские сторы (Слой B). Читает/пишет usePlayerStore (идентичность) +
// usePmcStatsStore (рич-вью) вне React, через getState. Серверная запись — savePlayerProfileAction.
// Спека: docs/decisions/player-profile-persistence.md.
import { usePlayerStore, type PlayerProfile } from "@/store/usePlayerStore";
import { usePmcStatsStore } from "@/store/usePmcStatsStore";
import type {
  PlayerIdentitySnapshot,
  PlayerManualOverrides,
  PlayerProfileSnapshot,
  ProfileSource,
} from "@/types/eft-player";

/** Активный локальный профиль (идентичность) → плоский снапшот. */
function identityOf(p: PlayerProfile): PlayerIdentitySnapshot {
  return {
    nickname: p.nickname,
    faction: p.faction,
    edition: p.edition,
    level: p.level,
    prestige: p.prestige,
    experience: p.experience ?? null,
    memberCategory: p.memberCategory ?? null,
    raids: p.raids,
    survivalRate: p.survivalRate,
    hoursPlayed: p.hoursPlayed,
    kills: p.kills ?? null,
    deaths: p.deaths ?? null,
    killed: p.killed ?? null,
    survived: p.survived ?? null,
    kd: p.kd ?? null,
    traderLevels: p.traderLevels,
  };
}

/** Снимок текущего состояния сторов → снапшот для сохранения (сервер/localStorage). */
export function buildSnapshot(source: ProfileSource, manual?: PlayerManualOverrides): PlayerProfileSnapshot {
  const ps = usePlayerStore.getState();
  const active = ps.profiles.find((p) => p.id === ps.activeProfileId) ?? ps.profiles[0] ?? null;
  return {
    view: usePmcStatsStore.getState().view,
    identity: active ? identityOf(active) : null,
    ...(manual ? { manual } : {}),
    source,
  };
}

/** Применить снапшот к сторам (сервер = точка истины). Пустые поля не затираем осмысленным. */
export function applySnapshot(snapshot: PlayerProfileSnapshot): void {
  usePmcStatsStore.getState().setView(snapshot.view);

  const id = snapshot.identity;
  if (!id) return;
  const ps = usePlayerStore.getState();
  ps.updateProfile(ps.activeProfileId, {
    ...(id.nickname != null ? { nickname: id.nickname } : {}),
    ...(id.faction != null ? { faction: id.faction } : {}),
    ...(id.edition != null ? { edition: id.edition as PlayerProfile["edition"] } : {}),
    ...(id.level != null ? { level: id.level } : {}),
    ...(id.prestige != null ? { prestige: id.prestige } : {}),
    experience: id.experience ?? null,
    memberCategory: id.memberCategory ?? null,
    raids: id.raids ?? null,
    survivalRate: id.survivalRate ?? null,
    hoursPlayed: id.hoursPlayed ?? null,
    kills: id.kills ?? null,
    deaths: id.deaths ?? null,
    killed: id.killed ?? null,
    survived: id.survived ?? null,
    kd: id.kd ?? null,
    ...(id.traderLevels ? { traderLevels: id.traderLevels } : {}),
  });
}

/** Есть ли что мигрировать в облако: локально загружена рич-вью. */
export function hasLocalProfile(): boolean {
  return usePmcStatsStore.getState().view != null;
}
