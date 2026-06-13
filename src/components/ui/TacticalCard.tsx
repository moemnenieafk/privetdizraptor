import React from "react";
import Link from "next/link";

interface TacticalCardProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
  withGlow?: boolean;
  withScale?: boolean;
  onClick?: () => void;
}

export function TacticalCard({
  children,
  className = "",
  href,
  withGlow = true,
  withScale = true,
  onClick,
}: TacticalCardProps) {
  const containerClasses = `group relative overflow-hidden rounded border border-[var(--color-lines-hover)] bg-[var(--color-base)] p-5 transition-all duration-300 ease-out hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)] ${
    withGlow ? "hover:shadow-[0_0_15px_color-mix(in_srgb,var(--primary)_40%,transparent)]" : ""
  } ${onClick || href ? "cursor-pointer" : ""} ${className}`;

  const contentWrapper = (
    <div className={`h-full w-full ${withScale ? "transition-transform duration-300 ease-out group-hover:scale-105" : ""}`}>
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={containerClasses} onClick={onClick}>
        {contentWrapper}
      </Link>
    );
  }

  return (
    <div
      className={containerClasses}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {contentWrapper}
    </div>
  );
}