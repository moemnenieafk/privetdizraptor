// Пустая ячейка «Схрона» — презентационная, размер задаёт родитель (клетка сетки 56px).
// Без заливки: фон страницы просвечивает сквозь бордер, градиент-оверлей и тень-виньетку.
// Эталон из Figma (нода 3028:4215, 56×56), смапплено в токены NIGHTFALL.

export function StashEmptyCell() {
  return (
    <div className="relative size-full border border-(--color-card-menu)">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 to-black/35"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[-0.5px] shadow-[inset_0_0_8px_8px_rgba(0,0,0,0.15)]"
      />
    </div>
  );
}
