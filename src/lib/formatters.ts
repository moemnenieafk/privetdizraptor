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
    return (numericValue / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + "КК";
  }

  if (absValue >= 1_000) {
    return (numericValue / 1_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + "К";
  }

  return numericValue.toLocaleString("ru-RU");
}

export function getCurrencySymbol(vendorOrCurrency?: string): string {
  if (!vendorOrCurrency) return "₽";
  const lower = vendorOrCurrency.toLowerCase();
  if (lower === "usd" || lower === "peacekeeper" || lower === "миротворец") return "$";
  if (lower === "eur" || lower === "euro") return "€";
  return "₽";
}