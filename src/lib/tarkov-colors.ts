/**
 * Маппинг строковых идентификаторов цвета из API tarkov.dev
 * в соответствующие RGBA-цвета с 30% прозрачностью, согласно
 * внутриигровой системе когнитивной эргономики Escape from Tarkov.
 * @param color Строковый идентификатор цвета (например, 'violet', 'orange')
 * @returns Готовое CSS-значение цвета в формате rgba
 */
export const getTarkovBackgroundColor = (color: string | undefined): string => {
  switch (color?.toLowerCase()) {
    case "orange":
      return "rgba(60, 25, 0, 0.3)";
    case "yellow":
      return "rgba(104, 102, 40, 0.3)";
    case "violet":
    case "purple":
      return "rgba(76, 42, 85, 0.3)";
    case "blue":
      return "rgba(28, 65, 86, 0.3)";
    case "green":
      return "rgba(21, 45, 0, 0.3)";
    case "black":
      return "rgba(29, 29, 29, 0.3)";
    case "red":
      return "rgba(99, 29, 29, 0.3)";
    case "grey":
    case "default":
    default:
      return "rgba(127, 127, 127, 0.3)";
  }
};