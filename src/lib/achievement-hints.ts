// SMART-подсказка «как получить» — авто-резолвер (первая половина «гибрида»).
// tarkov.dev НЕ отдаёт структурных требований достижения — только короткое описание.
// Но boss-килл достижения прямо называют босса («Впервые убить Санитара…»), часть — карту
// или торговца. Резолвер извлекает эти связи по совпадению имён + учитывает ручные оверрайды.
//
// Pure-модуль: BOSSES статичны, а maps/traders приходят параметром (в RSC — из нашей БД).
import { BOSSES } from "@/data/bosses";
import { ACHIEVEMENT_HINT_OVERRIDES } from "@/data/achievement-hints";

export type HintKind = "boss" | "map" | "trader" | "quest";

export interface HintLink {
  kind: HintKind;
  label: string;
  sub?: string;
  href: string;
  portrait?: string;
}

export interface AchievementHint {
  links: HintLink[];
  tip?: string;
}

export interface HintDataset {
  maps: { name: string; normalizedName: string }[];
  traders: { name: string; normalizedName: string }[];
}

export interface HintTarget {
  id: string;
  name: string;
  description: string;
}

// Стем для рус. имён: срезаем хвостовую гласную, чтобы ловить косвенные падежи
// (Тагилла→Тагилл ⇒ ловит «Тагиллу»; Санитар→Санитар ⇒ ловит «Санитара»).
function stem(s: string): string {
  const t = s.trim();
  return t.length > 4 && /[аяеёиоуыэюй]$/i.test(t) ? t.slice(0, -1) : t;
}

// Регистрозависимо: имена собственные в описаниях с заглавной («на локации Завод»),
// что отсекает ложные срабатывания внутри слов («лесопилка» ≠ «Лес»).
function mentions(haystack: string, name: string): boolean {
  const s = stem(name);
  return s.length >= 3 && haystack.includes(s);
}

export function resolveAchievementHint(ach: HintTarget, data: HintDataset): AchievementHint {
  const ov = ACHIEVEMENT_HINT_OVERRIDES[ach.id];
  const hay = `${ach.name} ${ach.description}`;

  const links: HintLink[] = [];
  const seen = new Set<string>();
  const push = (l: HintLink) => {
    const k = `${l.kind}:${l.href}`;
    if (!seen.has(k)) {
      seen.add(k);
      links.push(l);
    }
  };

  const addBoss = (slug: string) => {
    const b = BOSSES.find((x) => x.slug === slug);
    if (b) push({ kind: "boss", label: b.nameRu, sub: b.location, href: `/eft/gamesetting/bosses/${b.slug}`, portrait: b.portrait });
  };
  const addMap = (normalizedName: string, label?: string) =>
    push({ kind: "map", label: label ?? normalizedName, href: `/eft/maps/${normalizedName}` });
  const addTrader = (normalizedName: string, label?: string) =>
    push({ kind: "trader", label: label ?? normalizedName, href: `/eft/quests/${normalizedName}` });

  // 1) Ручные оверрайды — приоритет.
  ov?.bossSlugs?.forEach(addBoss);
  ov?.mapSlugs?.forEach((nn) => addMap(nn, data.maps.find((m) => m.normalizedName === nn)?.name));
  ov?.traderNames?.forEach((nn) => addTrader(nn, data.traders.find((t) => t.normalizedName === nn)?.name));
  ov?.questIds?.forEach((q) => push({ kind: "quest", label: "Открыть на карте квестов", href: `/eft/questmap?quest=${q}` }));

  // 2) Авто-матч по именам (если оверрайд не запретил).
  if (!ov?.suppressAuto) {
    for (const b of BOSSES) {
      if (mentions(hay, b.nameRu) || (b.nameEn.length >= 4 && hay.includes(b.nameEn))) addBoss(b.slug);
    }
    for (const m of data.maps) if (mentions(hay, m.name)) addMap(m.normalizedName, m.name);
    for (const t of data.traders) if (mentions(hay, t.name)) addTrader(t.normalizedName, t.name);
  }

  return { links, tip: ov?.tip };
}
