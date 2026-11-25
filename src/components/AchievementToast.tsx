import { useEffect } from "react";
import { createPortal } from "react-dom";
import { levelLabel } from "../services/achievements/achievements";

interface AchievementToastProps {
  /** Newly earned badge levels (see levelKey). */
  keys: string[];
  onDone: () => void;
}

const SHOW_MS = 4500;

/** A brief "拿到新徽章" banner at the top of the screen. Tapping it dismisses it early. */
export function AchievementToast({ keys, onDone }: AchievementToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const shown = keys.slice(0, 3).map(levelLabel);
  const more = keys.length - shown.length;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        role="status"
        onClick={onDone}
        className="class-end-pop pointer-events-auto flex max-w-sm flex-col items-start rounded-3xl border-2 border-ink bg-lime px-5 py-3 text-left text-ink shadow-lg"
      >
        <span className="text-xs font-black">{keys.length > 1 ? `拿到 ${keys.length} 個新徽章!` : "拿到新徽章!"}</span>
        <span className="mt-0.5 text-base font-black">{shown.join("、")}</span>
        {more > 0 && <span className="text-xs font-bold">還有 {more} 個,到「設定 › 成就徽章」看</span>}
      </button>
    </div>,
    document.body,
  );
}
