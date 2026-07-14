// Валидация дерева сюжетного гайда, приходящего из CMS (E10, фаза 5).
//
// Гайд сохраняется одним jsonb, поэтому «просто положить body в БД» нельзя: любой
// мусор из клиента станет частью прод-контента и уронит рендер. Здесь дерево
// пересобирается по типам — всё неизвестное отбрасывается, всё известное режется
// по длине. Это единственная точка доверия между CMS и БД.
import type {
  StoryMedia,
  StoryWalkthrough,
  WalkthroughBlock,
  WalkthroughBranch,
  WalkthroughCondition,
  WalkthroughStep,
  WalkthroughSubStep,
} from "@/data/story-walkthroughs/types";

const MAX_TEXT = 4_000;
const MAX_TITLE = 200;
const MAX_LIST = 60;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown, max = MAX_TEXT): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const strList = (v: unknown, max = MAX_LIST): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim().slice(0, MAX_TEXT))
        .slice(0, max)
    : [];

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const bool = (v: unknown): boolean => v === true;

function media(v: unknown): StoryMedia | undefined {
  if (!isObj(v)) return undefined;
  const m: StoryMedia = {
    poster: str(v.poster, 500),
    posterTitle: str(v.posterTitle, MAX_TITLE),
    posterSub: str(v.posterSub, MAX_TITLE),
    screenshots: strList(v.screenshots, 30).map((s) => s.slice(0, 500)),
  };
  if (bool(v.video)) m.video = true;
  if (str(v.videoUrl, 500)) m.videoUrl = str(v.videoUrl, 500);
  // Заглушки взаимоисключающи с реальным медиа: как только появился ролик/скрины —
  // «скоро» гасим сами, чтобы редактор не забыл снять галочку.
  if (bool(v.videoSoon) && !m.video && !m.videoUrl) m.videoSoon = true;
  if (bool(v.screenshotsSoon) && m.screenshots.length === 0) m.screenshotsSoon = true;
  return m;
}

function condition(v: unknown): WalkthroughCondition | undefined {
  if (!isObj(v)) return undefined;
  const kind = v.kind;
  if (kind !== "hideout" && kind !== "item" && kind !== "story") return undefined;

  const c: WalkthroughCondition = { kind, label: str(v.label, MAX_TITLE) };

  if (isObj(v.station)) {
    c.station = {
      normalizedName: str(v.station.normalizedName, 80),
      name: str(v.station.name, MAX_TITLE),
      level: num(v.station.level, 1),
    };
  }
  if (isObj(v.item)) {
    c.item = {
      id: str(v.item.id, 40),
      name: str(v.item.name, MAX_TITLE),
      count: num(v.item.count, 1),
      ...(bool(v.item.fir) ? { fir: true } : {}),
    };
  }
  if (isObj(v.story)) {
    c.story = { iconClass: str(v.story.iconClass, 80), note: str(v.story.note) };
  }
  if (str(v.mapIcon, 80)) c.mapIcon = str(v.mapIcon, 80);
  if (str(v.trader, 80)) c.trader = str(v.trader, 80);

  return c;
}

function block(v: unknown): WalkthroughBlock | null {
  if (!isObj(v)) return null;

  const b: WalkthroughBlock = {};
  const text = strList(v.text);
  const subList = strList(v.subList);

  if (text.length) b.text = text;
  if (subList.length) b.subList = subList;
  if (str(v.warning)) b.warning = str(v.warning);

  if (isObj(v.priceNote) && str(v.priceNote.itemId, 40)) {
    b.priceNote = {
      itemId: str(v.priceNote.itemId, 40),
      template: str(v.priceNote.template, MAX_TITLE),
    };
  }

  const c = condition(v.condition);
  if (c) b.condition = c;

  const empty = !b.text && !b.subList && !b.warning && !b.priceNote && !b.condition;
  return empty ? null : b;
}

const blocks = (v: unknown): WalkthroughBlock[] =>
  Array.isArray(v) ? v.map(block).filter((b): b is WalkthroughBlock => b !== null).slice(0, MAX_LIST) : [];

