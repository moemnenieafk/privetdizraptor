import { PackageX } from "lucide-react";

export function SearchEmptyState() {
  return (
    <div className="relative flex w-full h-[240px] flex-col items-center justify-center overflow-hidden rounded border border-lines-hover bg-card-menu/30 shadow-inner animate-[fade-in-up_0.3s_ease-out]">
      <div className="pointer-events-none absolute inset-0 opacity-10 bg-hazard-pattern animate-hazard" />
      <div className="relative z-10 flex flex-col items-center text-center px-4">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-lines-hover bg-(--color-base) shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <PackageX className="h-6 w-6 text-text-muted" />
        </div>
        <h3 className="mb-1 font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Данные не найдены
        </h3>
        <p className="max-w-xs font-mono text-[10px] text-text-muted">
          По вашему запросу нет совпадений. Попробуйте изменить параметры поиска или использовать игровой сленг.
        </p>
      </div>
    </div>
  );
}