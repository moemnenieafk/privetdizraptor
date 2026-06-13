import React from "react";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ children, content, position = "top", className = "" }: TooltipProps) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className={`group/tooltip relative inline-flex ${className}`}>
      {children}
      <div
        className={`pointer-events-none absolute z-50 whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover/tooltip:opacity-100 group-focus-visible/tooltip:opacity-100 ${positionClasses[position]}`}
      >
        <div className="scale-95 rounded border border-lines-hover bg-card-menu px-2.5 py-1 text-[10px] font-blender-medium uppercase tracking-widest text-text-primary shadow-lg transition-transform duration-300 ease-out group-hover/tooltip:scale-100">
          {content}
        </div>
      </div>
    </div>
  );
}