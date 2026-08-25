// Компактная карта цен для «Разбора рейда»: itemId → минимум чисел, нужных UI.
// Строится на RSC из нашего зеркала (getEftPriceMapFromDb) и передаётся в клиент
// пропом — предметы становятся известны лишь после ответа vision-API, поэтому
// на сервере нельзя знать заранее какие именно itemId понадобятся (§4.11).

export interface RaidScanPrice {
  /** Средняя цена барахолки за 24ч. */
  avg24hPrice: number | null;
  /** Самая низкая живая цена на барахолке. */
  lastLowPrice: number | null;
}

export type RaidScanPriceMap = Record<string, RaidScanPrice>;

/** Отображаемая цена слота: приоритет lastLowPrice → avg24hPrice. null, если цены нет. */
export function displayPrice(price: RaidScanPrice | undefined): number | null {
  if (!price) return null;
  return price.lastLowPrice ?? price.avg24hPrice ?? null;
}

/** Форматирует рубли по-русски: 123 456 ₽. null → прочерк. */
export function formatRub(value: number | null): string {
  if (value === null) return '—';
  return `${value.toLocaleString('ru-RU')} ₽`;
}