function substep(v: unknown, i: number): WalkthroughSubStep {
  const o = isObj(v) ? v : {};
  return {
    id: str(o.id, 80) || `s${i + 1}`,
    title: str(o.title, MAX_TITLE),
    ...(str(o.intro) ? { intro: str(o.intro) } : {}),
    ...(media(o.media) ? { media: media(o.media) } : {}),
    blocks: blocks(o.blocks),
  };
}

function branch(v: unknown, i: number): WalkthroughBranch {
  const o = isObj(v) ? v : {};
  return {
    id: str(o.id, 80) || `b${i + 1}`,
    title: str(o.title, MAX_TITLE),
    ...(str(o.note) ? { note: str(o.note) } : {}),
    ...(media(o.media) ? { media: media(o.media) } : {}),
    substeps: Array.isArray(o.substeps) ? o.substeps.map(substep).slice(0, MAX_LIST) : [],
  };
}

function step(v: unknown, i: number): WalkthroughStep {
  const o = isObj(v) ? v : {};
  const s: WalkthroughStep = {
    n: num(o.n, i + 1),
    title: str(o.title, MAX_TITLE),
    blocks: blocks(o.blocks),
  };
  if (str(o.traderPhoto, 300)) s.traderPhoto = str(o.traderPhoto, 300);
  if (str(o.intro)) s.intro = str(o.intro);
  const m = media(o.media);
  if (m) s.media = m;
  if (Array.isArray(o.substeps) && o.substeps.length) {
    s.substeps = o.substeps.map(substep).slice(0, MAX_LIST);
  }
  if (Array.isArray(o.branches) && o.branches.length) {
    s.branches = o.branches.map(branch).slice(0, 10);
  }
  return s;
}

export interface SanitizeResult {
  ok: boolean;
  error?: string;
  doc?: StoryWalkthrough;
}

/** Пересобирает гайд из клиентского JSON. Ошибка — только если гайд нежизнеспособен. */
export function sanitizeStory(input: unknown): SanitizeResult {
  if (!isObj(input)) return { ok: false, error: "Ожидался объект" };

  const slug = str(input.slug, 60).toLowerCase();
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return { ok: false, error: "Некорректный slug" };

  const title = str(input.title, MAX_TITLE);
  if (!title) return { ok: false, error: "Название обязательно" };

  const steps = Array.isArray(input.steps) ? input.steps.map(step).slice(0, MAX_LIST) : [];
  if (steps.length === 0) return { ok: false, error: "Гайд без шагов" };

  const diff = isObj(input.difficulty) ? input.difficulty : {};
  const verified = isObj(input.verifiedAt) ? input.verifiedAt : {};

  const doc: StoryWalkthrough = {
    slug,
    title,
    iconUrl: str(input.iconUrl, 300),
    iconClass: str(input.iconClass, 120),
    difficulty: {
      skulls: Math.min(Math.max(num(diff.skulls, 2), 0), 7),
      label: str(diff.label, 40) || "ЛЁГКАЯ",
    },
    verifiedAt: {
      date: str(verified.date, 40),
      time: str(verified.time, 40),
      gameVersion: str(verified.gameVersion, 60),
    },
    steps,
  };

  if (str(input.heroImage, 500)) doc.heroImage = str(input.heroImage, 500);
  if (bool(input.hasMap)) doc.hasMap = true;

  if (isObj(input.posterDecor)) {
    doc.posterDecor = {
      ...(str(input.posterDecor.image, 500) ? { image: str(input.posterDecor.image, 500) } : {}),
      gradientTo: str(input.posterDecor.gradientTo, 40),
    };
  }

  if (isObj(input.requirement)) {
    const note = strList(input.requirement.note, 10);
    const st = isObj(input.requirement.station) ? input.requirement.station : null;
    doc.requirement = {
      note,
      ...(st
        ? {
            station: {
              normalizedName: str(st.normalizedName, 80),
              name: str(st.name, MAX_TITLE),
              level: num(st.level, 1),
            },
          }
        : {}),
    };
  }

  return { ok: true, doc };
}
