// Канон ролей ЦТА (эпик E10, фаза 1). Единственный источник правды по правам —
// импортировать отсюда, не сравнивать строки по месту.
//
//   user      — обычный игрок.
//   editor    — пишет и публикует контент (кодекс, истории, блог, мастер-классы,
//               разборы патчей). НЕ трогает каталог предметов, роли, настройки.
//   moderator — модерация раздела «Связь» (pin/lock/hide, очередь жалоб).
//   admin     — всё вышеперечисленное + каталог и выдача ролей.

export const ROLES = ["user", "editor", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const isRole = (v: unknown): v is Role =>
  typeof v === "string" && (ROLES as readonly string[]).includes(v);

export const ROLE_LABELS: Record<Role, string> = {
  user: "Пользователь",
  editor: "Редактор",
  moderator: "Модератор",
  admin: "Администратор",
};

/** Модерация «Связи»: скрыть пост, закрепить/закрыть тему, разобрать жалобу. */
export const canModerate = (role: string): boolean => role === "admin" || role === "moderator";

/** Создание/правка/публикация контента (CMS). */
export const canEditContent = (role: string): boolean => role === "admin" || role === "editor";

/** Каталог предметов, роли, системные настройки — только владелец. */
export const canManageCatalog = (role: string): boolean => role === "admin";

/** Доступ в зону /admin (хаб CMS). Редактор видит только контент-разделы. */
export const canAccessCms = (role: string): boolean => canEditContent(role) || canManageCatalog(role);
