import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { HomePage } from "./pages/HomePage";
import { UploadPage } from "./pages/UploadPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ManageCoursesPage } from "./pages/ManageCoursesPage";
import { useSwipeNavigation } from "./hooks/useSwipeNavigation";
import { useAppUpdate } from "./hooks/useAppUpdate";

type View = "home" | "upload" | "manage" | "settings";
type Direction = "next" | "prev";

const TABS: { view: View; label: string }[] = [
  { view: "home", label: "課表" },
  { view: "manage", label: "所有課程" },
  { view: "upload", label: "掃描課表" },
  { view: "settings", label: "設定" },
];

const DRAG_THRESHOLD = 8;
const ACTIVE_TOKENS = ["text-lime", "dark:text-ink"];
const INACTIVE_TOKENS = ["text-ink/50", "hover:text-ink", "dark:text-white/50", "dark:hover:text-white"];

interface DragState {
  pointerId: number;
  startX: number;
  dragging: boolean;
  minLeft: number;
  maxLeft: number;
  indicatorWidth: number;
}

function App() {
  const [view, setView] = useState<View>("home");
  const [direction, setDirection] = useState<Direction | null>(null);
  const updateReady = useAppUpdate();
  const contentRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<View, HTMLButtonElement>());
  const dragStateRef = useRef<DragState | null>(null);

  const navigateTo = (target: View) => {
    const from = TABS.findIndex((tab) => tab.view === view);
    const to = TABS.findIndex((tab) => tab.view === target);
    if (from === to) return;
    setDirection(to > from ? "next" : "prev");
    setView(target);
  };

  useSwipeNavigation(contentRef, {
    canSwipe: (swipeDirection) => {
      const current = TABS.findIndex((tab) => tab.view === view);
      return Boolean(TABS[current + (swipeDirection === "next" ? 1 : -1)]);
    },
    onSwipe: (swipeDirection) => {
      const current = TABS.findIndex((tab) => tab.view === view);
      const target = TABS[current + (swipeDirection === "next" ? 1 : -1)];
      if (target) navigateTo(target.view);
    },
  });

  const snapIndicatorTo = (target: View) => {
    const button = tabRefs.current.get(target);
    const indicator = indicatorRef.current;
    if (!button || !indicator) return;
    indicator.style.width = `${button.offsetWidth}px`;
    indicator.style.transform = `translateX(${button.offsetLeft}px)`;
  };

  // Slides the pill indicator to sit behind whichever tab is active, in both
  // dimensions, so switching tabs (by tap, swipe, or drag-release) glides
  // instead of jumping.
  useLayoutEffect(() => {
    snapIndicatorTo(view);
  }, [view]);

  const applyHoverPreview = (hovered: View) => {
    for (const [tabView, button] of tabRefs.current) {
      if (tabView === hovered) {
        button.classList.remove(...INACTIVE_TOKENS);
        button.classList.add(...ACTIVE_TOKENS);
      } else {
        button.classList.remove(...ACTIVE_TOKENS);
        button.classList.add(...INACTIVE_TOKENS);
      }
    }
  };

  const restoreActiveClasses = () => applyHoverPreview(view);

  const nearestTabAt = (clientX: number): View => {
    let closest: View = view;
    let closestDistance = Infinity;
    for (const tab of TABS) {
      const button = tabRefs.current.get(tab.view);
      if (!button) continue;
      const rect = button.getBoundingClientRect();
      const distance = Math.abs(clientX - (rect.left + rect.width / 2));
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = tab.view;
      }
    }
    return closest;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (dragStateRef.current) return;
    const indicator = indicatorRef.current;
    const first = tabRefs.current.get(TABS[0].view);
    const last = tabRefs.current.get(TABS[TABS.length - 1].view);
    if (!indicator || !first || !last) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      dragging: false,
      minLeft: first.offsetLeft,
      maxLeft: last.offsetLeft + last.offsetWidth - indicator.offsetWidth,
      indicatorWidth: indicator.offsetWidth,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    const container = navRef.current;
    const indicator = indicatorRef.current;
    if (!state || state.pointerId !== event.pointerId || !container || !indicator) return;

    if (!state.dragging) {
      if (Math.abs(event.clientX - state.startX) < DRAG_THRESHOLD) return;
      state.dragging = true;
      indicator.style.transition = "none";
    }

    const containerRect = container.getBoundingClientRect();
    const relativeX = event.clientX - containerRect.left - container.clientLeft;
    const clampedLeft = Math.min(state.maxLeft, Math.max(state.minLeft, relativeX - state.indicatorWidth / 2));
    indicator.style.transform = `translateX(${clampedLeft}px)`;
    applyHoverPreview(nearestTabAt(event.clientX));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (!state.dragging) return;

    if (indicatorRef.current) indicatorRef.current.style.transition = "";
    if (commit) {
      const target = nearestTabAt(event.clientX);
      if (target === view) {
        // navigateTo no-ops for the same tab, so the position-sync effect won't
        // re-run — snap back to the button ourselves instead of leaving the
        // indicator stranded wherever the drag ended.
        snapIndicatorTo(target);
        restoreActiveClasses();
      } else {
        navigateTo(target);
      }
    } else {
      snapIndicatorTo(view);
      restoreActiveClasses();
    }
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-ink">
      <nav className="mx-auto flex max-w-2xl flex-wrap gap-1 px-4 pt-5">
        <div
          ref={navRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => endDrag(event, true)}
          onPointerCancel={(event) => endDrag(event, false)}
          className="relative flex touch-none flex-wrap gap-1 rounded-full border-2 border-ink bg-white p-1 dark:border-white/20 dark:bg-white/5"
        >
          <div
            ref={indicatorRef}
            className="absolute inset-y-1 left-0 w-0 rounded-full bg-ink transition-[transform,width] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:bg-lime"
          />
          {TABS.map((tab) => (
            <button
              key={tab.view}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.view, node);
              }}
              type="button"
              onClick={() => navigateTo(tab.view)}
              className={`relative z-10 rounded-full px-4 py-2 text-sm font-black transition-colors duration-300 ${
                view === tab.view
                  ? "text-lime dark:text-ink"
                  : "text-ink/50 hover:text-ink dark:text-white/50 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <div ref={contentRef} key={view} className={direction ? `page-enter-${direction}` : undefined}>
        {view === "home" && <HomePage onNavigateUpload={() => navigateTo("upload")} />}
        {view === "manage" && <ManageCoursesPage onNavigateUpload={() => navigateTo("upload")} />}
        {view === "upload" && <UploadPage onNavigateHome={() => navigateTo("home")} />}
        {view === "settings" && <SettingsPage />}
      </div>
      {updateReady && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-sm font-black text-lime shadow-lg dark:bg-lime dark:text-ink">
          <span>有新版本可以使用</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-lime px-4 py-2 text-ink transition-transform active:scale-95 dark:bg-ink dark:text-lime"
          >
            更新
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
