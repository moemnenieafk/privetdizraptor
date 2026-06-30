import * as L from 'leaflet';
import { LOOT_CATEGORIES } from '@/data/map-markers/categories';

/**
 * Иконка ручного маркера статик-карты (общая для редактора и рендера карты).
 * loot → icon-mask категории (реальные иконки сайта); transit/hazard → глиф;
 * остальное → точка (контейнер — квадрат) цветом типа. Подпись — справа.
 */

const TYPE_COLOR: Record<string, string> = {
  extract: '#5FB85B',
  spawn: '#E6A23C',
  transit: '#5FA8D8',
  hazard: '#E5484D',
  lock: '#BDA550',
  switch: '#C26BE0',
  loot: '#E68E25',
  container: '#9A8866',
  quest: '#E0C24A',
};

const LOOT_ICON = new Map(LOOT_CATEGORIES.flatMap((g) => g.items).map((i) => [i.key, i.icon ?? '']));

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export interface ManualMarkerLike {
  type: string;
  category?: string | null;
  label?: string | null;
  faction?: string | null;
}

export function manualMarkerIcon(m: ManualMarkerLike, del = false): L.DivIcon {
  const color = TYPE_COLOR[m.type] ?? '#9696A1';
  const lootIcon = m.type === 'loot' && m.category ? LOOT_ICON.get(m.category) : undefined;
  const glyph = m.type === 'transit' ? '⇄' : m.type === 'hazard' ? '⚠' : m.type === 'quest' ? '!' : '';

  let inner: string;
  if (lootIcon) {
    inner = `<span class="icon-mask ${lootIcon}" style="display:block;width:16px;height:16px;color:${color}"></span>`;
  } else if (glyph) {
    inner = `<span style="display:flex;align-items:center;justify-content:center;width:16px;height:16px;color:${color};font-size:13px">${glyph}</span>`;
  } else {
    const radius = m.type === 'container' ? '2px' : '50%';
    inner = `<span style="display:block;width:13px;height:13px;border-radius:${radius};background:${color};border:2px solid #141416;box-shadow:0 0 0 1px ${color}${del ? ',0 0 8px 2px #E5484D' : ''}"></span>`;
  }
  const labelHtml = m.label
    ? `<span style="position:absolute;left:20px;top:0;font-size:10px;color:#F2F2F2;text-shadow:0 1px 3px #000;white-space:nowrap">${esc(m.label)}</span>`
    : '';

  return L.divIcon({ className: 'cta-edit-di', html: inner + labelHtml, iconSize: [16, 16], iconAnchor: [8, 8] });
}
