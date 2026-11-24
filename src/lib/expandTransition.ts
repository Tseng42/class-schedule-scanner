import { flushSync } from "react-dom";

/*
 * Container transform, in Material's terms: what a tap opens grows out of the thing
 * that was tapped, and shrinks back into it when closed. Built on same-document View
 * Transitions (Safari 18+, Chrome 111+). Without them, or with reduced motion, the
 * update just happens and things appear the way they always have.
 *
 * The opened panel marks itself with data-expand-target. Parts marked
 * data-expand-share="<key>" on both ends travel on their own, like the focus timer's
 * clock flying from the card to the middle of the screen.
 */

const NAME = "expand";
/** Material's container-transform examples use 300ms; closing is a little quicker. */
const OPEN_MS = 300;
const CLOSE_MS = 250;
/** Material 3's emphasized easing, which its container transform uses. */
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

/** Where the open panel came from, to shrink back into. One panel is open at a time. */
let openedFrom: HTMLElement | null = null;

function canAnimate(): boolean {
  return (
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function setNames(element: HTMLElement, on: boolean): void {
  element.style.viewTransitionName = on ? NAME : "";
  for (const part of element.querySelectorAll<HTMLElement>("[data-expand-share]")) {
    part.style.viewTransitionName = on ? `${NAME}-${part.dataset.expandShare}` : "";
  }
}

function morph(from: HTMLElement, findTo: () => HTMLElement | null, update: () => void, ms: number): void {
  const root = document.documentElement;
  const fromRadius = getComputedStyle(from).borderTopLeftRadius;
  let to: HTMLElement | null = null;

  setNames(from, true);
  root.style.setProperty("--expand-ms", `${ms}ms`);
  const transition = document.startViewTransition(() => {
    setNames(from, false);
    flushSync(update);
    to = findTo();
    if (to) setNames(to, true);
  });

  // The corners round off or square up along the way (a card's 24px into a full screen's 0).
  transition.ready
    .then(() => {
      if (!to) return;
      root.animate(
        { borderRadius: [fromRadius, getComputedStyle(to).borderTopLeftRadius] },
        { duration: ms, easing: EASE, pseudoElement: `::view-transition-image-pair(${NAME})` },
      );
    })
    .catch(() => {
      // Skipped transition, or no pseudo-element animation support: the corners just don't morph.
    });
  transition.finished.finally(() => {
    if (to) setNames(to, false);
    root.style.removeProperty("--expand-ms");
  });
}

/** Opens a panel (rendered by `update`) so it grows out of `source`. */
export function expandFrom(source: HTMLElement | null, update: () => void): void {
  openedFrom = source;
  if (!source || !canAnimate()) {
    update();
    return;
  }
  morph(source, () => document.querySelector<HTMLElement>("[data-expand-target]"), update, OPEN_MS);
}

/**
 * Closes the open panel (`update` unmounts it) so it shrinks back into where it came
 * from. Pass the popstate event when closing from history: if the browser already
 * animated the back swipe itself, a second animation would play on top of it.
 * `fallback` is where to shrink into when the panel wasn't opened from anything on screen.
 */
export function collapseBack(update: () => void, event?: Event, fallback?: () => HTMLElement | null): void {
  const panel = document.querySelector<HTMLElement>("[data-expand-target]");
  const browserAnimated = event !== undefined && "hasUAVisualTransition" in event && event.hasUAVisualTransition === true;
  if (!panel || browserAnimated || !canAnimate()) {
    update();
    return;
  }
  morph(panel, () => (openedFrom?.isConnected ? openedFrom : (fallback?.() ?? null)), update, CLOSE_MS);
}

/** The card an opening tap belongs to: the nearest data-expand-source, or the tapped element itself. */
export function expandSourceOf(element: HTMLElement): HTMLElement {
  return element.closest<HTMLElement>("[data-expand-source]") ?? element;
}
