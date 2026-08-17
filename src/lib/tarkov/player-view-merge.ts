// Мерж загруженной вью-модели (usePmcStatsStore.view) с ручными оверрайдами (useManualProfileStore).
// Чистые хелперы (§4.7): last-write-wins по полю — ручной ввод бьёт загруженное (спека
// player-profile-persistence). Работают и при view=null (аноним без загрузки): источник = только manual.
import type { PlayerManualOverrides, PlayerSkillView, PlayerView } from '@/types/eft-player';

/** Уровень навыка id с учётом оверрайда: manual ?? загруженное ?? 0. */
export function resolveSkillLevel(
  view: PlayerView | null,
  manual: Record<string, number>,
  id: string,
): number {
  if (manual[id] != null) return manual[id];
  const found = view?.skills.find((s) => s.id === id);
  return found?.level ?? 0;
}

/** Уровень станции type: manual ?? загруженное ?? 0. */
export function resolveHideoutLevel(
  view: PlayerView | null,
  manual: Record<string, number>,
  type: number,
): number {
  const key = String(type);
  if (manual[key] != null) return manual[key];
  const found = view?.hideout.find((h) => h.type === type);
  return found?.level ?? 0;
}

/**
 * Эффективный список навыков для read-only отображения (DossierPmcStats): загруженные, перекрытые
 * ручными, плюс ручные-только (нет в профиле). Только level>0, сортировка по уровню.
 */
export function effectiveSkills(
  view: PlayerView | null,
  manual: Record<string, number>,
): PlayerSkillView[] {
  const byId = new Map<string, number>();
  for (const s of view?.skills ?? []) byId.set(s.id, s.level);
  for (const [id, level] of Object.entries(manual)) byId.set(id, level);
  return [...byId.entries()]
    .filter(([, level]) => level > 0)
    .map(([id, level]) => ({ id, level }))
    .sort((a, b) => b.level - a.level);
}
