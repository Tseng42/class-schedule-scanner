import { useEffect, useRef, type RefObject } from "react";

export type SwipeDirection = "next" | "prev";

const COMMIT_DISTANCE = 60;
const HORIZONTAL_BIAS = 1.5;
const INTENT_THRESHOLD = 10;
const MAX_DRAG = 120;
const EXIT_DURATION = 160;
const EXIT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const SPRING_BACK = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const SPRING_DURATION = 320;

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

/** 1:1 tracking up to MAX_DRAG, heavy resistance beyond it — the page still moves, just reluctantly. */
function dampen(dx: number): number {
  if (Math.abs(dx) <= MAX_DRAG) return dx;
  const overflow = Math.abs(dx) - MAX_DRAG;
  return Math.sign(dx) * (MAX_DRAG + overflow * 0.15);
}

export interface DragProgress {
  direction: SwipeDirection;
  /** 0 at the start of the drag, 1 once it's dragged far enough to commit. */
  progress: number;
}

interface UseSwipeNavigationOptions {
  canSwipe: (direction: SwipeDirection) => boolean;
  onSwipe: (direction: SwipeDirection) => void;
  /** Live drag updates while the content is being dragged; null once the gesture ends without committing. */
  onDragProgress?: (state: DragProgress | null) => void;
}

/**
 * Drags `contentRef`'s element to follow the finger during a horizontal swipe, then
 * either finishes the exit and hands off to `onSwipe`, or springs back to place if
 * the gesture didn't commit. Mutates the DOM directly instead of React state so the
 * drag stays smooth at 60fps — routing every touchmove through a re-render would lag.
 */
export function useSwipeNavigation(
  contentRef: RefObject<HTMLElement | null>,
  options: UseSwipeNavigationOptions,
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let dragging = false;
    let el: HTMLElement | null = null;

    const handleStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || startsInsideScrollerOrField(event.target) || !contentRef.current) {
        tracking = false;
        return;
      }
      tracking = true;
      dragging = false;
      el = contentRef.current;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      el.style.transition = "none";
    };

    const handleMove = (event: TouchEvent) => {
      if (!tracking || !el) return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!dragging) {
        if (Math.abs(dx) < INTENT_THRESHOLD && Math.abs(dy) < INTENT_THRESHOLD) return;
        if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) {
          tracking = false;
          return;
        }
        dragging = true;
      }

      event.preventDefault();
      const damped = dampen(dx);
      el.style.transform = `translateX(${damped}px)`;

      const direction: SwipeDirection = damped < 0 ? "next" : "prev";
      if (optionsRef.current.canSwipe(direction)) {
        optionsRef.current.onDragProgress?.({
          direction,
          progress: Math.min(1, Math.abs(damped) / COMMIT_DISTANCE),
        });
      } else {
        optionsRef.current.onDragProgress?.(null);
      }
    };

    const handleEnd = (event: TouchEvent) => {
      if (!tracking || !el) {
        tracking = false;
        return;
      }
      tracking = false;
      const node = el;
      const wasDragging = dragging;
      dragging = false;
      if (!wasDragging) return;

      const touch = event.changedTouches[0];
      if (!touch) {
        node.style.transition = `transform ${SPRING_DURATION}ms ${SPRING_BACK}`;
        node.style.transform = "translateX(0px)";
        optionsRef.current.onDragProgress?.(null);
        return;
      }

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const direction: SwipeDirection = dx < 0 ? "next" : "prev";
      const committed =
        Math.abs(dx) >= COMMIT_DISTANCE &&
        Math.abs(dx) >= Math.abs(dy) * HORIZONTAL_BIAS &&
        optionsRef.current.canSwipe(direction);

      if (committed) {
        // Leave the last onDragProgress (already at progress 1) as-is — the
        // indicator should stay put through the exit + onSwipe handoff, not
        // reset and re-animate.
        const exitTo = direction === "next" ? -node.clientWidth * 0.4 : node.clientWidth * 0.4;
        node.style.transition = `transform ${EXIT_DURATION}ms ${EXIT_EASE}`;
        node.style.transform = `translateX(${exitTo}px)`;
        window.setTimeout(() => optionsRef.current.onSwipe(direction), EXIT_DURATION);
      } else {
        node.style.transition = `transform ${SPRING_DURATION}ms ${SPRING_BACK}`;
        node.style.transform = "translateX(0px)";
        optionsRef.current.onDragProgress?.(null);
      }
    };

    document.addEventListener("touchstart", handleStart, { passive: true });
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd, { passive: true });
    document.addEventListener("touchcancel", handleEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleStart);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
      document.removeEventListener("touchcancel", handleEnd);
    };
  }, [contentRef]);
}
