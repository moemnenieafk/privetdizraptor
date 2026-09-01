// Результат распознавания профиля игрока со скриншота (Gemini Vision).
// Любое нечитаемое поле — null, чтобы пользователь дозаполнил вручную.

export type ProfileEdition = 'Standard' | 'LB' | 'PFE' | 'EOD' | 'TUE';

export interface ProfileOcrResult {
  nickname: string | null;
  level: number | null;
  prestige: number | null;
  edition: ProfileEdition | null;
  faction: 'USEC' | 'BEAR' | null;
  mode: 'PVP' | 'PVE' | 'SEASON' | null;
  hoursPlayed: number | null;
  raids: number | null;
  survivalRate: number | null;
}
