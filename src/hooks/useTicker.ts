import { useEffect, useState } from "react";

/** Date.now(), re-read on every whole second while `active`, so a countdown ticks over on the second. */
export function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) || 1000);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [active]);

  return now;
}
