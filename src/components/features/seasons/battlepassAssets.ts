// Арт-подложки трекера БП (webp/png). Держим ЗДЕСЬ, а не в icons.css: icons.css — для
// монохромных масок-иконок (tint по токену), а это полноцветные декоративные подложки/свечения,
// которые кладутся через background-image. Прецедент — бывшие локальные REWARD_BG/BORDER_GLOW.
// Проводка ассетов редизайна 2026-08-14 (см. docs/decisions/battlepass-tracker.md).
const BASE = '/images/battlepass/ui';

export const BP_UI = {
  /** Фон арт-области карточки награды (атмосферный каземат KORD BREACH). */
  rewardBg: `${BASE}/reward-bg2.webp`,
  /** Прежний плоский фон — фолбэк/легаси. */
  rewardBgFlat: `${BASE}/reward-bg.webp`,
  /** Чертёж-подложка (тёмно-зелёный грид KORD-762) — под панель/пустые слоты. */
  seasonRewardBg: `${BASE}/season-reward-bg.webp`,
  /** Свечение-рамка состояния «получено» (сезонная бирюза #5FD5C0). */
  rewardDone: `${BASE}/reward-done.webp`,
  /** Свечение-рамка состояния «доступна к получению» (янтарь --primary). */
  rewardReady: `${BASE}/reward-ready.webp`,
  /** Базовое свечение-рамка (легаси). */
  borderGlow: `${BASE}/border-glow.webp`,

  // ── Гекс-трио — НЕ для страницы трекера ────────────────────────────────
  // Слоёный гексагональный «слот» (подложка → рамка → glow). Регистрируем на будущее
  // (нав/хаб-элемент сезонов), на трекере не рендерится. См. решение, п. «гекс-трио».
  hexSubstrate: `${BASE}/substrate-seasons.webp`,
  hexFrame: `${BASE}/frame-seasons.webp`,
  hexGlow: `${BASE}/season-glow.webp`,
} as const;
