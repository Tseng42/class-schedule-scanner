import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTicker } from "../hooks/useTicker";
import {
  formatClock,
  formatFocusTime,
  isLongBreak,
  phaseEndsAt,
  phaseLengthMs,
  type FocusRun,
} from "../services/focus/focusTimer";

interface FocusTimerOverlayProps {
  run: FocusRun;
  courseName: string | null;
  todayMinutes: number;
  onEnd: () => void;
  onNext: () => void;
  /** Hides the screen; the timer keeps running and shows on the home card. */
  onMinimize: () => void;
}

const RING_SIZE = 260;
const RING_STROKE = 14;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The full-screen 專注計時: a ring counting down the current focus round or break. */
export function FocusTimerOverlay({ run, courseName, todayMinutes, onEnd, onNext, onMinimize }: FocusTimerOverlayProps) {
  const counting = run.phase !== "breakDone";
  const now = useTicker(counting);
  /** The phase the "end?" question was asked in, so it doesn't carry over into the next one. */
  const [confirmingIn, setConfirmingIn] = useState<string | null>(null);
  const phaseKey = `${run.round}-${run.phase}`;
  const confirmingEnd = confirmingIn === phaseKey;
  const minimizeRef = useRef<HTMLButtonElement>(null);
  const onMinimizeRef = useRef(onMinimize);
  onMinimizeRef.current = onMinimize;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById("root");
    root?.setAttribute("inert", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    minimizeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMinimizeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      root?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      // Started from the setup sheet, the opener is gone by now; the home card stands in for it.
      if (opener?.isConnected) opener.focus();
      else document.querySelector<HTMLElement>("[data-focus-card]")?.focus();
    };
  }, []);

  const length = phaseLengthMs(run);
  const endsAt = phaseEndsAt(run);
  const remaining = endsAt === null ? 0 : Math.max(0, endsAt - now);
  const fraction = length === null ? 1 : remaining / length;
  const focusedMinutes = run.phase === "focus" ? Math.min(run.focusMinutes, Math.floor((now - run.phaseStartedAt) / 60000)) : 0;

  const phaseLabel =
    run.phase === "focus" ? "專注中" : run.phase === "break" ? (isLongBreak(run) ? "長休息" : "休息一下") : "休息結束";
  const surface =
    run.phase === "focus" ? "bg-ink text-white" : run.phase === "break" ? "bg-sky text-ink" : "bg-lime text-ink";
  const ringTrack = run.phase === "focus" ? "stroke-white/15" : "stroke-ink/15";
  const ringFill = run.phase === "focus" ? "stroke-lime" : "stroke-ink";
  const primary =
    run.phase === "focus" ? "bg-lime text-ink" : "bg-ink text-white";
  const secondary =
    run.phase === "focus" ? "border-white/40 text-white" : "border-ink/30 text-ink";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-phase-label"
      data-swipe-ignore
      className={`fixed inset-0 z-[60] flex flex-col overscroll-none ${surface} transition-colors duration-500 motion-reduce:transition-none`}
    >
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          ref={minimizeRef}
          type="button"
          onClick={onMinimize}
          aria-label="收起計時(會繼續計時)"
          className="rounded-full px-3 py-2 text-sm font-black opacity-80 hover:opacity-100"
        >
          ⌄ 收起
        </button>
        <p className="px-3 text-sm font-black opacity-80">第 {run.round} 輪</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p id="focus-phase-label" aria-live="polite" className="text-2xl font-black">
          {phaseLabel}
        </p>
        <p className="mt-1 max-w-full truncate text-base font-bold opacity-80">{courseName ?? "沒有指定課程"}</p>

        <div className="relative mt-8" style={{ width: RING_SIZE, height: RING_SIZE, maxWidth: "75vw", maxHeight: "75vw" }}>
          <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="size-full -rotate-90" aria-hidden="true">
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} fill="none" strokeWidth={RING_STROKE} className={ringTrack} />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
              className={`${ringFill} transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none`}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            {counting ? (
              <p className="text-[clamp(3rem,16vw,4.5rem)] leading-none font-black tabular-nums">
                <span className="sr-only">剩下 </span>
                {formatClock(remaining)}
              </p>
            ) : (
              <p className="text-3xl font-black">再來一輪?</p>
            )}
          </div>
        </div>

        <p className="mt-8 text-sm font-bold opacity-80">
          {run.phase === "focus"
            ? `專注 ${run.focusMinutes} 分鐘,結束後休息 ${isLongBreak(run) ? run.longBreakMinutes : run.breakMinutes} 分鐘`
            : todayMinutes > 0
              ? `今天專注了 ${formatFocusTime(todayMinutes)}`
              : "站起來動一動、喝口水"}
        </p>
      </div>

      <div className="flex flex-col gap-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {confirmingEnd ? (
          <div className="flex flex-col gap-3" role="group" aria-label="確認結束">
            <p className="text-center text-sm font-black">
              {focusedMinutes >= 1 ? `已專注 ${focusedMinutes} 分鐘,會記下來。要結束嗎?` : "還不到 1 分鐘,不會記下來。要結束嗎?"}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmingIn(null)}
                className={`flex-1 rounded-full border-2 px-5 py-3 text-base font-black ${secondary}`}
              >
                繼續專注
              </button>
              <button type="button" onClick={onEnd} className={`flex-1 rounded-full px-5 py-3 text-base font-black ${primary}`}>
                結束
              </button>
            </div>
          </div>
        ) : run.phase === "focus" ? (
          <button
            type="button"
            onClick={() => setConfirmingIn(phaseKey)}
            className={`rounded-full border-2 px-5 py-3 text-base font-black ${secondary}`}
          >
            提早結束
          </button>
        ) : (
          <>
            <button type="button" onClick={onNext} className={`rounded-full px-5 py-3 text-base font-black ${primary}`}>
              {run.phase === "break" ? "跳過休息,開始下一輪" : `開始第 ${run.round + 1} 輪`}
            </button>
            <button type="button" onClick={onEnd} className={`rounded-full border-2 px-5 py-3 text-base font-black ${secondary}`}>
              今天先到這裡
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
