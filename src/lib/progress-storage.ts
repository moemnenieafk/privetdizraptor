// localStorage-ключи прогресса игрока (EFT). Единый список для полного сброса игры:
// GameResetCard (Профиль) и заглавная кнопка сброса во вкладке «Трекинг».
// БД чистит POST /api/account/reset-progress (resetCtaProgress) — ключи здесь только клиентские.
export const PROGRESS_KEYS = [
  'cta-quest-progress',
  'cta-barter-gamification',
  'cta-hideout',
  'player-profile-storage',
  'cta-achievement-progress',
  'cta-weapon-builds',
] as const;

export function clearProgressStorage(): void {
  for (const k of PROGRESS_KEYS) localStorage.removeItem(k);
}