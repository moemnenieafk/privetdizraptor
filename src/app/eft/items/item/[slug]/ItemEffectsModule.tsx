import { SectionRule } from '@/components/ui/SectionRule';
import {
  buildItemEffects,
  effectsBlockTitle,
  type ItemEffects,
  type EffectGroupData,
  type EffectRowData,
  type EffectTileData,
} from '@/data/eft/item-effects';
import { isMedKitProps, isMedicalItemProps, type ItemProperties } from './ItemModules';

/* Вёрстка снята с фреймов MEDICAL_EFFECT (Figma Z1c9wK3AtqBrBhSwNt8qZz):
   2205:2741 аптечка · 2205:2311 таблетки · 2205:1943 хирургия · 2201:3352 инъектор. */

const TILE_ACCENT = {
  success: { box: 'bg-nvg-green/10', text: 'text-nvg-green' },
  warning: { box: 'bg-primary/10', text: 'text-primary' },
  neutral: { box: 'bg-card-menu', text: 'text-text-secondary' },
} as const;

const ROW_ACCENT = {
  positive: { box: 'bg-nvg-green/10', text: 'text-nvg-green' },
  negative: { box: 'bg-danger/10', text: 'text-danger' },
} as const;

/** Размер глифа внутри 24-бокса плитки — у макета разная вложенность иконок. */
const TILE_GLYPH: Record<string, string> = {
  'icon-eft-quests-loot': 'size-4',
};

const MASK = 'mask-contain mask-center mask-no-repeat';

function EffectTile({ tile }: { tile: EffectTileData }) {
  const accent = TILE_ACCENT[tile.accent];
  const wide = tile.note != null;

  // Переносить содержимое разрешаем только широкой плитке инъектора: на телефоне
  // она не держит 4 зоны в строку и уточнение уезжает вниз. Обычной плитке перенос
  // противопоказан — значение отрывается от подписи.
  return (
    <div
      className={`flex min-h-12 flex-1 items-center justify-between gap-x-2 gap-y-1 rounded px-3.5 py-2 ${wide ? 'flex-wrap' : ''} ${accent.box}`}
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex size-6 items-center justify-center">
          {tile.raster ? (
            <span className={`size-6 icon-bg ${tile.icon}`} />
          ) : (
            <span className={`${tile.icon} ${TILE_GLYPH[tile.icon] ?? 'size-6'} bg-current ${MASK} ${accent.text}`} />
          )}
        </span>
        <span className={`font-blender-medium text-xs uppercase leading-none ${accent.text}`}>{tile.label}</span>
      </div>

      {wide && (
        <span
          className={`order-last w-full min-w-0 text-center font-blender-medium text-xs uppercase leading-none tracking-widest sm:order-0 sm:w-auto sm:flex-1 ${accent.text}`}
        >
          {tile.note}
        </span>
      )}

      {tile.valueAlt && (
        <span className="shrink-0 text-right font-blender-medium text-base leading-[0.8] text-text-muted sm:w-20">
          {tile.valueAlt}
        </span>
      )}

      <span
        className={`shrink-0 text-right font-blender-medium text-base leading-[0.8] ${wide ? 'sm:w-20' : ''} ${accent.text}`}
      >
        {tile.value}
      </span>
    </div>
  );
}

function EffectRow({ row, polarity }: { row: EffectRowData; polarity: EffectGroupData['polarity'] }) {
  const accent = ROW_ACCENT[polarity];

  return (
    <div className={`flex h-6 items-center justify-between rounded-xs pr-2 ${accent.box}`}>
      <span className="flex min-w-0 items-center gap-2">
        <span className={`size-6 shrink-0 icon-bg ${row.icon}`} />
        <span className="truncate font-blender-medium text-type-micro uppercase leading-[0.8] text-text-primary">
          {row.label}
        </span>
        {row.note && (
          <span className={`shrink-0 font-blender-medium text-type-micro uppercase leading-[0.8] ${accent.text}`}>
            {row.note}
          </span>
        )}
      </span>
      {row.value && (
        <span className={`shrink-0 pl-2 text-right font-blender-medium text-type-micro leading-[0.8] ${accent.text}`}>
          {row.value}
        </span>
      )}
    </div>
  );
}

