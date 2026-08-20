import { redirect } from 'next/navigation';

// «Трекер предметов» слит в единый «Важные предметы» (источник истины по прогрессу).
// Оставляем редирект, чтобы старые ссылки/закладки/хабы вели на объединённую страницу.
// Спека: docs/decisions/important-items-merge.md.
export default function ItemTrackerRedirect() {
  redirect('/eft/progress/needed');
}
