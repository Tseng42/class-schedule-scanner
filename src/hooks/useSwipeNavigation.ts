import { useEffect, useRef } from "react";

const MIN_DISTANCE = 60;
const HORIZONTAL_BIAS = 1.5;

function startsInsideScrollerOrField(target: EventTarget | null): boolean {
  let element = target instanceof Element ? target : null;
  while (element && element !== document.body) {
    if (element.matches("input, textarea, select")) return true;
    const { overflowX } = getComputedStyle(element);
    if ((overflowX === "auto" || overflowX === "scroll") && element.scrollWidth > element.clientWidth + 1) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

export function useSwipeNavigation(onSwipe: (direction: "next" | "prev") => void) {
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const handleStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || startsInsideScrollerOrField(event.target)) {
        tracking = false;
        return;
      }
      tracking = true;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    };

    const handleEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) return;
      onSwipeRef.current(dx < 0 ? "next" : "prev");
    };

    document.addEventListener("touchstart", handleStart, { passive: true });
    document.addEventListener("touchend", handleEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleStart);
      document.removeEventListener("touchend", handleEnd);
    };
  }, []);
}
