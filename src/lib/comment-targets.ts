// Реестр сущностей, под которыми разрешено обсуждение.
//
// Клиентобезопасен: только типы, подписи и построение URL — никакого drizzle,
// файл импортируется и страницами, и админкой, и клиентским компонентом.
// Проверка «цель существует» живёт в comment-targets.server.ts (нужна БД).
//
// Добавить новую поверхность = добавить сюда запись + проверку в .server.ts
// + смонтировать <EntityComments> на странице. Таблицу трогать не нужно.

export const COMMENT_TARGET_TYPES = ["build", "season-build", "patch", "codex", "boss", "trader"] as const;

export type CommentTargetType = (typeof COMMENT_TARGET_TYPES)[number];

interface TargetMeta {
  /** Подпись раздела — лента модерации показывает, откуда комментарий. */
  label: string;
  /** Ссылка на саму сущность по её id (slug). */
  url: (id: string) => string;
}

export const COMMENT_TARGETS: Record<CommentTargetType, TargetMeta> = {
  build: {
    label: "Сборка",
    url: (id) => `/eft/progress/loadouts/b/${id}`,
  },
  "season-build": {
    label: "Сборка перков",
    url: (id) => `/eft/progress/seasons/b/${id}`,
  },
  patch: {
    label: "Обновление игры",
    url: (id) => `/eft/gamesetting/game-updates/${id}`,
  },
  codex: {
    label: "Кодекс",
    url: (id) => `/eft/gamesetting/${id}`,
  },
  boss: {
    label: "Босс",
    url: (id) => `/eft/gamesetting/bosses/${id}`,
  },
  trader: {
    label: "Торговец",
    url: (id) => `/eft/gamesetting/traders/${id}`,
  },
};

export function isCommentTargetType(v: unknown): v is CommentTargetType {
  return typeof v === "string" && (COMMENT_TARGET_TYPES as readonly string[]).includes(v);
}

/** id целей — это slug'и: строгая проверка формы до похода в БД. */
const TARGET_ID_RE = /^[a-z0-9][a-z0-9-]{1,64}$/;

export function isValidTargetId(v: unknown): v is string {
  return typeof v === "string" && TARGET_ID_RE.test(v);
}

export function targetUrl(type: CommentTargetType, id: string): string {
  return COMMENT_TARGETS[type].url(id);
}

export function targetLabel(type: CommentTargetType): string {
  return COMMENT_TARGETS[type].label;
}
