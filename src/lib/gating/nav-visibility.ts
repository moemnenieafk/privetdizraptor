/**
 * Навигационный фильтр гейтинга — ЧИСТАЯ функция над снимком прав (без БД/React/server-only),
 * чтобы её мог звать и клиент (навигация через useEntitlements), и сервер. Решает, как
 * показать пункт меню, чей раздел гейтнут: показать / скрыть / замок-но-кликабельно.
 *
 * Section-ключ выводится детерминированно из `path` (`sec:<game>:<path>`) — тем же
 * форматом, что sectionGatesFromHeader. Явный MenuItem.gateKey переопределяет вывод
 * (для нестандартных ключей). Нет снимка/нет строки в карте → дефолт free → 'show'
 * (fail-safe: текущий бесплатный доступ не ломается, пока админ не поставит тир).
 */

import type { MenuItem } from '@/data/headerConfig';
import type { GatingSnapshot } from '@/components/features/subscription/GatingProvider';
import { meets, type TierLike } from '@/lib/gating/tiers';

/** Как навигация должна отрисовать пункт по вердикту гейта. */
export type NavGateVerdict = 'show' | 'hide' | 'lock';

/** Section-ключ узла: явный gateKey → как есть; иначе `sec:<game>:<path>` из path. */
export function sectionKeyOf(node: Pick<MenuItem, 'path' | 'gateKey'>, game: string = 'eft'): string | null {
  if (node.gateKey) return node.gateKey;
  if (!node.path) return null;
  return `sec:${game}:${node.path}`;
}

/**
 * Вердикт видимости пункта меню. Доступ есть или гейт free/enabled=false → 'show'.
 * Нет доступа: behavior='hide' → 'hide' (не рендерить), иначе → 'lock' (бейдж-замок,
 * но кликабельно — страница сама покажет апселл). Нет снимка → 'show' (fail-safe).
 */
export function visibleForGate(
  node: Pick<MenuItem, 'path' | 'gateKey'>,
  snapshot: GatingSnapshot | null,
  game: string = 'eft',
): NavGateVerdict {
  const key = sectionKeyOf(node, game);
  if (!key || !snapshot) return 'show';

  const gate = snapshot.gates[key];
  // Нет строки в карте (раздел не зарегистрирован / БД деградировала) → открыт.
  if (!gate) return 'show';

  const tierLikes: TierLike[] = snapshot.tiers.map((t) => ({ slug: t.slug, rank: t.rank }));
  if (meets(snapshot.rank, key, snapshot.gates, tierLikes)) return 'show';

  return gate.behavior === 'hide' ? 'hide' : 'lock';
}
