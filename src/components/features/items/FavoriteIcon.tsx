// Иконка «Избранное» (авторские маски V4DYA): default = контур, active = залитая.
// Цвет наследуется от родителя через bg-current — call-site задаёт text-*.

interface FavoriteIconProps {
  active: boolean;
  className?: string;
}

export function FavoriteIcon({ active, className = 'h-4 w-4' }: FavoriteIconProps) {
  return (
    <span
      aria-hidden="true"
      className={`${active ? 'icon-eft-favourite-active' : 'icon-eft-favourite-default'} ${className} shrink-0 bg-current mask-contain mask-no-repeat mask-center`}
    />
  );
}
