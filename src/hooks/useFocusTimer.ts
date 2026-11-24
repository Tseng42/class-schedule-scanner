import { useCallback, useEffect, useRef, useState } from "react";
import type { Schedule } from "../schema/schedule";
import { addFocusSession } from "../services/storage/scheduleRepository";
import {
  advanceRun,
  endRun,
  isLongBreak,
  loadRun,
  nextRound,
  phaseEndsAt,
  saveRun,
  startRun,
  type FocusLengths,
  type FocusRun,
  type LoggedSession,
} from "../services/focus/focusTimer";
import { playChime, unlockChime } from "../lib/chime";

/** A phase that ended longer ago than this (the page was asleep) changes quietly instead of chiming late. */
const LATE_CHIME_MS = 10_000;

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

async function requestWakeLock(): Promise<WakeLockSentinelLike | null> {
  try {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } })
      .wakeLock;
    return wakeLock ? await wakeLock.request("screen") : null;
  } catch {
    // Not supported, or refused (low battery, page hidden): the screen just dims as usual.
    return null;
  }
}

/** A system notification for a phase that ended while the page was in the background, if notifications are on. */
async function notify(title: string, body: string): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options = { body, tag: "focus-timer" };
  try {
    // Android Chrome only allows notifications through the service worker.
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall through to the page-level API.
  }
  try {
    new Notification(title, options);
  } catch {
    // Nothing else to try.
  }
}

function announcePhaseEnd(run: FocusRun | null, changedAt: number): void {
  if (!run) return;
  const late = Date.now() - changedAt > LATE_CHIME_MS;
  if (document.visibilityState === "visible") {
    if (!late) playChime();
    return;
  }
  if (run.phase === "break") void notify("專注結束,休息一下", isLongBreak(run) ? "長休息時間到了" : `第 ${run.round} 輪完成`);
  else if (run.phase === "breakDone") void notify("休息結束", `回來開始第 ${run.round + 1} 輪`);
}

export interface FocusTimer {
  run: FocusRun | null;
  start: (lengths: FocusLengths, courseId: string | undefined) => void;
  /** Stops the timer; a focus round in progress is logged with the whole minutes done so far. */
  end: () => LoggedSession | null;
  /** Skips the rest of the break, or starts the next round once it's over. */
  next: () => void;
}

/**
 * The 專注計時 state machine. The run is saved to localStorage, so it keeps
 * going across reloads and while the page is on another tab, and every finished
 * focus round is logged to the synced schedule; `onLogged` gets the new schedule.
 */
export function useFocusTimer(onLogged: (schedule: Schedule) => void): FocusTimer {
  const [run, setRun] = useState<FocusRun | null>(loadRun);
  const onLoggedRef = useRef(onLogged);
  onLoggedRef.current = onLogged;

  const commit = useCallback((next: FocusRun | null) => {
    saveRun(next);
    setRun(next);
  }, []);

  const log = useCallback((logged: LoggedSession) => {
    try {
      onLoggedRef.current(addFocusSession(logged.id, logged.session));
    } catch {
      // Storage full or unavailable: the round isn't recorded, but the timer carries on.
    }
  }, []);

  // Move on whenever the current phase ends, and catch up when the page wakes up.
  useEffect(() => {
    if (!run) return;
    const check = () => {
      const result = advanceRun(run, Date.now());
      if (result.run === run) return;
      if (result.logged) log(result.logged);
      if (result.changedAt !== null) announcePhaseEnd(result.run, result.changedAt);
      commit(result.run);
    };
    check();
    const endsAt = phaseEndsAt(run);
    const timer = endsAt === null ? undefined : window.setTimeout(check, Math.max(50, endsAt - Date.now()));
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [run, commit, log]);

  // Another tab started, ended or advanced the timer.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "class-schedule-scanner:focus-run") setRun(loadRun());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Keep the screen on while a focus round or break is counting down, where the browser allows it.
  const counting = run !== null && run.phase !== "breakDone";
  useEffect(() => {
    if (!counting) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || sentinel) return;
      const acquired = await requestWakeLock();
      if (cancelled) void acquired?.release();
      else sentinel = acquired;
    };
    // The browser drops the lock whenever the page is hidden; take it again on return.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        sentinel = null;
        void acquire();
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, [counting]);

  const start = useCallback(
    (lengths: FocusLengths, courseId: string | undefined) => {
      unlockChime();
      commit(startRun(lengths, courseId, Date.now()));
    },
    [commit],
  );

  const end = useCallback(() => {
    const current = loadRun() ?? run;
    if (!current) return null;
    const logged = endRun(current, Date.now());
    if (logged) log(logged);
    commit(null);
    return logged;
  }, [run, commit, log]);

  const next = useCallback(() => {
    if (!run) return;
    unlockChime();
    commit(nextRound(run, Date.now()));
  }, [run, commit]);

  return { run, start, end, next };
}
