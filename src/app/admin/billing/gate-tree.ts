// Клиент-безопасная сборка ДЕРЕВА гейтов для матрицы админки. Источник иерархии —
// HEADER_DICTIONARY['eft'].menuItems (плоско импортируемые данные, без БД): каждый узел
// меню с `path` → gate-ключ `sec:eft:<path>`, к нему подтягиваются icon/label/description.
// 10 фич-ключей (kind:'feature', узла в меню нет) собираются в синтетическую группу «Функции».
// Дерево здесь — только СТРУКТУРА+МЕТА (иконка/описание); эффективные minTier/behavior/enabled
// приходят из плоского gates[] и мёржатся на рендере в GateMatrixClient по ключу.

import { HEADER_DICTIONARY, type MenuItem } from '@/data/headerConfig';

const GAME = 'eft';

/** Узел дерева гейтов: либо лист-гейт (есть key), либо контейнер-заголовок (key=null, но с детьми). */
export interface GateTreeNode {
  /** gate-ключ (`sec:eft:<path>` или slug фичи) — есть только у узлов с реальным гейтом. */
  key: string | null;
  label: string;
  description?: string;
  /** Маска-иконка (SVG) — приоритетна над iconClass, как в SectionHubNav. */
  iconUrl?: string;
  /** Класс монохромной иконки (fallback, когда нет iconUrl). */
  iconClass?: string;
  /** lucide-имя иконки для узлов без графики меню (группа «Функции»). */
  lucideIcon?: 'Lock' | 'Sparkles';
  children: GateTreeNode[];
}

/** Короткие RU-описания 10 фич-ключей (в меню их нет — задаём тут). */
const FEATURE_META: Record<string, { description: string }> = {
  favorites: { description: 'Личный список избранных предметов и разделов.' },
  flea_price_sync: { description: 'Живая синхронизация цен барахолки в карточках.' },
  trader_vs_flea: { description: 'Сравнение выгоды: продать торговцу или на барахолку.' },
  weapon_builds: { description: 'Облачные сборки оружия без лимита слотов.' },
  ai_options: { description: 'ИИ-подсказки и авто-рекомендации по сборкам и рейдам.' },
  cloud_sync: { description: 'Облачная синхронизация прогресса между устройствами.' },
  advanced_analytics: { description: 'Продвинутая аналитика профиля и экономики.' },
  early_access: { description: 'Ранний доступ к новым разделам и фичам портала.' },
  role_insights: { description: 'Аналитика игровой роли и боевой эффективности.' },
  game_changes: { description: 'Разбор изменений патчей: статы, торговцы, крафты, квесты.' },
};

/** Порядок и лейблы фич-группы. Ключи должны совпадать с kind:'feature' из gate-registry. */
const FEATURE_ORDER = Object.keys(FEATURE_META);

/**
 * Строит узел «Функции» — синтетическую группу-контейнер с 10 фич-листьями.
 * Лейблы берутся из переданной карты key→label (эффективный лейбл из gates[]).
 */
function buildFeatureGroup(labelByKey: Map<string, string>): GateTreeNode {
  const children: GateTreeNode[] = FEATURE_ORDER.filter((k) => labelByKey.has(k)).map((k) => ({
    key: k,
    label: labelByKey.get(k) ?? k,
    description: FEATURE_META[k]?.description,
    lucideIcon: 'Sparkles' as const,
    children: [],
  }));
  return {
    key: null,
    label: 'Функции',
    lucideIcon: 'Lock',
    children,
  };
}

/** MenuItem → узел дерева: path даёт gate-ключ, иначе key=null (контейнер-заголовок). */
function fromMenuItem(node: MenuItem): GateTreeNode {
  const rawChildren = [...(node.children ?? []), ...(node.subItems ?? [])];
  return {
    key: node.path ? `sec:${GAME}:${node.path}` : null,
    label: node.label,
    description: node.description,
    iconUrl: node.iconUrl,
    iconClass: node.iconClass,
    children: rawChildren.map(fromMenuItem),
  };
}

/**
 * Обрезает дерево до узлов, реально несущих гейт: лист без key и без гейт-детей выкидывается,
 * контейнер (key=null) остаётся только если под ним есть хоть один узел с key. Так матрица
 * показывает ровно то, что есть в gates[] (полный список гейтов), без пустых заглушек.
 */
function prune(node: GateTreeNode, hasKey: (k: string) => boolean): GateTreeNode | null {
  const children = node.children
    .map((c) => prune(c, hasKey))
    .filter((c): c is GateTreeNode => c !== null);
  const selfGated = node.key !== null && hasKey(node.key);
  if (!selfGated && children.length === 0) return null;
  return { ...node, children };
}

/**
 * Полное дерево групп для матрицы: сперва «Функции», затем разделы EFT в порядке меню.
 * @param gateKeys множество ключей из gates[] (полный список активных гейтов).
 * @param labelByKey эффективные лейблы (из gates[]) для фич-группы.
 */
export function buildGateTree(gateKeys: Set<string>, labelByKey: Map<string, string>): GateTreeNode[] {
  const hasKey = (k: string) => gateKeys.has(k);
  const groups: GateTreeNode[] = [buildFeatureGroup(labelByKey)];

  const menuItems = HEADER_DICTIONARY[GAME]?.menuItems ?? [];
  for (const top of menuItems) {
    const pruned = prune(fromMenuItem(top), hasKey);
    if (pruned) groups.push(pruned);
  }

  // «Функции» показываем, даже если пусто (маловероятно) — она первая и всегда осмысленна.
  return groups.filter((g) => g.key !== null || g.children.length > 0 || g.label === 'Функции');
}
