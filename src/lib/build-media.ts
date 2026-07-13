// Картинки сборки — целиком на нашей R2 (itemIconUrl → items/eft/512/{id}.webp).
//
// Ключевое наблюдение: ПРЕСЕТ — это отдельный item со своим 24-символьным id, а значит
// у него есть собственный отрендеренный 512-webp СОБРАННОГО ствола с обвесом. Поэтому:
//   1) сборка совпала с известным пресетом → отдаём его рендер (честная картинка);
//   2) иначе → рендер дефолт-пресета базы (ствол «из коробки»), а обвес показываем
//      планкой иконок модулей рядом.
// Композита из иконок BSG не существует: они отрендерены под фиксированным ракурсом
// и без якорных точек — склеить ствол из PNG модулей нельзя.
//
// Требование к ETL: в выгрузку иконок в R2 должен попадать `type: preset`.
// Никаких обращений к tarkov.dev в рантайме.
import { itemIconUrl } from '@/lib/item-icon';
import { matchesPreset, type BuildResult } from '@/lib/weapon-build';

/** Пресет из таблицы weapon_presets — только то, что нужно медиа-слою. */
export interface PresetRef {
  /** id самого пресета (у него своя картинка). */
  id: string;
  baseItemId: string;
  isDefault: boolean;
  /** id всех деталей пресета (без базы). */
  partIds: string[];
}

export type BuildHeroKind = 'preset' | 'default_preset' | 'bare';

export interface BuildHero {
  src: string;
  kind: BuildHeroKind;
  /** id предмета, чью картинку показываем (для alt и ссылки на карточку). */
  itemId: string;
}

/**
 * Hero-картинка сборки. Деградация: точный пресет → дефолт-пресет базы → голая база.
 * Чистая функция: годится и для UI, и для OG-рендера (next/og).
 */
export function buildHero(
  baseItemId: string,
  result: BuildResult,
  presets: PresetRef[],
): BuildHero {
  const forBase = presets.filter((p) => p.baseItemId === baseItemId);

  const exact = forBase.find((p) => matchesPreset(result, p.partIds));
  if (exact) return { src: itemIconUrl(exact.id), kind: 'preset', itemId: exact.id };

  const def = forBase.find((p) => p.isDefault);
  if (def) return { src: itemIconUrl(def.id), kind: 'default_preset', itemId: def.id };

  return { src: itemIconUrl(baseItemId), kind: 'bare', itemId: baseItemId };
}

export interface PartIcon {
  itemId: string;
  src: string;
  slotNameId: string;
  /** 0 — корневой слот оружия, >0 — вложенный (планка → крышка → прицел). */
  depth: number;
}

/** Планка иконок установленных модулей: корневые слоты первыми, затем вложенные. */
export function buildPartIcons(result: BuildResult): PartIcon[] {
  return [...result.parts]
    .sort((a, b) => a.depth - b.depth)
    .map((p) => ({
      itemId: p.itemId,
      src: itemIconUrl(p.itemId),
      slotNameId: p.slotNameId,
      depth: p.depth,
    }));
}