function EffectColumn({ groups }: { groups: EffectGroupData[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-2">
          <span
            className={`font-blender-medium text-xs uppercase leading-[0.8] ${ROW_ACCENT[group.polarity].text}`}
          >
            {group.title}
          </span>
          <div className="flex flex-col gap-1">
            {group.rows.map((row) => (
              <EffectRow key={`${row.icon}-${row.label}`} row={row} polarity={group.polarity} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Плитки из каталога — для медикамента, которого нет в снимке игровой базы
 * (напр. предмет добавили патчем позже дампа). Списки эффектов не рисуем.
 */
function fallbackTiles(properties: ItemProperties): EffectTileData[] {
  if (!properties) return [];
  const tiles: EffectTileData[] = [];

  if (isMedKitProps(properties)) {
    if (properties.hitpoints > 0) {
      tiles.push({
        icon: 'icon-eft-health-regeneration',
        label: 'Восстановление',
        value: `+${properties.hitpoints} HP`,
        accent: 'success',
      });
    }
    if (properties.maxHealPerUse != null) {
      tiles.push({
        icon: 'icon-eft-quests-loot',
        label: 'За применение',
        value: `${properties.maxHealPerUse} HP`,
        accent: 'warning',
      });
    }
  } else if (isMedicalItemProps(properties) && properties.uses != null) {
    tiles.push({
      icon: 'icon-eft-quests-loot',
      label: 'Кол-во использований',
      value: `${properties.uses}/${properties.uses}`,
      accent: 'warning',
    });
  }

  const useTime = properties && 'useTime' in properties ? properties.useTime : 0;
  if (useTime > 0) {
    tiles.push({
      icon: 'icon-eft-time-effect',
      label: 'Время использования',
      value: `${useTime} сек.`,
      accent: 'neutral',
    });
  }

  return tiles;
}

/** Иконка шапки по типу предмета: медицина / провизия / холодное оружие. */
const BLOCK_ICON: Record<string, string> = {
  ItemPropertiesFoodDrink: 'icon-eft-eq-provisions',
  ItemPropertiesMelee: 'icon-eft-guns-knifes',
};

export function ItemEffectsModule({ properties }: { properties: ItemProperties }) {
  const raw = properties != null && 'itemEffects' in properties ? properties.itemEffects : null;

  const data: ItemEffects | null = raw
    ? buildItemEffects(raw)
    : properties
      ? { tiles: fallbackTiles(properties), groups: [] }
      : null;

  if (!data || (data.tiles.length === 0 && data.groups.length === 0)) return null;

  const left = data.groups.filter((g) => g.column === 'left');
  const right = data.groups.filter((g) => g.column === 'right');
  const typename = raw?.typename ?? '';

  return (
    <div className="flex flex-col gap-3.5">
      <SectionRule
        title={effectsBlockTitle(typename)}
        icon={<span className={`${BLOCK_ICON[typename] ?? 'icon-eft-eq-meds'} size-4 bg-current ${MASK}`} />}
      />

      {/* На телефоне плитки в столбик: три штуки в ряд ужимаются до нечитаемых.
          Четвёртая (у еды с энергией, гидрацией и ресурсом) переносится строкой. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {data.tiles.map((tile) => (
          <EffectTile key={tile.label} tile={tile} />
        ))}
      </div>

      {data.groups.length > 0 && (
        <div className="grid grid-cols-1 gap-x-7 gap-y-3.5 sm:grid-cols-2">
          {left.length > 0 && <EffectColumn groups={left} />}
          {right.length > 0 && <EffectColumn groups={right} />}
        </div>
      )}
    </div>
  );
}
