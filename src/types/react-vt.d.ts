/**
 * Типовой шим для React `<ViewTransition>` (React 19.2).
 *
 * В рантайме компонент есть: App Router в Next.js 16 бандлит свой React Canary
 * (доп. установка react@canary не нужна). Но `@types/react` (19.2.x) этот экспорт
 * пока не типизирует, поэтому `import { ViewTransition } from 'react'` без этого
 * шима роняет `tsc`. Убрать, когда тип приедет в @types/react.
 */
import "react";

declare module "react" {
  interface ViewTransitionProps {
    children?: import("react").ReactNode;
    name?: string;
    default?: string | Record<string, string>;
    enter?: string | Record<string, string>;
    exit?: string | Record<string, string>;
    share?: string | Record<string, string>;
    update?: string | Record<string, string>;
  }
  export const ViewTransition: import("react").FC<ViewTransitionProps>;
}
