export function formatCompactNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0";

  // Если приходит строка, убираем пробелы (обычные и неразрывные) и меняем запятую на точку
  let numericValue = value;
  if (typeof value === "string") {
    numericValue = parseFloat(value.replace(/[\s\u00A0]/g, '').replace(',', '.'));
  } else {
    numericValue = Number(value);
  }

  if (isNaN(numericValue)) return "0";

  const absValue = Math.abs(numericValue);

  if (absValue >= 1_000_000) {
    const truncated = Math.trunc(numericValue / 100_000) / 10;
    return truncated.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + "КК";
  }

  if (absValue >= 1_000) {
    const truncated = Math.trunc(numericValue / 100) / 10;
    return truncated.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + "К";
  }

  return numericValue.toLocaleString("ru-RU");
}

export function formatEftPrice(price: number): string {
  if (price < 100_000) {
    return new Intl.NumberFormat('ru-RU').format(price);
  }
  return formatCompactNumber(price);
}

export type EftCurrency = 'RUB' | 'USD' | 'EUR';

export function getCurrencySymbol(currency?: EftCurrency): string {
  if (currency === 'USD') return '$';
  if (currency === 'EUR') return '€';
  return '₽';
}

export function formatCurrencyDisplay(price: number, currency?: EftCurrency): string {
  const formatted = formatEftPrice(price);
  if (currency === 'USD') return `$${formatted}`;
  if (currency === 'EUR') return `€${formatted}`;
  return `${formatted} ₽`;
}