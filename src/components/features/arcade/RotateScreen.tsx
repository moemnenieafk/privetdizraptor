// Мобильный портрет-гейт (общий для всех игр зала): канвас в ленте на тач не запускаем, играть —
// только в ландшафтном фуллскрине. Иконка поворота (public/icons/rotate-screen-icon.svg) через
// систему icon-mask (globals.css): маска красится в --primary. Выход — верхняя кнопка ВЫХОД·ESC.

export function RotateScreen() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-black px-6 text-center select-none">
      <span
        aria-hidden
        className="icon-mask icon-rotate-screen h-24 w-32 text-(--primary)"
      />
      <span className="font-blender-medium text-sm uppercase tracking-wide text-text-primary">
        Разверни телефон, чтобы начать играть
      </span>
    </div>
  );
}
