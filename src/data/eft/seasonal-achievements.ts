// Сезонные достижения EFT (тир «Сезонные», добавлен патчем 1.1.0 «KORD BREACH»).
//
// ПОЧЕМУ СТАТИКА, А НЕ ЗЕРКАЛО: этих достижений НЕТ в tarkov.dev (концепт 1.1.0; §4.12 —
// на живой tarkov.dev не опираемся). Крон `syncEftLandingData()` реконсилит таблицу
// `achievements` через `delete where id NOT IN <tarkov.dev keep>` — ручные строки он бы
// СТЁР. Поэтому держим их как data-at-rest (паттерн /game-data-ingest, §4.11) и мёржим
// в ридере `getEftAchievements()` поверх зеркала. Крон их не трогает — их нет в БД.
//
// Источник: игровые скрины `docs/eft/codex/achievments/Достижения 01-06.png` (V4DYA, 1.1.0).
// Спека/инвентарь: `docs/decisions/seasonal-achievements-kord-breach.md`.
//
// id — синтетические стабильные `kbreach-<slug>` (в tarkov.dev их нет). side = all
// (это прогрессия сезонного персонажа, не привязана к ЧВК/Дикому). Иконки — отдельный заход
// (пока плейсхолдер в синей рамке AchievementSeasonal). +23 скрытых достижения из скринов не взять.

import type { AchievementView } from "@/lib/achievement-visuals";

const seasonal = (
  slug: string,
  name: string,
  description: string,
  pct: number,
): AchievementView => ({
  id: `kbreach-${slug}`,
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

export const SEASONAL_ACHIEVEMENTS_EFT: AchievementView[] = [
  seasonal(
    "kappa-both",
    "Одна хорошо, а две лучше",
    "Получить защищённый контейнер «Каппа», выбрав модификатор «Kappa Protocol».",
    0,
  ),
  seasonal(
    "genetic-lottery",
    "Генетическая лотерея",
    "Получить 30 уровень сезонного персонажа, выбрав модификаторы: гемофилия, остеопороз, полидипсия, аллергик, третья нога.",
    0,
  ),
  seasonal(
    "hardcore-home",
    "Хардкор у нас дома",
    "Получить защищённый контейнер «Каппа», выбрав модификаторы: неработающая барахолка и сломанный защищённый контейнер.",
    0,
  ),
  seasonal(
    "some-challenge",
    "И это, по-твоему, челлендж?",
    "Выполнить все задания «Путь выживальщика», выбрав 5 любых модификаторов из списка: марафонец, молодость, геркулес, тромбофилия, гиподипсия, полифагия, крепкие кости, вундеркинд.",
    0,
  ),
  seasonal(
    "godlike-businessman",
    "Предприниматель от бога",
    "Иметь одновременно 500 миллионов рублей и по 1 миллиону евро и долларов, выбрав модификатор «Бизнесмен».",
    0,
  ),
  seasonal(
    "money-no-smell",
    "Деньги не пахнут?",
    "Пройти цепочку заданий Скупщика в сезоне KORD BREACH и передать ноутбук с неизвестного объекта Механику или Скупщику.",
    0,
  ),
  seasonal("believer", "Беливер", "Получить 30 уровень сезонного персонажа.", 0.2),
  seasonal(
    "help-not-needed",
    "Помощь не нужна",
    "Получить 30 уровень сезонного персонажа, не выбрав ни одного модификатора из списка «Личные положительные».",
    0.2,
  ),
  seasonal(
    "had-a-plan",
    "У меня был план и я его придерживался",
    "Получить 30 уровень сезонного персонажа, выбрав 10 модификаторов из списка «Личные отрицательные».",
    0,
  ),
  seasonal(
    "new-era-dawn",
    "Рассвет новой эпохи",
    "Получить защищённый контейнер «Каппа» после появления системы сезонов.",
    0.1,
  ),
];
