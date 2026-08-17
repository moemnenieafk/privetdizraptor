// Раздел «Связь» (COMLINK) — сообщество ЦТА.
//
// ⚠️ ИСТОЧНИК ПРАВДЫ — HEADER_DICTIONARY (headerConfig.ts), ветка `comlink`. Этот модуль лишь
// ПРОЕЦИРУЕТ детей меню в форму ComlinkSection, которую ждут потребители ([section]-роут,
// ComlinkHubNav, индекс раздела). Так убрал пункт из верхнего меню → он автоматически исчез
// и внутри раздела (карточки, под-страницы, табы) — единый источник, без ручной синхронизации.
// Тот же принцип, что у «Прогресса» (getSectionHubCards). Описания/иконки берём из полей пункта меню.

import { HEADER_DICTIONARY, type MenuItem } from "@/data/headerConfig";

export const COMLINK_BASE = "/eft/comlink";
// Иконка раздела целиком (шапка индекса/заглушек). У подпунктов — свои иконки (поле icon ниже).
export const COMLINK_ICON = "/icons/eft/00-nav/comlink-icon.svg";

export interface ComlinkSection {
  slug: string;
  label: string;
  description: string;
  /** Иконка подраздела (из пункта меню; фолбэк — иконка раздела). */
  icon: string;
}

/** Дети ветки «Связь» из словаря меню. */
function comlinkMenuChildren(): MenuItem[] {
  const comlink = HEADER_DICTIONARY["eft"].menuItems.find((m) => m.path === COMLINK_BASE);
  return comlink?.children ?? [];
}

/** Пункты раздела «Связь» — проекция детей меню (slug = хвост пути после /eft/comlink/). */
export const COMLINK_SECTIONS: ComlinkSection[] = comlinkMenuChildren()
  .filter((c): c is MenuItem & { path: string } => Boolean(c.path) && c.path !== COMLINK_BASE)
  .map((c) => ({
    slug: c.path.slice(COMLINK_BASE.length + 1),
    label: c.label,
    description: c.description ?? "",
    icon: c.iconUrl ?? COMLINK_ICON,
  }));
