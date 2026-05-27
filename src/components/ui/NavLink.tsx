"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

type NavLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  href: string;
  children: ReactNode;
};

export function NavLink({ href, children, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  // Базовые классы для всех ссылок в навигации
  const baseClasses = "text-[15px] uppercase font-blender-medium tracking-wide transition-colors";
  // Классы для активного и неактивного состояния, используя дизайн-токены
  const activeClasses = "text-text-primary"; // Активная ссылка
  const inactiveClasses = "text-text-secondary hover:text-text-primary"; // Неактивная ссылка

  const finalClassName = `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;

  return (
    <Link href={href} className={finalClassName} {...props}>
      {children}
    </Link>
  );
}