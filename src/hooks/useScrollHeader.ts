import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Hysteresis: enter scrolled state at UPPER threshold, exit at LOWER threshold.
// Prevents flicker when scrolling near the boundary.
const THRESHOLD_ENTER = 50;
const THRESHOLD_EXIT = 20;

export function useScrollHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const isScrolledRef = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    isScrolledRef.current = false;
    setIsScrolled(false);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      if (!isScrolledRef.current && y > THRESHOLD_ENTER) {
        isScrolledRef.current = true;
        setIsScrolled(true);
      } else if (isScrolledRef.current && y < THRESHOLD_EXIT) {
        isScrolledRef.current = false;
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return isScrolled;
}
