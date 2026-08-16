import { permanentRedirect } from 'next/navigation';

// Легаси-маршрут: «Зал автоматов» переехал на индекс раздела «Аркады»
// (/eft/progress/rookie). Старые ссылки (в т.ч. из досье) редиректим сюда.
export default function LegacyArcadeRedirect() {
  permanentRedirect('/eft/progress/rookie');
}
