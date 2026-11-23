import { useEffect, useRef, useState } from "react";

const REFRESH_INTERVAL_MS = 30000;

/**
 * The current time, refreshed every 30 seconds and also at the moment
 * `nextChangeAfter` names, so a class starting or ending switches the screen
 * on time instead of up to 30 seconds late.
 */
export function useNow(nextChangeAfter?: (now: Date) => Date | null): Date {
  const [now, setNow] = useState(() => new Date());
  const nextChangeRef = useRef(nextChangeAfter);
  nextChangeRef.current = nextChangeAfter;

  useEffect(() => {
    const changeAt = nextChangeRef.current?.(now)?.getTime() ?? Infinity;
    // Never spin faster than 50 ms, even when a timer fires a hair before the change it was set for.
    const delay = Math.max(50, Math.min(REFRESH_INTERVAL_MS, changeAt - Date.now()));
    const id = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(id);
  }, [now]);

  return now;
}
