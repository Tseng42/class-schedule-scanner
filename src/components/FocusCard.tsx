import { useTicker } from "../hooks/useTicker";
import { RollingNumber } from "./RollingNumber";
import { formatClock, formatFocusTime, isLongBreak, phaseEndsAt, type FocusRun } from "../services/focus/focusTimer";

interface FocusCardProps {
  run: FocusRun | null;
  courseName: string | null;
  todayMinutes: number;
  onStart: () => void;
  /** `source` is the card, for the full-screen timer to grow out of. */
  onOpen: (source: HTMLElement) => void;
}

/** The home screen's way into 專注計時: a start button, or the running timer at a glance. */
export function FocusCard({ run, courseName, todayMinutes, onStart, onOpen }: FocusCardProps) {
  const now = useTicker(run !== null && run.phase !== "breakDone");

  if (!run) {
    return (
      <section className="flex items-center gap-3 rounded-3xl border-2 border-ink/10 bg-white py-3 pr-3 pl-4 text-ink dark:border-white/10 dark:bg-white/5 dark:text-white">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black">專注計時</h2>
          <p className="mt-0.5 text-xs font-bold text-ink/60 dark:text-white/60">
            {todayMinutes > 0 ? (
              <>
                今天專注了 <RollingNumber value={formatFocusTime(todayMinutes)} direction="up" className="tabular-nums" />
              </>
            ) : (
              "選一門課,開始讀書"
            )}
          </p>
        </div>
        <button
          type="button"
          data-focus-card
          onClick={onStart}
          className="shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm font-black text-lime transition-transform active:scale-95 dark:bg-lime dark:text-ink"
        >
          開始專注
        </button>
      </section>
    );
  }

  const endsAt = phaseEndsAt(run);
  const label =
    run.phase === "focus" ? "專注中" : run.phase === "break" ? (isLongBreak(run) ? "長休息" : "休息中") : "休息結束";
  const surface =
    run.phase === "focus"
      ? "bg-ink text-white dark:bg-white/10"
      : run.phase === "break"
        ? "bg-sky text-ink"
        : "bg-lime text-ink";

  return (
    <button
      type="button"
      data-focus-card
      onClick={(event) => onOpen(event.currentTarget)}
      className={`flex w-full items-center gap-3 rounded-3xl py-3.5 pr-4 pl-4 text-left transition-transform active:scale-[0.99] ${surface}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black">
          {label} · 第 {run.round} 輪
        </span>
        <span className="mt-0.5 block truncate text-sm font-bold opacity-80">
          {run.phase === "breakDone" ? `點這裡開始第 ${run.round + 1} 輪` : (courseName ?? "沒有指定課程")}
        </span>
      </span>
      {endsAt !== null && (
        <span data-expand-share="clock" className="shrink-0 text-2xl font-black tabular-nums">
          <RollingNumber value={formatClock(endsAt - now)} direction="down" />
        </span>
      )}
      <span aria-hidden="true" className="text-base leading-none font-black opacity-60">
        ›
      </span>
    </button>
  );
}
