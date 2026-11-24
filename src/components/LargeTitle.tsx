import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TitleBarSlotContext } from "../lib/titleBarSlot";

interface LargeTitleProps {
  children: string;
  /** For subpages: the bar gets a back button too, so going back doesn't need a scroll to the top. */
  back?: { label: string; onClick: () => void };
}

/**
 * A page's large title, iOS style: once it scrolls up under the top edge, a frosted
 * bar with the title in small type fades in, and fades out again on the way back up.
 * Watched with IntersectionObserver rather than scroll-driven CSS, which needs Safari 26.
 */
export function LargeTitle({ children, back }: LargeTitleProps) {
  const slot = useContext(TitleBarSlotContext);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const title = titleRef.current;
    const bar = barRef.current;
    if (!title || !bar) return;
    const barHeight = bar.offsetHeight;
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < barHeight),
      { rootMargin: `-${barHeight}px 0px 0px 0px` },
    );
    observer.observe(title);
    return () => observer.disconnect();
  }, [slot]);

  return (
    <>
      <h1 ref={titleRef} className="text-3xl font-black tracking-tight text-ink dark:text-white">
        {children}
      </h1>
      {slot &&
        createPortal(
          <div
            ref={barRef}
            inert={!collapsed}
            className={`title-bar fixed inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)] transition-opacity duration-200 ${
              collapsed ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <div className="mx-auto grid h-11 max-w-2xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4">
              <div className="min-w-0">
                {back && (
                  <button
                    type="button"
                    onClick={back.onClick}
                    className="-ml-2 max-w-full truncate rounded-full px-2 py-2 text-sm font-black text-ink dark:text-white"
                  >
                    ‹ {back.label}
                  </button>
                )}
              </div>
              {/* The large title is the heading; this is just its shadow while it's out of view. */}
              <p aria-hidden="true" className="truncate text-base font-black text-ink dark:text-white">
                {children}
              </p>
            </div>
          </div>,
          slot,
        )}
    </>
  );
}
