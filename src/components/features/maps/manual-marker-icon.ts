import * as L from 'leaflet';
import { markerIconUrl, markerColor, GOONS_FILES } from '@/data/map-marker-icons';
import { LOOT_CATEGORIES } from '@/data/map-markers/categories';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';

/**
 * Иконка маркера статик-карты (общая для редактора «Правка» и боевого рендера).
 * Приоритет: (1) loose loot с предметом → плитка «иконка предмета + тарковский цвет-фон»;
 * (2) loot с таксономией-категорией (редактор) → её icon-mask; (3) резолвер `markerIconUrl` —
 * цветной svg/webp как есть (БЕЗ перекраски); (4) глиф (hazard); (5) фигура-плейсхолдер.
 * Подпись — справа.
 */

const LOOT_ICON = new Map(LOOT_CATEGORIES.flatMap((g) => g.items).map((i) => [i.key, i.icon ?? '']));

const GLYPH: Record<string, string> = { hazard: '⚠' };

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export interface ManualMarkerLike {
  type: string;
  category?: string | null;
  label?: string | null;
  faction?: string | null;
  sides?: string[] | null;
  categories?: string[] | null;
  /** loose loot: id предмета для иконки из нашей базы. */
  linkedItemId?: string | null;
  /** спавн-босс (редактор, category='boss'): файл-портрет в /images/bosses/eft. */
  bossKey?: string | null;
  /** loose loot: тарковский цвет фона слота (blue/yellow/violet…). */
  itemBg?: string | null;
  /** выход: имя нужного предмета (transferItem) — для codeword-иконки. */
  transferItemName?: string | null;
  /** тип-специфичная нагрузка (hazard: {hazardType}, quest_zone: {objectiveKind}) для резолвера. */
  meta?: Record<string, unknown> | null;
  /** editorial: тип связи (story|event|…) — морфит quest-иконку в резолвере (Ф4). */
  linkKind?: string | null;
  /** лут-пул: сколько ДОП. предметов сверх первого (>0 → бейдж «+N» в углу капли). */
  badge?: number | null;
}

export function manualMarkerIcon(m: ManualMarkerLike, del = false, showLabel = false): L.DivIcon {
  const color = markerColor(m.type);
  const glow = del ? ';outline:2px solid #E5484D' : '';

  const isLooseItem = (m.type === 'loot_loose' || m.type === 'loot') && !!m.linkedItemId;
  const isGoons = m.type === 'spawn' && m.category === 'goons';
  const lootIcon = !isLooseItem && m.type === 'loot' && m.category ? LOOT_ICON.get(m.category) : undefined;
  const resolved = isLooseItem || isGoons || lootIcon ? null : markerIconUrl(m);

  let inner: string;
  let box: number;
  if (isGoons) {
    // Goons — трио боссов (Рыцарь/Биг Пайп/Бёрдай): 3 портрета внахлёст.
    box = 44;
    const imgs = GOONS_FILES.map(
      (f, i) =>
        `<img src="/images/bosses/eft/${f}.webp" width="20" height="20" style="display:block;width:20px;height:20px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))${i > 0 ? ';margin-left:-6px' : ''}${glow}" alt="" />`,
    ).join('');
    inner = `<span style="display:flex;align-items:center;justify-content:center">${imgs}</span>`;
  } else if (isLooseItem) {
    // Плитка предмета: иконка из нашей базы на тарковском цвет-фоне слота.
    box = 30;
    const bg = getTarkovBackgroundColor(m.itemBg ?? undefined);
    inner =
      `<span style="display:block;width:${box}px;height:${box}px;border-radius:3px;overflow:hidden;` +
      `background:${bg};border:1px solid rgba(255,255,255,.14);box-shadow:0 1px 3px rgba(0,0,0,.7)${glow}">` +
      `<img src="${itemIconUrl(m.linkedItemId!)}" width="${box}" height="${box}" alt="" ` +
      `style="display:block;width:100%;height:100%;object-fit:contain" ` +
      `onerror="this.style.display='none'" /></span>`;
  } else if (lootIcon) {
    box = 24;
    inner = `<span class="icon-mask ${lootIcon}" style="display:block;width:${box}px;height:${box}px;color:${color};filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))${glow}"></span>`;
  } else if (resolved?.mode === 'img') {
    box = resolved.size;
    inner = `<img src="${resolved.url}" width="${box}" height="${box}" style="display:block;width:${box}px;height:${box}px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))${del ? ';outline:2px solid #E5484D;border-radius:3px' : ''}" alt="" />`;
  } else if (resolved?.mode === 'mask') {
    box = resolved.size;
    inner = `<span style="display:block;width:${box}px;height:${box}px;background:${color};-webkit-mask:url(${resolved.url}) center/contain no-repeat;mask:url(${resolved.url}) center/contain no-repeat;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))${glow}"></span>`;
  } else if (GLYPH[m.type]) {
    box = 24;
    inner = `<span style="display:flex;align-items:center;justify-content:center;width:${box}px;height:${box}px;color:${color};font-size:20px${glow}">${GLYPH[m.type]}</span>`;
  } else {
    box = 18;
    const radius = m.type === 'container' || m.type === 'loot_container' ? '3px' : '50%';
    inner = `<span style="display:block;width:${box}px;height:${box}px;border-radius:${radius};background:${color};border:2px solid #141416;box-shadow:0 0 0 1px ${color}${del ? ',0 0 8px 2px #E5484D' : ''}"></span>`;
  }

  const labelHtml =
    showLabel && m.label
      ? `<span style="position:absolute;left:${box / 2 + 12}px;top:50%;transform:translateY(-50%);font-size:10px;color:#F2F2F2;text-shadow:0 1px 3px #000;white-space:nowrap">${esc(m.label)}</span>`
      : '';

  // Лут-пул: бейдж «+N» (доп. предметов сверх первого) в правом-верхнем углу капли.
  const badgeHtml =
    m.badge && m.badge > 0
      ? `<span style="position:absolute;top:-5px;right:-5px;min-width:14px;height:14px;padding:0 3px;` +
        `display:flex;align-items:center;justify-content:center;border-radius:9999px;` +
        `background:var(--primary,#C7A24A);color:#0D0D0F;font-size:9px;font-weight:600;line-height:1;` +
        `border:1px solid #0D0D0F;box-shadow:0 1px 2px rgba(0,0,0,.6)">+${m.badge}</span>`
      : '';

  return L.divIcon({
    className: 'cta-edit-di',
    html: `<span class="cta-mk-scale" style="position:relative;display:block">${inner}${labelHtml}${badgeHtml}</span>`,
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
  });
}
