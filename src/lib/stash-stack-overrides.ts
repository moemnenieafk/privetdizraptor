// src/lib/stash-stack-overrides.ts
// Известные стек-лимиты для НЕ-ammo стекуемых предметов (деньги).
// tarkov.dev-дамп отдаёт stackMaxSize только патронам (ItemPropertiesAmmo);
// у денег стек-лимиты — известные константы EFT, задаём их здесь.
// Всё прочее в игре не стекается → undefined (трактуется как стек=1).

const STACK_MAX_BY_ID: Record<string, number> = {
  '5449016a4bdc2d6f028b456f': 500000, // Roubles
  '5696686a4bdc2da3298b456a': 50000, // Dollars
  '569668774bdc2da2298b4568': 50000, // Euros
};

/** Стек-лимит известных не-ammo стекуемых (деньги) по inGameId; прочее → undefined. */
export function stackMaxOverride(inGameId: string): number | undefined {
  return STACK_MAX_BY_ID[inGameId];
}
