import { useState, useEffect } from "react";

/**
 * Custom hook to detect mobile viewport width (< 768px).
 * Uses window.matchMedia for zero-polling, performant updates.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const updateMatches = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mql.matches);

    // Support both modern addEventListener and legacy addListener
    if (mql.addEventListener) {
      mql.addEventListener("change", updateMatches);
      return () => mql.removeEventListener("change", updateMatches);
    } else {
      mql.addListener(updateMatches);
      return () => mql.removeListener(updateMatches);
    }
  }, [breakpoint]);

  return isMobile;
}
