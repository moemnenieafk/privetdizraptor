// Ручные оверрайды SMART-подсказок достижений — вторая половина «гибрида».
// Авто-резолвер (src/lib/achievement-hints.ts) связывает достижение с боссами/картами/
// торговцами по совпадению имён в описании. Здесь — ручные уточнения для случаев, где
// авто-матч промахивается или недостаточен (событийные цепочки, скрытые условия, «пасхалки»).
//
// Ключ — id достижения (BSG id, как в tarkov.dev). Заполнять по мере необходимости —
// без оверрайда достижение всё равно обслуживается авто-резолвером.

export interface AchievementHintOverride {
  /** slugs боссов из src/data/bosses.ts */
  bossSlugs?: string[];
  /** normalizedName карт (customs, woods, …) */
  mapSlugs?: string[];
  /** normalizedName торговцев (prapor, skier, …) */
  traderNames?: string[];
  /** id квестов для deep-link на карту квестов */
  questIds?: string[];
  /** свободный текст-подсказка «как получить» (для событийных/неструктурных условий) */
  tip?: string;
  /** отключить авто-матч для этого достижения (когда он даёт ложные связи) */
  suppressAuto?: boolean;
}

export const ACHIEVEMENT_HINT_OVERRIDES: Record<string, AchievementHintOverride> = {
  // Пример формы (реальные id заполняются по мере кураторки):
  // "6512ea46f7a078264a4376e4": {
  //   traderNames: ["skier"],
  //   tip: "Событие «Casus Belli»: помогите Лыжнику сорвать сезон на Арене.",
  //   suppressAuto: true,
  // },
};
