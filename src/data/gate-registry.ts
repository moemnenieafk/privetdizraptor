/**
 * Канон gate-ключей + дефолты — источник имён и fail-safe значений гейтинга. Таблица
 * feature_gates в БД оверрайдит эти дефолты (что живьём рулит админ из матрицы); при
 * отсутствии строки/таблицы система деградирует на дефолты отсюда (R09i.1).
 *
 * Два рода ключей:
 *  - kind:'feature' — точечные фичи, оборачиваемые <Paywall gate="…"> / requireTier('…').
 *    Добавление нового гейта = одна строка сюда + оборачивание точки.
 *  - kind:'section' — разделы портала, генерятся ДЕТЕРМИНИРОВАННО из HEADER_DICTIONARY:
 *    любой узел меню с `path` даёт section-ключ `sec:<game>:<path>` (см. sectionGatesFromHeader).
 *
 * Чистые данные/функции без БД — реестр читают и сервер (resolve.ts), и билдер миграции.
 */

import { HEADER_DICTIONARY, type MenuItem } from './headerConfig';
import { FEATURE_MIN_TIER } from './subscription-tiers';

export type GateKind = 'section' | 'feature';
export type GateBehavior = 'lock' | 'hide' | 'teaser';

export interface GateDef {
  key: string;
  label: string;
  category: string;
  kind: GateKind;
  defaultMinTier: string;
  defaultBehavior: GateBehavior;
}

/** Ключ гейта — string (slug фичи или sec:<game>:<path>). */
export type GateKey = string;

/** Человекочитаемые лейблы 10 текущих фич-ключей (для матрицы админки). */
const FEATURE_LABELS: Record<string, string> = {
  favorites: 'Избранное',
  flea_price_sync: 'Синхронизация цен барахолки',
  trader_vs_flea: 'Торговец против барахолки',
  weapon_builds: 'Сборки оружия (облако/без лимита)',
  ai_options: 'ИИ-подсказки',
  cloud_sync: 'Облачная синхронизация',
  advanced_analytics: 'Продвинутая аналитика',
  early_access: 'Ранний доступ',
  role_insights: 'Аналитика роли',
  game_changes: 'Изменения игры',
};

/**
 * 10 текущих фич-гейтов, мигрированных 1:1 из FEATURE_MIN_TIER. behavior по умолчанию
 * 'lock' (апселл). Порядок и слаги сохранены — существующие <Paywall feature="…">
 * компилируются без правки.
 */
export const GATE_REGISTRY: GateDef[] = (
  Object.keys(FEATURE_MIN_TIER) as (keyof typeof FEATURE_MIN_TIER)[]
).map((key) => ({
  key,
  label: FEATURE_LABELS[key] ?? key,
  category: 'Функции',
  kind: 'feature' as const,
  defaultMinTier: FEATURE_MIN_TIER[key],
  defaultBehavior: 'lock' as const,
}));

/** Игры, чьи разделы гейтятся из коробки. Пока EFT (эталон); расширяется по мере игр. */
const GATED_GAMES: readonly string[] = ['eft'];

// Рекурсивный обход дерева меню: узлы приходят и через children, и через subItems.
function walkMenu(items: readonly MenuItem[] | undefined, visit: (node: MenuItem) => void): void {
  if (!items) return;
  for (const node of items) {
    visit(node);
    walkMenu(node.children, visit);
    walkMenu(node.subItems, visit);
  }
}

/**
 * Собирает section-гейты из HEADER_DICTIONARY детерминированно: каждый узел с `path`
 * даёт ключ `sec:<game>:<path>` с дефолтом free/lock. Критерий «раздел» = наличие
 * реального маршрута (path), а не ручной отбор → любой раздел портала гейтится сразу.
 * Дедуп по ключу (один и тот же path может встретиться в разных ветках).
 */
export function sectionGatesFromHeader(): GateDef[] {
  const seen = new Set<string>();
  const defs: GateDef[] = [];

  for (const game of GATED_GAMES) {
    const config = HEADER_DICTIONARY[game];
    if (!config) continue;
    walkMenu(config.menuItems, (node) => {
      if (!node.path) return;
      const key = `sec:${game}:${node.path}`;
      if (seen.has(key)) return;
      seen.add(key);
      defs.push({
        key,
        label: node.label,
        category: 'Разделы',
        kind: 'section',
        defaultMinTier: 'free',
        defaultBehavior: 'lock',
      });
    });
  }

  return defs;
}

// Ленивая мемоизация: секции обходят всё дерево HEADER_DICTIONARY — считаем один раз.
// Порядок сохранён (фичи, затем секции в порядке обхода); Map строится из того же массива.
let cachedDefs: GateDef[] | null = null;
let cachedByKey: Map<string, GateDef> | null = null;

/** Все определения гейтов: фичи + секции. Собирается один раз, дальше из кеша. */
export function allGateDefs(): GateDef[] {
  if (!cachedDefs) {
    cachedDefs = [...GATE_REGISTRY, ...sectionGatesFromHeader()];
  }
  return cachedDefs;
}

function gateDefByKey(): Map<string, GateDef> {
  if (!cachedByKey) {
    cachedByKey = new Map(allGateDefs().map((g) => [g.key, g]));
  }
  return cachedByKey;
}

/** Быстрый доступ к дефолту по ключу (feature + секции), O(1) из мемо-Map. */
export function defaultGate(key: string): { minTier: string; behavior: GateBehavior; enabled: boolean } {
  const def = gateDefByKey().get(key);
  if (!def) return { minTier: 'free', behavior: 'lock', enabled: true };
  return { minTier: def.defaultMinTier, behavior: def.defaultBehavior, enabled: true };
}
