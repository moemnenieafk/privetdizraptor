// cta-mapper — модель данных.
// Единственный источник правды прогона — mapper.json (см. manifest.ts). Каждая стадия
// читает его и дописывает своё поле; падение на N-м объекте не роняет первые N-1.
//
// Решения грила (2026-08-13), которые формируют эти типы — см. протокол в
// docs/img-promt-help/SPEC-cta-mapper.obsidian.md:
//   2  единица работы = семантический ТИП (typeKey), не внешний вид (dHash вторичен)
//   3  генерация от слов; bbox/angle — замер, не вход
//   4b палитра = материальные семейства (триадами), см. palette.ts
//   8  порог S1 физический (areaM2); vision метит хлам → isClutter
//   9  позиции/углы ПРЕВЬЮ-грубые, финальная раскладка — вручную в Figma

/** Стадия, до которой дошёл объект в конвейере. */
export type Stage =
  | 'segmented' // S1: bbox + кроп + грубый угол
  | 'reviewed' // S2: прошёл гейт сегментации
  | 'typed' // vision: typeKey + material + subjectSeed
  | 'clustered' // S3: назначен в кластер, канон выбран
  | 'described' // S5: финальный человеческий subject на каноне
  | 'generated' // S6: канон сгенерирован (Pro)
  | 'traced' // S7: канон трассирован (palette-locked)
  | 'rejected'; // отброшен на любом гейте

/** Силуэтная стратегия трассировки / шаблон промта. */
export type ObjectType = 'isolated' | 'tile';

/** Матовый кей — из гистограммы кропа, НИКОГДА из ответа модели. */
export type Matte = 'magenta' | 'green';

/** Bbox в пиксельном пространстве ИСХОДНОГО РАСТРА (не игровые метры). */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Один обнаруженный экземпляр на карте.
 * Позиции/углы ПРЕВЬЮ-грубые (решение 9) — финал раскладывается руками в Figma.
 */
export interface MapperObject {
  id: string; // sha1(bbox+mapId).slice(0,8)
  bbox: BBox; // пиксели растра
  angle: number; // градусы, на которые кроп повёрнут в канон перед замером
  pixelCount: number;
  areaM2: number | null; // физ-размер (для фильтра решения 8); null пока нет масштаба

  // --- vision-проход (gemini-2.5-flash) ---
  typeKey: string | null; // семантический тип — ПЕРВИЧНЫЙ ключ кластера (решение 2)
  material: string | null; // id материала → сабсет палитры (решение 4b)
  matte: Matte; // из гистограммы кропа
  subjectSeed: string | null; // грубый черновик; финал пишет человек на каноне
  isClutter: boolean; // хлам/растительность → скип генерации (решение 8)

  // --- кластеризация (решения 2, 3) ---
  clusterId: string | null; // объекты одного типа+пропорции делят его
  isClusterCanonical: boolean; // тот единственный экземпляр, что генерится за кластер
  dedupKey: string; // dHash — ВТОРИЧНЫЙ сигнал слияния внутри типа

  // --- пишется только на каноне (S5) ---
  subject: string | null; // финальный гипер-конкретный subject для промта
  type: ObjectType;

  // --- артефакты ---
  stage: Stage;
  paths: { crop?: string; generated?: string; svg?: string };
  error?: string;
}

/** Материальное семейство: база + тень (в тени) + засвет (на солнце). Решение 4b. */
export interface MaterialFamily {
  id: string; // стем токена, напр. 'cnt-blue'
  usage: string; // человеческая метка, напр. 'Blue Metal Containers'
  shadow: string; // #rrggbb — в тени
  default: string; // #rrggbb — база
  highlight: string; // #rrggbb — на солнце
}

/** Манифест прогона — единственное состояние. Пишется атомарно (tmp+rename). */
export interface MapperManifest {
  version: number; // схема манифеста, для миграций
  mapId: string;
  source: string; // абс. путь к растру или папке кропов
  sourceSize: { w: number; h: number };
  pxPerMetre: number | null; // для физ-фильтра S1 (решение 8)
  background: string | null; // #rrggbb, авто-определён
  matteHex: Record<Matte, string>; // { magenta:'#C000C0', green:'#00C000' }
  palette: MaterialFamily[]; // реестр материалов (решение 4b)
  anchorPath: string | null; // утверждённый стиль-анкер
  objects: MapperObject[];
}

/** Стадии, которые принимает роут /api/mapper/[stage]. */
export type PipelineStage = 'segment' | 'vision' | 'cluster' | 'generate' | 'trace' | 'assemble';

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'segment',
  'vision',
  'cluster',
  'generate',
  'trace',
  'assemble',
] as const;

export function isPipelineStage(s: string): s is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(s);
}
