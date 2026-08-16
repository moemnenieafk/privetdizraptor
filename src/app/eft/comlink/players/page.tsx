import { permanentRedirect } from 'next/navigation';

// Легаси-маршрут: загрузка profile.json и детальная стата переехали в Досье (/eft/hub) —
// блок загрузки в верхнем ряду + секция навыки/мастерство/рейды под карточками разделов.
// Старые ссылки (в т.ч. внешние) редиректим сюда постоянно (308).
export default function LegacyPlayersRedirect() {
  permanentRedirect('/eft/hub');
}
