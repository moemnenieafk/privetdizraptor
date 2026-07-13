// Витрина квестов «Оружейник» для страницы /find: спека + имя/картинка ствола +
// краткая сводка порогов. Солвер здесь НЕ запускается — он тяжёлый (BFS по всем
// модулям ствола), и гонять его 30 раз на списке значит убить страницу.
// Список показывает ТРЕБОВАНИЯ, сборку считает уже страница одного квеста.
//
// Только для сервера. Импортировать из RSC.
import { getGunsmithSpecs, getWeaponBaseList } from "@/db/weapons";
import { parseSpec, opSymbol, type GunsmithRequirement } from "@/lib/gunsmith";
import type { GunsmithSpecRow } from "@/db/schema-gunsmith";

export interface GunsmithListItem {
  objectiveId: string;
  taskId: string;
  taskName: string;
  traderName: string | null;
  minPlayerLevel: number | null;
  part: number | null;

  baseItemId: string;
  baseName: string;
  /** id для картинки: дефолт-пресет (ствол с обвесом) либо сам ствол. */
  imageItemId: string;

  /** Значимые пороги (пустышки `weight >= 0` отфильтрованы). */
  requirements: GunsmithRequirement[];
  /** Короткие подписи для карточки: «ЭРГО ≥ 47», «ОТДАЧА ≤ 850». */
  chips: string[];
  requiredItemIds: string[];
  /** Пороги, которые мы не распознали — видно сразу, а не в тишине. */
  unknownCount: number;
}

/** Короткая подпись порога для карточки. */
const CHIP_LABELS: Record<string, string> = {
  ergonomics: "ЭРГО",
  recoilSum: "ОТДАЧА",
  weight: "ВЕС",
  magazineCapacity: "МАГАЗИН",
  muzzleVelocity: "СКОРОСТЬ",
  accuracy: "ТОЧНОСТЬ",
  durability: "ПРОЧНОСТЬ",
  effectiveDistance: "ДАЛЬНОСТЬ",
  width: "ШИРИНА",
  height: "ВЫСОТА",
};

function toChip(r: GunsmithRequirement): string {
  const label = CHIP_LABELS[r.metric] ?? r.metric.toUpperCase();
  return `${label} ${opSymbol(r.op)} ${r.value}`;
}

function toListItem(
  spec: GunsmithSpecRow,
  bases: Map<string, { name: string; imageItemId: string }>,
): GunsmithListItem {
  const { requirements, unknown } = parseSpec(spec.thresholds);
  const base = bases.get(spec.baseItemId);

  return {
    objectiveId: spec.objectiveId,
    taskId: spec.taskId,
    taskName: spec.taskName,
    traderName: spec.traderName,
    minPlayerLevel: spec.minPlayerLevel,
    part: spec.part,

    baseItemId: spec.baseItemId,
    baseName: base?.name ?? spec.baseItemId,
    imageItemId: base?.imageItemId ?? spec.baseItemId,

    requirements,
    // На карточке — только то, что человек реально держит в голове: эрго, отдача,
    // вес, магазин. Остальное (прочность, размеры) уедет в чеклист на странице квеста.
    chips: requirements
      .filter((r) =>
        ["ergonomics", "recoilSum", "weight", "magazineCapacity"].includes(r.metric),
      )
      .map(toChip),
    requiredItemIds: spec.requiredItemIds,
    unknownCount: unknown.length,
  };
}

/** Все квесты «Оружейник» для списка. Отсортированы по номеру части (именные — в конец). */
export async function getGunsmithList(): Promise<GunsmithListItem[]> {
  const [specs, baseList] = await Promise.all([getGunsmithSpecs(), getWeaponBaseList()]);

  const bases = new Map(
    baseList.map((b) => [b.id, { name: b.name, imageItemId: b.imageItemId }]),
  );

  return specs.map((s) => toListItem(s, bases));
}

/** Одна спека + мета ствола — для страницы квеста. */
export async function getGunsmithListItem(
  objectiveId: string,
): Promise<GunsmithListItem | null> {
  const list = await getGunsmithList();
  return list.find((x) => x.objectiveId === objectiveId) ?? null;
}