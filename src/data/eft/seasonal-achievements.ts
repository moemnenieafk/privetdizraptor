// Статические достижения EFT, которых НЕТ в зеркале tarkov.dev:
// сезонный тир 1.1.0 «KORD BREACH» + отдельные легендарные (real-id, зеркало пока не догнало).
//
// ПОЧЕМУ СТАТИКА, А НЕ ЗЕРКАЛО: этих достижений НЕТ в tarkov.dev (концепт 1.1.0; §4.12 —
// на живой tarkov.dev не опираемся). Крон `syncEftLandingData()` реконсилит таблицу
// `achievements` через `delete where id NOT IN <tarkov.dev keep>` — ручные строки он бы
// СТЁР. Поэтому держим их как data-at-rest (паттерн /game-data-ingest, §4.11) и мёржим
// в ридере `getEftAchievements()` поверх зеркала. Крон их не трогает — их нет в БД.
//
// id: реальные BSG achievement-id (24-hex) где известны, иначе синтетические `kbreach-<slug>`
// (3 достижения из видео-плиток — их id tarkov.dev не знает). Эмблемы (512px из мастеров V4DYA)
// лежат в `public/images/achievements/eft/<id>.webp` → резолвятся `achievement-icon.ts` по id.
//
// Источник текста: игровые скрины `docs/eft/codex/achievments/`. Спека:
// `docs/decisions/seasonal-achievements-kord-breach.md`. side=all (прогрессия сезонного
// персонажа, не ЧВК/Дикий). +23 скрытых достижения в кэше/скринах не раскрыты.

import type { AchievementView } from "@/lib/achievement-visuals";

const seasonal = (
  id: string,
  name: string,
  description: string,
  pct: number,
): AchievementView => ({
  id,
  name,
  description,
  hidden: false,
  playersCompletedPercent: pct,
  adjustedPlayersCompletedPercent: pct,
  rarity: "Seasonal",
  normalizedRarity: "seasonal",
  side: "All",
  normalizedSide: "all",
});

const SEASONAL: AchievementView[] = [
  // +3 из видео-плиток сезона (docs V4DYA) — синтетические id kbreach-* (в tarkov.dev их нет).
  seasonal(
    "kbreach-first-step",
    "Первый шаг",
    "Получить ранг «Выживший» в лигах.",
    0,
  ),
  seasonal(
    "kbreach-to-the-top",
    "Достигнуть вершины",
    "Получить финальный ранг «Дирижёр» в лигах.",
    0,
  ),
  seasonal(
    "kbreach-spring-comes",
    "Весна пришла",
    "Получить все отрицательные эффекты до аллергии в одном рейде, выбрав модификатор «Аллергик».",
    0,
  ),
];

// Всё, что мёржим поверх зеркала в ридере (крон эти строки не трогает — их нет в tarkov.dev).
// Остались только синтетические kbreach-* (видео-плитки, реального BSG-id нет). Остальные
// сезонные/легендарные KORD BREACH зеркало догнало под real-id → отданы зеркалу, дубли удалены.
export const STATIC_ACHIEVEMENTS_EFT: AchievementView[] = [...SEASONAL];
