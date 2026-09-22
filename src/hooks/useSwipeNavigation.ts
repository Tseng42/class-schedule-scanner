import { useEffect, useRef, type RefObject } from "react";

export type SwipeDirection = "next" | "prev";

const COMMIT_DISTANCE = 60;
const HORIZONTAL_BIAS = 1.5;
const INTENT_THRESHOLD = 10;
const AXIS_DECISION_FALLBACK = 40;
const MAX_DRAG = 220;
const EXIT_DURATION = 160;
const EXIT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const SPRING_BACK = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const SPRING_DURATION = 320;

/**
 * Touch and Pointer events both fire for the same physical touch, so a region with its
 * own pointer-driven drag (e.g. the tab-bar pill) must opt out here — otherwise this
 * document-level touch listener would ALSO drag the page content underneath it.
 */
function startsInsideScrollerOrField(target: EventTarget | null): boolean {
  let element = target instanceof Element ? target : null;
  while (element && element !== document.body) {
    if (element.matches("input, textarea, select, [data-swipe-ignore]")) return true;
    const { overflowX } = getComputedStyle(element);
    if ((overflowX === "auto" || overflowX === "scroll") && element.scrollWidth > element.clientWidth + 1) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

/** 1:1 tracking up to MAX_DRAG, gentle resistance beyond it — the page still moves, just reluctantly. */
function dampen(dx: number): number {
  if (Math.abs(dx) <= MAX_DRAG) return dx;
  const overflow = Math.abs(dx) - MAX_DRAG;
  return Math.sign(dx) * (MAX_DRAG + overflow * 0.3);
}

export interface DragProgress {
  /** The same dampened, signed px offset applied to the dragged content. */
  dx: number;
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
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx < INTENT_THRESHOLD && absDy < INTENT_THRESHOLD) return;
        const decisive = absDx >= absDy * HORIZONTAL_BIAS || absDy >= absDx * HORIZONTAL_BIAS;
        // A steady diagonal drag never resolves a clean 1.5x margin either
        // way — once there's been enough total movement, stop waiting for
        // clarity that isn't coming and just go with whichever axis leads.
        const forceDecision = Math.max(absDx, absDy) >= AXIS_DECISION_FALLBACK;
        if (!decisive && !forceDecision) return; // still ambiguous, wait for a clearer sample
        if (absDx >= absDy) {
          dragging = true;
        } else {
          // Vertical (or a forced tie toward vertical) — let the page scroll normally.
          tracking = false;
          return;
        }
      }

      event.preventDefault();
      const damped = dampen(dx);
      el.style.transform = `translateX(${damped}px)`;
      optionsRef.current.onDragProgress?.({ dx: damped });
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
      // The horizontal-vs-vertical call was already made (and locked in) back in
      // handleMove when dragging turned true — re-checking it here against the
      // *cumulative* dy would punish a long swipe for the natural vertical drift
      // a hand picks up over a bigger motion, springing it back despite a very
      // deliberate, far-enough drag.
      const direction: SwipeDirection = dx < 0 ? "next" : "prev";
      const committed = Math.abs(dx) >= COMMIT_DISTANCE && optionsRef.current.canSwipe(direction);

      if (committed) {
        // Leave the last onDragProgress value as-is — the caller's indicator
        // should stay put through the exit + onSwipe handoff, then let the
        // resulting navigation snap it to the real destination.
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
