import { permanentRedirect } from 'next/navigation';

// Трекер «Коллекционер» переехал в раздел «Прогресс» (полный перенос).
// Старый URL держим живым 308-редиректом — закладки и внешние ссылки не бьют в 404.
export default function CollectorLegacyRedirect() {
  permanentRedirect('/eft/progress/collector');
}
