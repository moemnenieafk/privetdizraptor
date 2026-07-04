// Фирменный коннектор карт квестов: ножка → дуга → диагональ → дуга → ножка.
// Спека дизайна: ножки 56px, радиус скругления 28px, адаптивный угол диагонали.
// Общий для QuestMapClient (/eft/questmap) и StoryQuestMap (карты сюжетных историй).

export function makeQuestPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  if (Math.abs(dx) < 4) return `M ${x1} ${y1} V ${y2}`;

  const FOOT = 56;
  const R    = 28;
  const s    = Math.sign(dx);
  const k    = 0.5523; // cubic bezier quarter-circle approximation constant

  const ay = y1 + FOOT;        // source foot bottom
  const by = ay + R;           // source arc bottom  (= y1 + FOOT + R)
  const bx = x1 + s * R;      // source arc end x

  const cy = y2 - FOOT - R;   // target arc top     (= y2 - FOOT - R)
  const cx = x2 - s * R;      // target arc start x
  const ey = y2 - FOOT;       // target foot top

  return [
    `M ${x1} ${y1}`,
    `V ${ay}`,
    `C ${x1} ${ay + R * k} ${bx - s * R * (1 - k)} ${by} ${bx} ${by}`,
    `L ${cx} ${cy}`,
    `C ${cx + s * R * (1 - k)} ${cy} ${x2} ${ey - R * k} ${x2} ${ey}`,
    `V ${y2}`,
  ].join(' ');
}
