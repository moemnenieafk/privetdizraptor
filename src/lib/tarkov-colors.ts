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

/**
 * НЕПРОЗРАЧНЫЙ фон ячейки по редкости — для маркеров на тёмной карте, где 30%-тинт
 * `getTarkovBackgroundColor` почти невидим. Те же оттенки EFT, но сплошные и чуть светлее,
 * чтобы плитка читалась как ячейка инвентаря и предмет было видно поверх.
 */
export const getTarkovCellColor = (color: string | undefined): string => {
  switch (color?.toLowerCase()) {
    case "orange":
      return "#63421f";
    case "yellow":
      return "#5f5a2e";
    case "violet":
    case "purple":
      return "#4d3b56";
    case "blue":
      return "#2c4859";
    case "green":
      return "#2e4327";
    case "black":
      return "#2b2b2b";
    case "red":
      return "#5c2e2e";
    case "grey":
    case "default":
    default:
      return "#3d3d3a";
  }
};

/**
 * ЯРКИЙ фон редкости для маркеров loose loot НА КАРТЕ — насыщённее и светлее инвентарного
 * `getTarkovCellColor`, чтобы плитка мгновенно опознавалась по редкости среди сотен точек на
 * тёмной подложке. Те же тарковские хью (orange/violet/blue/…), но подняты по яркости/сатурации.
 * Только для карты — инвентарные ячейки и battlepass остаются на приглушённом getTarkovCellColor.
 */
export const getTarkovLootMarkerColor = (color: string | undefined): string => {
  switch (color?.toLowerCase()) {
    case "orange":
      return "#b86e1e";
    case "yellow":
      return "#a79a2c";
    case "violet":
    case "purple":
      return "#6f4e80";
    case "blue":
      return "#2e6a8c";
    case "green":
      return "#3c7132";
    case "black":
      return "#454545";
    case "red":
      return "#9c3838";
    case "grey":
    case "default":
    default:
      return "#61615a";
  }
};