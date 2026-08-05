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

// Легендарное достижение с РЕАЛЬНЫМ BSG-id, которого нет в зеркале tarkov.dev.
// Живёт статикой по той же причине, что и сезонные: крон-реконсиляция снесла бы
// строку в БД (id не в keep-set tarkov.dev). Дедуп в ридере отдаст приоритет
// зеркалу, если оно когда-нибудь догонит этот id.
const legendary = (
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
  rarity: "Легендарные",
  normalizedRarity: "legendary",
  side: "All",
  normalizedSide: "all",
});

const SEASONAL: AchievementView[] = [
  seasonal(
    "6a59f4d4ceec2980f10364db",
    "Одна хорошо, а две лучше",
    "Получить защищённый контейнер «Каппа», выбрав модификатор «Kappa Protocol».",
    0,
  ),
  seasonal(
    "6a59f4df6a7772c9a60bebf7",
    "Генетическая лотерея",
    "Получить 30 уровень сезонного персонажа, выбрав модификаторы: гемофилия, остеопороз, полидипсия, аллергик, третья нога.",
    0,
  ),
  seasonal(
    "6a59f4e565aa8755e000b959",
    "Хардкор у нас дома",
    "Получить защищённый контейнер «Каппа», выбрав модификаторы: неработающая барахолка и сломанный защищённый контейнер.",
    0,
  ),
  seasonal(
    "6a59f4eaacaee8fa5d013978",
    "И это, по-твоему, челлендж?",
    "Выполнить все задания «Путь выживальщика», выбрав 5 любых модификаторов из списка: марафонец, молодость, геркулес, тромбофилия, гиподипсия, полифагия, крепкие кости, вундеркинд.",
    0,
  ),
  seasonal(
    "6a59f4f3fd4d9547d50ecfdd",
    "Предприниматель от бога",
    "Иметь одновременно 500 миллионов рублей и по 1 миллиону евро и долларов, выбрав модификатор «Бизнесмен».",
    0,
  ),
  seasonal(
    "6a68dd058a4444b9f6035b51",
    "Деньги не пахнут?",
    "Пройти цепочку заданий Скупщика в сезоне KORD BREACH и передать ноутбук с неизвестного объекта Механику или Скупщику.",
    0,
  ),
  seasonal("6a59f494033e98046303c376", "Беливер", "Получить 30 уровень сезонного персонажа.", 0.2),
  seasonal(
    "6a59f4bfacaee8fa5d013977",
    "Помощь не нужна",
    "Получить 30 уровень сезонного персонажа, не выбрав ни одного модификатора из списка «Личные положительные».",
    0.2,
  ),
  seasonal(
    "6a59f4ce033e98046303c377",
    "У меня был план и я его придерживался",
    "Получить 30 уровень сезонного персонажа, выбрав 10 модификаторов из списка «Личные отрицательные».",
    0,
  ),
  seasonal(
    "6a59f4a8ab4f251a6e02e45c",
    "Совершенно Секретно",
    "Иметь в инвентаре документацию TerraGroup каждого типа, кроме Секретной.",
    0,
  ),
  seasonal(
    "6a59f4ae68241e13f50367b4",
    "Imposter",
    "Убить 100 бойцов Black Division, используя их снаряжение.",
    0.1,
  ),
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

// Легендарные достижения (реальный BSG-id), которых нет в зеркале. «Рассвет новой эпохи» —
// Каппа на ОСНОВНОМ персонаже (не сезонный тир, уточнил V4DYA); эмблема золотая, без «I».
const LEGENDARY_STATIC: AchievementView[] = [
  legendary(
    "6a60f6f7d97ca215e600b6c4",
    "Рассвет новой эпохи",
    "Получить защищённый контейнер «Каппа» после появления системы сезонов.",
    0.1,
  ),
];

// Всё, что мёржим поверх зеркала в ридере (крон эти строки не трогает — их нет в tarkov.dev).
export const STATIC_ACHIEVEMENTS_EFT: AchievementView[] = [...SEASONAL, ...LEGENDARY_STATIC];
